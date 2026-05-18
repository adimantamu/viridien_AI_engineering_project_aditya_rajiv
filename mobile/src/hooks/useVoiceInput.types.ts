export interface UseVoiceInputOptions {
  onTranscriptChange?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (message: string) => void;
}

export interface UseVoiceInputResult {
  listening: boolean;
  preparing: boolean;
  /** Web: recovering from Chrome speech hiccup — keep mic UI active */
  reconnecting?: boolean;
  partial: string;
  available: boolean;
  /** Web only: browser / secure-context diagnostics */
  speechSupport?: import("@/src/lib/webSpeechRecognition").WebSpeechSupport | null;
  /** Web only: last voice error for inline UI */
  voiceError?: string | null;
  start: () => void | Promise<void>;
  stop: () => void;
  toggle: () => void;
}
