import "dotenv/config";
import cors from "cors";
import express from "express";
import { menuRouter } from "./routes/menu.js";
import { chatRouter } from "./routes/chat.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "intelligent-bistro-api",
    ai: process.env.OPENAI_API_KEY ? "openai" : "rules",
  });
});

app.use("/api/menu", menuRouter);
app.use("/api/chat", chatRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Intelligent Bistro API running on http://localhost:${PORT}`);
  console.log(`AI mode: ${process.env.OPENAI_API_KEY ? "OpenAI" : "Rule-based (set OPENAI_API_KEY to enable)"}`);
});
