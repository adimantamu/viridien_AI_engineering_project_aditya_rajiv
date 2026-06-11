import * as FileSystem from "expo-file-system/legacy";
import { getApiBaseUrl } from "./api";

const FETCH_TIMEOUT_MS = 20_000;

export type ApiHealth = {
  ok: boolean;
  voice: "whisper" | "rules-only" | "unknown";
  ai: string;
};

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchApiHealth(): Promise<ApiHealth> {
  const base = getApiBaseUrl();
  try {
    const response = await fetchWithTimeout(`${base}/health`);
    if (!response.ok) {
      return { ok: false, voice: "unknown", ai: "unknown" };
    }
    const data = (await response.json()) as { voice?: string; ai?: string };
    const voice = data.voice === "whisper" ? "whisper" : data.voice === "rules-only" ? "rules-only" : "unknown";
    return { ok: true, voice, ai: data.ai ?? "unknown" };
  } catch {
    return { ok: false, voice: "unknown", ai: "unknown" };
  }
}

/** True when the API is reachable from this device (menu/chat work). */
export async function fetchApiReachable(): Promise<boolean> {
  const health = await fetchApiHealth();
  return health.ok;
}

/** True when Whisper transcription is configured on the server. */
export async function fetchVoiceBackendReady(): Promise<boolean> {
  const health = await fetchApiHealth();
  return health.ok && health.voice === "whisper";
}

export function formatVoiceSetupError(health: ApiHealth): string {
  const api = getApiBaseUrl();

  if (!health.ok) {
    return [
      `Cannot reach the kitchen API at ${api}.`,
      "• Phone and PC on the same Wi‑Fi",
      "• Docker running: docker compose up -d",
      `• Test in phone browser: ${api}/health`,
    ].join("\n");
  }

  if (health.voice !== "whisper") {
    return [
      "Voice transcription needs OPENAI_API_KEY on the server.",
      "1. Add your key to backend/.env",
      "2. Restart: docker compose up --build -d",
      `3. Confirm ${api}/health shows "voice":"whisper"`,
    ].join("\n");
  }

  return "Voice input is unavailable.";
}

export async function transcribeAudioFile(uri: string, mimeType = "audio/m4a"): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64 || base64.length < 32) {
    throw new Error("Recording was empty. Speak closer to the microphone and try again.");
  }

  const api = getApiBaseUrl();
  const response = await fetchWithTimeout(`${api}/api/transcribe`, {
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
    if (response.status === 503) {
      throw new Error(formatVoiceSetupError({ ok: true, voice: "rules-only", ai: "unknown" }));
    }
    throw new Error(payload.error || payload.message || `Transcription failed (${response.status})`);
  }

  const text = payload.text?.trim();
  if (!text) {
    throw new Error("No speech detected in the recording. Try speaking louder and closer to the mic.");
  }

  return text;
}
