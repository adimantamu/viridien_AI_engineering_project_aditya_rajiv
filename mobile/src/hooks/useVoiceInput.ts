import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
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

interface UseVoiceInputOptions {
  onTranscriptChange?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (message: string) => void;
}

function extractNativeTranscript(event: ExpoSpeechRecognitionResultEvent): string {
  const results = event.results;
  if (!results?.length) return "";

  const fromLast = results[results.length - 1]?.transcript?.trim();
  if (fromLast) return fromLast;

  return results
    .map((r) => r.transcript?.trim())
    .filter(Boolean)
    .join(" ");
}

const useWebSpeech = Platform.OS === "web";
const WEB_RESTART_DELAY_MS = 320;
const WEB_EMPTY_RETRY_MAX = 5;

export function useVoiceInput({
  onTranscriptChange,
  onFinalTranscript,
  onError,
}: UseVoiceInputOptions) {
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
    if (useWebSpeech) {
      setAvailable(isBrowserSpeechRecognitionAvailable());
      void primeMicrophonePermission();
      return;
    }
    try {
      setAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable());
    } catch {
      setAvailable(false);
    }
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

  // Native listeners
  useEffect(() => {
    if (useWebSpeech) return;

    const onStart = () => {
      listeningRef.current = true;
      setListening(true);
    };

    const onEnd = () => {
      if (!listeningRef.current) return;
      finishListening();
      transcriptRef.current = "";
      setPartial("");
    };

    const onResult = (event: ExpoSpeechRecognitionResultEvent) => {
      const text = extractNativeTranscript(event);
      if (text) publishTranscript(text);
    };

    const onNativeError = (event: { error: string; message?: string }) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      onErrorRef.current?.(event.message || "Voice input failed");
      listeningRef.current = false;
      setListening(false);
    };

    const subStart = ExpoSpeechRecognitionModule.addListener("start", onStart);
    const subEnd = ExpoSpeechRecognitionModule.addListener("end", onEnd);
    const subResult = ExpoSpeechRecognitionModule.addListener("result", onResult);
    const subError = ExpoSpeechRecognitionModule.addListener("error", onNativeError);

    return () => {
      subStart.remove();
      subEnd.remove();
      subResult.remove();
      subError.remove();
    };
  }, [finishListening, publishTranscript]);

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

    if (useWebSpeech) {
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
      return;
    }

    setPreparing(false);
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        finishListening();
        onErrorRef.current?.("Microphone and speech recognition permissions are required.");
        return;
      }

      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        finishListening();
        onErrorRef.current?.("Speech recognition is not available on this device.");
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        ...(Platform.OS === "android"
          ? {
              androidIntentOptions: {
                EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 6000,
                EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
              },
            }
          : {}),
      });
    } catch (e) {
      finishListening();
      onErrorRef.current?.(e instanceof Error ? e.message : "Could not start voice input");
    }
  }, [finishListening, preparing, startWebRecognition]);

  const stop = useCallback(() => {
    if (!listeningRef.current && !webRecognitionRef.current && !preparing) return;

    if (useWebSpeech) {
      stopWeb();
      return;
    }

    userStoppedRef.current = true;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      finishListening();
    }
  }, [finishListening, preparing, stopWeb]);

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
