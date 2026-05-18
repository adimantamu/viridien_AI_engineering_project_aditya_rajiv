import { Alert, Platform } from "react-native";

export function showVoiceError(message: string): void {
  if (Platform.OS === "web") {
    if (typeof globalThis !== "undefined" && "alert" in globalThis) {
      globalThis.alert(`Voice input\n\n${message}`);
    }
    return;
  }
  Alert.alert("Voice input", message);
}

export type VoiceStatusInput = {
  isWeb: boolean;
  listening: boolean;
  preparing: boolean;
  partial: string;
};

export function getVoiceStatusLine(input: VoiceStatusInput): string | null {
  const { isWeb, listening, preparing, partial } = input;
  const active = listening || preparing;
  if (!active) return null;

  if (isWeb) {
    if (preparing && !listening) return "Starting microphone…";
    return "Listening… speak now";
  }

  if (preparing && !listening) return "Transcribing…";
  if (listening && partial.startsWith("Recording")) {
    return "Recording… tap stop when done";
  }
  if (preparing) return "Starting microphone…";
  return "Listening… speak now";
}

export function getVoicePlaceholder(input: VoiceStatusInput): string {
  const { isWeb, listening, preparing, partial } = input;

  if (isWeb) {
    if (preparing && !listening) return "Opening microphone…";
    if (listening) return partial.trim() || "Speak now — words appear here…";
    return "Add two spicy chicken sandwiches…";
  }

  if (preparing && !listening) return "Transcribing your speech…";
  if (preparing) return "Opening microphone…";
  if (listening && partial.startsWith("Recording")) {
    return "Recording… tap stop when finished";
  }
  if (listening) return partial.trim() || "Speak now…";
  return "Add two spicy chicken sandwiches…";
}
