import { useCallback, useEffect, useRef, useState } from "react";
import { chunkTextForSpeech } from "@/src/lib/speechText";
import type { UseOrderSpeechOptions, UseOrderSpeechResult } from "./useOrderSpeech.types";

const WEB_CHUNK_MAX = 3200;

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

function isWebSpeechSynthesisAvailable(): boolean {
  return getSpeechSynthesis() !== null && typeof window.SpeechSynthesisUtterance !== "undefined";
}

export function useOrderSpeech({ onBeforeSpeak }: UseOrderSpeechOptions = {}): UseOrderSpeechResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [available, setAvailable] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const onBeforeSpeakRef = useRef(onBeforeSpeak);
  const chunkQueueRef = useRef<string[]>([]);
  const currentChunkRef = useRef<string | null>(null);
  const messageIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    onBeforeSpeakRef.current = onBeforeSpeak;
  }, [onBeforeSpeak]);

  useEffect(() => {
    setAvailable(isWebSpeechSynthesisAvailable());
    const synthesis = getSpeechSynthesis();
    if (!synthesis) return;

    const warmVoices = () => {
      synthesis.getVoices();
    };
    warmVoices();
    synthesis.addEventListener("voiceschanged", warmVoices);
    return () => synthesis.removeEventListener("voiceschanged", warmVoices);
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

    const synthesis = getSpeechSynthesis();
    if (!synthesis || cancelledRef.current) {
      resetPlayback();
      return;
    }

    const next = chunkQueueRef.current.shift() ?? null;
    if (!next) {
      resetPlayback();
      return;
    }

    currentChunkRef.current = next;

    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      if (!cancelledRef.current && !pausedRef.current) {
        setIsPlaying(true);
        setIsPaused(false);
      }
    };

    utterance.onend = () => {
      currentChunkRef.current = null;
      if (!pausedRef.current && !cancelledRef.current) {
        speakNextChunk();
      }
    };

    utterance.onerror = (event) => {
      if (event.error === "interrupted" || event.error === "canceled") {
        if (pausedRef.current) {
          if (currentChunkRef.current) {
            chunkQueueRef.current.unshift(currentChunkRef.current);
            currentChunkRef.current = null;
          }
          setIsPlaying(false);
          setIsPaused(true);
          return;
        }
        resetPlayback();
        return;
      }
      resetPlayback();
    };

    synthesis.speak(utterance);
  }, [resetPlayback]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    pausedRef.current = false;
    chunkQueueRef.current = [];
    currentChunkRef.current = null;
    getSpeechSynthesis()?.cancel();
    resetPlayback();
  }, [resetPlayback]);

  const speak = useCallback(
    (text: string, messageId?: string) => {
      const trimmed = text.trim();
      if (!trimmed || !isWebSpeechSynthesisAvailable()) return;

      cancelledRef.current = true;
      pausedRef.current = false;
      chunkQueueRef.current = [];
      currentChunkRef.current = null;
      onBeforeSpeakRef.current?.();

      const synthesis = getSpeechSynthesis();
      if (!synthesis) return;

      synthesis.cancel();
      cancelledRef.current = false;

      messageIdRef.current = messageId ?? null;
      setActiveMessageId(messageId ?? null);
      chunkQueueRef.current = chunkTextForSpeech(trimmed, WEB_CHUNK_MAX);
      if (!chunkQueueRef.current.length) return;

      setIsPlaying(true);
      setIsPaused(false);
      speakNextChunk();
    },
    [speakNextChunk],
  );

  const pause = useCallback(() => {
    if (!isPlaying || isPaused) return;

    const synthesis = getSpeechSynthesis();
    if (!synthesis) return;

    pausedRef.current = true;

    if (synthesis.speaking || synthesis.pending) {
      synthesis.pause();
    }

    setIsPlaying(false);
    setIsPaused(true);
  }, [isPlaying, isPaused]);

  const resume = useCallback(() => {
    if (!isPaused) return;

    const synthesis = getSpeechSynthesis();
    if (!synthesis) return;

    pausedRef.current = false;
    cancelledRef.current = false;

    if (synthesis.paused) {
      synthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }

    setIsPlaying(true);
    setIsPaused(false);
    speakNextChunk();
  }, [isPaused, speakNextChunk]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      getSpeechSynthesis()?.cancel();
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
