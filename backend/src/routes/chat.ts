import { Router } from "express";
import { z } from "zod";
import { processChatMessage } from "../services/aiService.js";

const ChatBodySchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  cart: z
    .object({
      lines: z.array(
        z.object({
          lineId: z.string(),
          itemId: z.string(),
          name: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          modifiers: z.record(z.string()),
        }),
      ),
      subtotal: z.number(),
    })
    .optional(),
  orders: z
    .array(
      z.object({
        id: z.string(),
        orderNumber: z.number(),
        status: z.enum(["placed", "cancelled"]),
        total: z.number(),
        itemCount: z.number(),
        createdAt: z.number(),
        lines: z.array(
          z.object({
            name: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            lineTotal: z.number(),
            modifiers: z.record(z.string()).optional(),
          }),
        ),
      }),
    )
    .optional(),
  session: z
    .object({
      awaitingConfirmation: z.enum(["place_order", "bulk_add"]).nullable().optional(),
      pendingActions: z
        .array(
          z.object({
            type: z.enum(["ADD", "REMOVE", "UPDATE_QUANTITY", "CLEAR", "SET_MODIFIER"]),
            itemId: z.string().optional(),
            quantity: z.number().optional(),
            lineId: z.string().optional(),
            modifiers: z.record(z.string()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  try {
    const body = ChatBodySchema.parse(req.body);
    const response = await processChatMessage(body);
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: "Failed to process message" });
  }
});
