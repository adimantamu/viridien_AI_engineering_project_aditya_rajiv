import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { prepareNativeAudioForSpeech } from "@/src/lib/nativeAudioForSpeech";
import { chunkTextForSpeech } from "@/src/lib/speechText";
import type { UseOrderSpeechOptions, UseOrderSpeechResult } from "./useOrderSpeech.types";

const SPEECH_OPTIONS = {
  language: "en-US",
  pitch: 1.0,
  rate: Platform.OS === "android" ? 0.95 : 0.92,
  volume: 1.0,
  useApplicationAudioSession: false,
} as const;

const supportsNativePause = Platform.OS === "ios";

/** Brief gap after stopping prior audio — helps Expo Go on physical devices. */
const NATIVE_SPEAK_DELAY_MS = Platform.OS === "ios" ? 80 : 40;

export function useOrderSpeech({ onBeforeSpeak }: UseOrderSpeechOptions = {}): UseOrderSpeechResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [available, setAvailable] = useState(true);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const onBeforeSpeakRef = useRef(onBeforeSpeak);
  const chunkQueueRef = useRef<string[]>([]);
  const currentChunkRef = useRef<string | null>(null);
  const messageIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);
  const speakGenerationRef = useRef(0);

  useEffect(() => {
    onBeforeSpeakRef.current = onBeforeSpeak;
  }, [onBeforeSpeak]);

  useEffect(() => {
    let mounted = true;
    void Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (mounted) setAvailable(voices.length > 0);
      })
      .catch(() => {
        if (mounted) setAvailable(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const resetPlayback = useCallback(() => {
    chunkQueueRef.current = [];
    currentChunkRef.current = null;
    messageIdRef.current = null;
    pausedRef.current = false;
    cancelledRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setActiveMessageId(null);
  }, []);

  const speakNextChunk = useCallback(() => {
    if (pausedRef.current) {
      setIsPlaying(false);
      setIsPaused(true);
      return;
    }

    if (cancelledRef.current) {
      resetPlayback();
      return;
    }

    const next = chunkQueueRef.current.shift() ?? null;
    if (!next) {
      resetPlayback();
      return;
    }

    currentChunkRef.current = next;

    Speech.speak(next, {
      ...SPEECH_OPTIONS,
      onStart: () => {
        if (!cancelledRef.current && !pausedRef.current) {
          setIsPlaying(true);
          setIsPaused(false);
        }
      },
      onDone: () => {
        currentChunkRef.current = null;
        if (!pausedRef.current && !cancelledRef.current) {
          speakNextChunk();
        }
      },
      onStopped: () => {
        if (pausedRef.current) {
          if (currentChunkRef.current) {
            chunkQueueRef.current.unshift(currentChunkRef.current);
            currentChunkRef.current = null;
          }
          setIsPlaying(false);
          setIsPaused(true);
          return;
        }

        if (cancelledRef.current) {
          resetPlayback();
          return;
        }

        currentChunkRef.current = null;
        speakNextChunk();
      },
      onError: () => {
        resetPlayback();
      },
    });
  }, [resetPlayback]);

  const stop = useCallback(() => {
    speakGenerationRef.current += 1;
    cancelledRef.current = true;
    pausedRef.current = false;
    void Speech.stop();
    resetPlayback();
  }, [resetPlayback]);

  const speak = useCallback(
    (text: string, messageId?: string) => {
      const trimmed = text.trim();
      if (!trimmed || !available) return;

      const generation = speakGenerationRef.current + 1;
      speakGenerationRef.current = generation;
      cancelledRef.current = true;
      pausedRef.current = false;
      chunkQueueRef.current = [];
      currentChunkRef.current = null;
      onBeforeSpeakRef.current?.();

      void (async () => {
        try {
          await Speech.stop();
          await prepareNativeAudioForSpeech();
          if (NATIVE_SPEAK_DELAY_MS > 0) {
            await new Promise((resolve) => setTimeout(resolve, NATIVE_SPEAK_DELAY_MS));
          }

          if (generation !== speakGenerationRef.current) return;

          cancelledRef.current = false;
          pausedRef.current = false;
          messageIdRef.current = messageId ?? null;
          setActiveMessageId(messageId ?? null);

          const maxLen = Math.max(400, Speech.maxSpeechInputLength ?? 3500);
          chunkQueueRef.current = chunkTextForSpeech(trimmed, maxLen);
          if (!chunkQueueRef.current.length) return;

          setIsPlaying(true);
          setIsPaused(false);
          speakNextChunk();
        } catch {
          resetPlayback();
        }
      })();
    },
    [available, speakNextChunk, resetPlayback],
  );

  const pause = useCallback(() => {
    if (!isPlaying || isPaused) return;

    pausedRef.current = true;

    if (supportsNativePause) {
      void Speech.pause()
        .then(() => {
          setIsPlaying(false);
          setIsPaused(true);
        })
        .catch(() => {
          cancelledRef.current = true;
          void Speech.stop();
        });
      return;
    }

    cancelledRef.current = true;
    void Speech.stop();
  }, [isPlaying, isPaused]);

  const resume = useCallback(() => {
    if (!isPaused) return;

    pausedRef.current = false;
    cancelledRef.current = false;

    void (async () => {
      await prepareNativeAudioForSpeech();

      if (supportsNativePause) {
        const stillSpeaking = await Speech.isSpeakingAsync();
        if (stillSpeaking) {
          await Speech.resume();
          setIsPlaying(true);
          setIsPaused(false);
          return;
        }
      }

      setIsPlaying(true);
      setIsPaused(false);
      speakNextChunk();
    })();
  }, [isPaused, speakNextChunk]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      void Speech.stop();
    };
  }, []);

  return {
    isPlaying,
    isPaused,
    hasPlayback: isPlaying || isPaused,
    available,
    activeMessageId,
    speak,
    pause,
    resume,
    stop,
  };
}
