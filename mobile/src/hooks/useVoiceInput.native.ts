import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";

/** Expo Go does not ship the expo-speech-recognition native module. */
const isExpoGo =
  Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo";

type SpeechModule = typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
type SpeechResultEvent = import("expo-speech-recognition").ExpoSpeechRecognitionResultEvent;

function extractTranscript(event: SpeechResultEvent): string {
  const results = event.results;
  if (!results?.length) return "";

  const fromLast = results[results.length - 1]?.transcript?.trim();
  if (fromLast) return fromLast;

  return results
    .map((r) => r.transcript?.trim())
    .filter(Boolean)
    .join(" ");
}

function loadSpeechModule(): SpeechModule | null {
  if (isExpoGo) return null;
  try {
    // Loaded only in dev/production builds — never in Expo Go
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition") as typeof import("expo-speech-recognition");
    return mod.ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

/** Safe on Expo Go (text-only). Voice works in a custom dev build with expo-speech-recognition. */
export function useVoiceInput({
  onTranscriptChange,
  onFinalTranscript,
  onError,
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [listening, setListening] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [partial, setPartial] = useState("");
  const [available, setAvailable] = useState(false);

  const speechRef = useRef<SpeechModule | null>(null);
  const listeningRef = useRef(false);
  const userStoppedRef = useRef(false);
  const transcriptRef = useRef("");
  const subsRef = useRef<{ remove: () => void }[]>([]);

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

  const publishTranscript = useCallback((text: string) => {
    transcriptRef.current = text;
    setPartial(text);
    onTranscriptChangeRef.current?.(text);
  }, []);

  const removeListeners = useCallback(() => {
    for (const sub of subsRef.current) {
      sub.remove();
    }
    subsRef.current = [];
  }, []);

  const finishListening = useCallback(() => {
    listeningRef.current = false;
    userStoppedRef.current = true;
    setListening(false);
    setPreparing(false);

    const text = transcriptRef.current.trim();
    if (text) {
      onFinalTranscriptRef.current?.(text);
    }
  }, []);

  useEffect(() => {
    if (isExpoGo) {
      setAvailable(false);
      return;
    }

    const module = loadSpeechModule();
    speechRef.current = module;

    if (!module) {
      setAvailable(false);
      return;
    }

    try {
      setAvailable(module.isRecognitionAvailable());
    } catch {
      setAvailable(false);
      return;
    }

    const onStart = () => {
      listeningRef.current = true;
      setListening(true);
      setPreparing(false);
    };

    const onEnd = () => {
      if (!listeningRef.current) return;
      finishListening();
      transcriptRef.current = "";
      setPartial("");
    };

    const onResult = (event: SpeechResultEvent) => {
      const text = extractTranscript(event);
      if (text) publishTranscript(text);
    };

    const onNativeError = (event: { error: string; message?: string }) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      onErrorRef.current?.(event.message || "Voice input failed");
      listeningRef.current = false;
      setListening(false);
      setPreparing(false);
    };

    subsRef.current = [
      module.addListener("start", onStart),
      module.addListener("end", onEnd),
      module.addListener("result", onResult),
      module.addListener("error", onNativeError),
    ];

    return () => {
      removeListeners();
    };
  }, [finishListening, publishTranscript, removeListeners]);

  const start = useCallback(async () => {
    if (isExpoGo) {
      onErrorRef.current?.(
        "Voice input is not available in Expo Go. Type your message below, or use the web app in Chrome.",
      );
      return;
    }

    const module = speechRef.current ?? loadSpeechModule();
    if (!module) {
      onErrorRef.current?.("Speech recognition is not available on this device.");
      return;
    }

    if (listeningRef.current || preparing) return;

    userStoppedRef.current = false;
    transcriptRef.current = "";
    setPartial("");
    setPreparing(true);
    onTranscriptChangeRef.current?.("");

    try {
      const permission = await module.requestPermissionsAsync();
      if (!permission.granted) {
        setPreparing(false);
        onErrorRef.current?.("Microphone and speech recognition permissions are required.");
        return;
      }

      if (!module.isRecognitionAvailable()) {
        setPreparing(false);
        onErrorRef.current?.("Speech recognition is not available on this device.");
        return;
      }

      module.start({
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
      setPreparing(false);
      setListening(false);
      listeningRef.current = false;
      onErrorRef.current?.(e instanceof Error ? e.message : "Could not start voice input");
    }
  }, [preparing]);

  const stop = useCallback(() => {
    const module = speechRef.current;
    userStoppedRef.current = true;

    if (module && listeningRef.current) {
      try {
        module.stop();
      } catch {
        finishListening();
      }
      return;
    }

    if (listeningRef.current || preparing) {
      finishListening();
    }
  }, [finishListening, preparing]);

  const toggle = useCallback(() => {
    if (listeningRef.current || preparing) {
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
