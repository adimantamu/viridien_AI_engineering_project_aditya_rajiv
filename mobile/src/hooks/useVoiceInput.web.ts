import { useCallback, useEffect, useRef, useState } from "react";
import {
  acquireMicrophoneStream,
  getBrowserSpeechRecognitionCtor,
  isBrowserSpeechRecognitionAvailable,
  primeMicrophonePermission,
  releaseMicrophoneStream,
  startRecognitionWithRetry,
  transcriptFromBrowserResultEvent,
  type BrowserSpeechRecognition,
} from "@/src/lib/webSpeechRecognition";
import type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";

const WEB_RESTART_DELAY_MS = 320;
const WEB_EMPTY_RETRY_MAX = 5;

export function useVoiceInput({
  onTranscriptChange,
  onFinalTranscript,
  onError,
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [listening, setListening] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [partial, setPartial] = useState("");
  const [available, setAvailable] = useState(true);

  const listeningRef = useRef(false);
  const userStoppedRef = useRef(false);
  const transcriptRef = useRef("");
  const webRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const webRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const hasHeardSpeechRef = useRef(false);
  const emptyRetryCountRef = useRef(0);
  const startWebRecognitionRef = useRef<() => void>(() => {});

  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    setAvailable(isBrowserSpeechRecognitionAvailable());
    void primeMicrophonePermission();
  }, []);

  const publishTranscript = useCallback((text: string) => {
    transcriptRef.current = text;
    setPartial(text);
    onTranscriptChangeRef.current?.(text);
  }, []);

  const clearWebRestartTimer = useCallback(() => {
    if (webRestartTimerRef.current) {
      clearTimeout(webRestartTimerRef.current);
      webRestartTimerRef.current = null;
    }
  }, []);

  const releaseMic = useCallback(() => {
    releaseMicrophoneStream(micStreamRef.current);
    micStreamRef.current = null;
  }, []);

  const detachWebRecognition = useCallback((abort = false) => {
    const rec = webRecognitionRef.current;
    webRecognitionRef.current = null;
    if (!rec) return;
    rec.onstart = null;
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    if (abort) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const finishListening = useCallback(() => {
    listeningRef.current = false;
    userStoppedRef.current = true;
    setListening(false);
    setPreparing(false);
    clearWebRestartTimer();
    detachWebRecognition(true);
    releaseMic();

    const text = transcriptRef.current.trim();
    if (text) {
      onFinalTranscriptRef.current?.(text);
    }
  }, [clearWebRestartTimer, detachWebRecognition, releaseMic]);

  const scheduleWebRestart = useCallback(
    (reason: "silence" | "empty") => {
      clearWebRestartTimer();

      if (reason === "empty" && emptyRetryCountRef.current >= WEB_EMPTY_RETRY_MAX) {
        return;
      }

      if (reason === "empty") {
        emptyRetryCountRef.current += 1;
      }

      webRestartTimerRef.current = setTimeout(() => {
        webRestartTimerRef.current = null;
        if (!userStoppedRef.current && listeningRef.current) {
          startWebRecognitionRef.current();
        }
      }, WEB_RESTART_DELAY_MS);
    },
    [clearWebRestartTimer],
  );

  const startWebRecognition = useCallback(() => {
    const Ctor = getBrowserSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.(
        "Speech recognition is not supported in this browser. Use Chrome or Edge on desktop.",
      );
      finishListening();
      return;
    }

    detachWebRecognition(true);

    const recognition = new Ctor();
    webRecognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setPreparing(false);
      listeningRef.current = true;
      setListening(true);
    };

    recognition.onresult = (event) => {
      hasHeardSpeechRef.current = true;
      emptyRetryCountRef.current = 0;
      const text = transcriptFromBrowserResultEvent(event);
      if (text) publishTranscript(text);
    };

    recognition.onspeechstart = () => {
      hasHeardSpeechRef.current = true;
      emptyRetryCountRef.current = 0;
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") {
        return;
      }
      if (event.error === "no-speech") {
        if (!userStoppedRef.current && listeningRef.current) {
          scheduleWebRestart("empty");
        }
        return;
      }
      if (event.error === "not-allowed") {
        onErrorRef.current?.(
          "Microphone blocked. Allow microphone access for this site in browser settings.",
        );
      } else if (event.error === "network") {
        onErrorRef.current?.("Speech recognition needs an internet connection in Chrome.");
      } else {
        onErrorRef.current?.(event.message || `Voice error: ${event.error}`);
      }
      finishListening();
    };

    recognition.onend = () => {
      webRecognitionRef.current = null;

      if (userStoppedRef.current) {
        finishListening();
        return;
      }

      if (!listeningRef.current) return;

      if (!hasHeardSpeechRef.current && !transcriptRef.current.trim()) {
        scheduleWebRestart("empty");
        return;
      }

      scheduleWebRestart("silence");
    };

    void startRecognitionWithRetry(recognition).catch((e) => {
      if (!userStoppedRef.current && emptyRetryCountRef.current < WEB_EMPTY_RETRY_MAX) {
        emptyRetryCountRef.current += 1;
        scheduleWebRestart("empty");
        return;
      }
      onErrorRef.current?.(
        e instanceof Error ? e.message : "Could not start microphone. Try Chrome or Edge.",
      );
      finishListening();
    });
  }, [detachWebRecognition, finishListening, publishTranscript, scheduleWebRestart]);

  useEffect(() => {
    startWebRecognitionRef.current = startWebRecognition;
  }, [startWebRecognition]);

  const stopWeb = useCallback(() => {
    userStoppedRef.current = true;
    clearWebRestartTimer();
    const rec = webRecognitionRef.current;
    detachWebRecognition(false);
    if (rec) {
      try {
        rec.stop();
      } catch {
        finishListening();
      }
    } else {
      finishListening();
    }
  }, [clearWebRestartTimer, detachWebRecognition, finishListening]);

  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      clearWebRestartTimer();
      detachWebRecognition(true);
      releaseMic();
    };
  }, [clearWebRestartTimer, detachWebRecognition, releaseMic]);

  const start = useCallback(async () => {
    if (listeningRef.current || preparing) return;

    userStoppedRef.current = false;
    hasHeardSpeechRef.current = false;
    emptyRetryCountRef.current = 0;
    listeningRef.current = true;
    transcriptRef.current = "";
    setPartial("");
    setPreparing(true);
    setListening(true);
    onTranscriptChangeRef.current?.("");

    const primedOk = await primeMicrophonePermission();
    if (!primedOk) {
      onErrorRef.current?.("Microphone access is required. Allow the mic when your browser asks.");
      finishListening();
      return;
    }

    if (!micStreamRef.current) {
      micStreamRef.current = await acquireMicrophoneStream();
    }
    if (!micStreamRef.current) {
      onErrorRef.current?.("Could not open the microphone. Check browser permissions.");
      finishListening();
      return;
    }

    await new Promise((r) => setTimeout(r, 120));
    if (userStoppedRef.current) {
      finishListening();
      return;
    }

    startWebRecognition();
  }, [finishListening, preparing, startWebRecognition]);

  const stop = useCallback(() => {
    if (!listeningRef.current && !webRecognitionRef.current && !preparing) return;
    stopWeb();
  }, [preparing, stopWeb]);

  const toggle = useCallback(() => {
    if (listeningRef.current || webRecognitionRef.current || preparing) {
      stop();
    } else {
      void start();
    }
  }, [preparing, start, stop]);

  return {
    listening,
    preparing,
    partial,
    available,
    start,
    stop,
    toggle,
  };
}
