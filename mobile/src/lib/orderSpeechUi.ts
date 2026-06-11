export function getOrderSpeechStatusLine(isPlaying: boolean, isPaused: boolean): string | null {
  if (isPaused) return "Paused — tap play to continue";
  if (isPlaying) return "Reading aloud…";
  return null;
}
