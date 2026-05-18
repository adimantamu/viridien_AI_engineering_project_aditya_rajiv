import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import {

  getWebSpeechSupport,

  WebSpeechSession,

  type WebSpeechState,

  type WebSpeechSupport,

} from "@/src/lib/webSpeechRecognition";

import type { UseVoiceInputOptions, UseVoiceInputResult } from "./useVoiceInput.types";



function createSession(

  transcriptRef: MutableRefObject<string>,

  applyState: (state: WebSpeechState) => void,

  setPartial: (v: string) => void,

  setVoiceError: (v: string | null) => void,

  onTranscriptChangeRef: MutableRefObject<UseVoiceInputOptions["onTranscriptChange"]>,

  onFinalTranscriptRef: MutableRefObject<UseVoiceInputOptions["onFinalTranscript"]>,

  onErrorRef: MutableRefObject<UseVoiceInputOptions["onError"]>,

): WebSpeechSession {

  return new WebSpeechSession({

    onTranscript: (text) => {

      transcriptRef.current = text;

      setPartial(text);

      setVoiceError(null);

      onTranscriptChangeRef.current?.(text);

    },

    onState: (state, message) => {

      applyState(state);

      if (state === "listening") {

        setVoiceError(null);

      }

      if (state === "error" && message) {

        setVoiceError(message);

        onErrorRef.current?.(message);

      }

    },

  });

}



export function useVoiceInput({

  onTranscriptChange,

  onFinalTranscript,

  onError,

}: UseVoiceInputOptions): UseVoiceInputResult {

  const [listening, setListening] = useState(false);

  const [preparing, setPreparing] = useState(false);

  const [reconnecting, setReconnecting] = useState(false);

  const [partial, setPartial] = useState("");

  const [available, setAvailable] = useState(false);

  const [speechSupport, setSpeechSupport] = useState<WebSpeechSupport | null>(null);

  const [voiceError, setVoiceError] = useState<string | null>(null);



  const sessionRef = useRef<WebSpeechSession | null>(null);

  const transcriptRef = useRef("");

  const busyRef = useRef(false);

  const toggleLockRef = useRef(false);



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

    const support = getWebSpeechSupport();

    setSpeechSupport(support);

    setAvailable(support.available);

    if (!support.available) {

      const msg = [support.unavailableReason, support.hint].filter(Boolean).join(" ");

      if (msg) setVoiceError(msg);

    }

  }, []);



  const applyState = useCallback((state: WebSpeechState) => {

    setReconnecting(state === "reconnecting");

    setPreparing(state === "preparing" || state === "reconnecting");

    setListening(state === "listening" || state === "reconnecting");

    if (state === "idle" || state === "error") {

      setPreparing(false);

      setListening(false);

      setReconnecting(false);

      busyRef.current = false;

    }

  }, []);



  const stop = useCallback(async () => {

    const text = transcriptRef.current.trim();

    const session = sessionRef.current;



    if (!session) {

      applyState("idle");

      busyRef.current = false;

      return;

    }



    sessionRef.current = null;

    await session.stop();

    busyRef.current = false;

    applyState("idle");



    if (text) {

      onFinalTranscriptRef.current?.(text);

    }

  }, [applyState]);



  useEffect(() => {

    return () => {

      const session = sessionRef.current;

      sessionRef.current = null;

      if (session) {

        void session.stop();

      }

    };

  }, []);



  const start = useCallback(async () => {

    if (!available) {

      const support = getWebSpeechSupport();

      const msg =

        [support.unavailableReason, support.hint].filter(Boolean).join(" ") ||

        "Voice input needs Microsoft Edge or Chrome on desktop.";

      setVoiceError(msg);

      onErrorRef.current?.(msg);

      return;

    }



    if (busyRef.current) {

      return;

    }



    if (sessionRef.current) {

      await stop();

    }



    busyRef.current = true;

    setVoiceError(null);

    transcriptRef.current = "";

    setPartial("");

    onTranscriptChangeRef.current?.("");



    const session = createSession(

      transcriptRef,

      applyState,

      setPartial,

      setVoiceError,

      onTranscriptChangeRef,

      onFinalTranscriptRef,

      onErrorRef,

    );

    sessionRef.current = session;



    await session.start();



    if (!session.isActive) {

      sessionRef.current = null;

      busyRef.current = false;

    }

  }, [available, applyState, stop]);



  const toggle = useCallback(async () => {

    if (toggleLockRef.current) return;

    toggleLockRef.current = true;



    try {

      if (sessionRef.current?.isActive || listening || preparing || reconnecting) {

        await stop();

      } else {

        await start();

      }

    } finally {

      setTimeout(() => {

        toggleLockRef.current = false;

      }, 600);

    }

  }, [listening, preparing, reconnecting, start, stop]);



  return {

    listening,

    preparing,

    reconnecting,

    partial,

    available,

    speechSupport,

    voiceError,

    start,

    stop,

    toggle,

  };

}

