import { Audio } from "expo-av";
import { Platform } from "react-native";

/**
 * Configure audio session for microphone recording (Expo Go / native).
 */
export async function prepareNativeAudioForRecording(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Reset the device audio session for TTS playback after recording.
 */
export async function prepareNativeAudioForSpeech(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    /* best-effort */
  }
}
