export interface UseVoiceInputOptions {
  onTranscriptChange?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (message: string) => void;
}

export interface UseVoiceInputResult {
  listening: boolean;
  preparing: boolean;
  partial: string;
  available: boolean;
  start: () => void | Promise<void>;
  stop: () => void;
  toggle: () => void;
}
