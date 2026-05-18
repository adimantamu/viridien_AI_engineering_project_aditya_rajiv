import { Audio } from "expo-av";
import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { fetchVoiceBackendReady, transcribeAudioFile } from "@/src/lib/transcribeAudio";
import type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";

const useExpoGoWhisper =
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
  if (useExpoGoWhisper) return null;
  try {
    const mod = require("expo-speech-recognition") as typeof import("expo-speech-recognition");
    return mod.ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

/**
 * Expo Go (iPhone/Android): record audio → POST /api/transcribe (Whisper).
 * Dev/production build: live expo-speech-recognition when available.
 */
export function useVoiceInput({
  onTranscriptChange,
  onFinalTranscript,
  onError,
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [listening, setListening] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [partial, setPartial] = useState("");
  const [available, setAvailable] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const speechRef = useRef<SpeechModule | null>(null);
  const listeningRef = useRef(false);
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

  const finishNativeSpeech = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setPreparing(false);

    const text = transcriptRef.current.trim();
    if (text) {
      onFinalTranscriptRef.current?.(text);
    }
  }, []);

  useEffect(() => {
    if (useExpoGoWhisper) {
      void fetchVoiceBackendReady().then(setAvailable);
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
      finishNativeSpeech();
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
  }, [finishNativeSpeech, publishTranscript, removeListeners]);

  const startWhisperRecording = useCallback(async () => {
    if (!available) {
      onErrorRef.current?.(
        "Voice needs OPENAI_API_KEY on the server. Set it in backend/.env, restart the API, and confirm http://YOUR_PC_IP:3001/health shows voice: whisper on your iPhone.",
      );
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      onErrorRef.current?.("Microphone permission is required for voice ordering.");
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );

    recordingRef.current = recording;
    listeningRef.current = true;
    setListening(true);
    setPartial("Recording… tap stop when finished");
    onTranscriptChangeRef.current?.("Recording… tap stop when finished");
  }, [available]);

  const stopWhisperRecording = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    listeningRef.current = false;
    setListening(false);

    if (!recording) return;

    setPreparing(true);
    setPartial("Transcribing…");
    onTranscriptChangeRef.current?.("Transcribing…");

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) {
        throw new Error("Recording failed — no audio file.");
      }

      const status = await recording.getStatusAsync();
      const durationMs =
        status.isLoaded && "durationMillis" in status ? status.durationMillis : 0;
      if (durationMs < 400) {
        throw new Error("Recording too short. Hold the mic, speak, then tap stop.");
      }

      const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
      const text = await transcribeAudioFile(uri, mimeType);

      setPartial("");
      onTranscriptChangeRef.current?.(text);
      onFinalTranscriptRef.current?.(text);
    } catch (e) {
      setPartial("");
      onErrorRef.current?.(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setPreparing(false);
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const startNativeSpeech = useCallback(async () => {
    const module = speechRef.current ?? loadSpeechModule();
    if (!module) {
      onErrorRef.current?.("Speech recognition is not available on this device.");
      return;
    }

    transcriptRef.current = "";
    setPartial("");
    onTranscriptChangeRef.current?.("");

    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      onErrorRef.current?.("Microphone and speech recognition permissions are required.");
      return;
    }

    if (!module.isRecognitionAvailable()) {
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
  }, []);

  const stopNativeSpeech = useCallback(() => {
    const module = speechRef.current;
    if (module && listeningRef.current) {
      try {
        module.stop();
      } catch {
        finishNativeSpeech();
      }
      return;
    }
    if (listeningRef.current || preparing) {
      finishNativeSpeech();
    }
  }, [finishNativeSpeech, preparing]);

  const start = useCallback(async () => {
    if (listeningRef.current || preparing) return;

    setPreparing(true);
    try {
      if (useExpoGoWhisper) {
        await startWhisperRecording();
      } else {
        await startNativeSpeech();
      }
    } catch (e) {
      onErrorRef.current?.(e instanceof Error ? e.message : "Could not start voice input");
      listeningRef.current = false;
      setListening(false);
    } finally {
      if (!useExpoGoWhisper) {
        /* native speech clears preparing on "start" event */
      } else if (listeningRef.current) {
        setPreparing(false);
      } else {
        setPreparing(false);
      }
    }
  }, [preparing, startNativeSpeech, startWhisperRecording]);

  const stop = useCallback(() => {
    if (useExpoGoWhisper) {
      void stopWhisperRecording();
      return;
    }
    stopNativeSpeech();
  }, [stopNativeSpeech, stopWhisperRecording]);

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
