export interface UseOrderSpeechOptions {
  /** Called before playback — use to stop voice recording / mic. */
  onBeforeSpeak?: () => void;
}

export interface UseOrderSpeechResult {
  /** Audio is actively playing. */
  isPlaying: boolean;
  /** Playback is paused and can be resumed. */
  isPaused: boolean;
  /** There is active or paused audio (show playback controls). */
  hasPlayback: boolean;
  available: boolean;
  activeMessageId: string | null;
  speak: (text: string, messageId?: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}
