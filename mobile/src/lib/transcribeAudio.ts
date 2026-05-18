import * as FileSystem from "expo-file-system";
import { getApiBaseUrl } from "./api";

export async function transcribeAudioFile(uri: string, mimeType = "audio/m4a"): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch(`${getApiBaseUrl()}/api/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64: base64, mimeType }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Transcription failed (${response.status})`);
  }

  const text = payload.text?.trim();
  if (!text) {
    throw new Error("No speech detected in the recording.");
  }

  return text;
}

export async function fetchVoiceBackendReady(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`);
    if (!response.ok) return false;
    const data = (await response.json()) as { voice?: string };
    return data.voice === "whisper";
  } catch {
    return false;
  }
}
