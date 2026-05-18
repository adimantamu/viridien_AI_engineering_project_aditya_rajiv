import { Router } from "express";
import { z } from "zod";
import { isTranscribeConfigured, transcribeAudioBase64 } from "../services/transcribeService.js";

export const transcribeRouter = Router();

const TranscribeBodySchema = z.object({
  audioBase64: z.string().min(32).max(20_000_000),
  mimeType: z.string().max(64).optional(),
});

transcribeRouter.post("/", async (req, res) => {
  if (!isTranscribeConfigured()) {
    res.status(503).json({
      error: "Transcription unavailable",
      message: "Set OPENAI_API_KEY in backend/.env and restart the API.",
    });
    return;
  }

  const parsed = TranscribeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const text = await transcribeAudioBase64(
      parsed.data.audioBase64,
      parsed.data.mimeType ?? "audio/m4a",
    );
    res.json({ text });
  } catch (error) {
    console.error("[transcribe]", error);
    const message = error instanceof Error ? error.message : "Transcription failed";
    res.status(500).json({ error: message });
  }
});
