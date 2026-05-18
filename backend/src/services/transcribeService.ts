import OpenAI, { toFile } from "openai";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export function isTranscribeConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function transcribeAudioBase64(
  audioBase64: string,
  mimeType = "audio/m4a",
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Voice transcription requires OPENAI_API_KEY on the server.");
  }

  const buffer = Buffer.from(audioBase64, "base64");
  if (!buffer.length) {
    throw new Error("Empty audio recording.");
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new Error("Recording is too long. Please keep messages under about a minute.");
  }

  const ext =
    mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") ? "mp4" : "m4a";

  const openai = new OpenAI({ apiKey });
  const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "en",
  });

  const text = result.text?.trim() ?? "";
  if (!text) {
    throw new Error("No speech detected. Try speaking closer to the microphone.");
  }

  return text;
}
