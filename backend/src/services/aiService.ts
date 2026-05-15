import OpenAI from "openai";
import { z } from "zod";
import { getMenuCatalogForPrompt, MENU_ITEMS } from "../data/menu.js";
import type { ChatRequest, ChatResponse, CartAction } from "../types/index.js";
import { parseWithRules } from "./ruleBasedParser.js";

const CartActionSchema = z.object({
  type: z.enum(["ADD", "REMOVE", "UPDATE_QUANTITY", "CLEAR", "SET_MODIFIER"]),
  itemId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  lineId: z.string().optional(),
  modifiers: z.record(z.string()).optional(),
});

const AiResponseSchema = z.object({
  reply: z.string(),
  actions: z.array(CartActionSchema),
  suggestions: z.array(z.string()).optional(),
});

const SYSTEM_PROMPT = `You are the AI maître d' for "The Intelligent Bistro", a premium restaurant ordering assistant.
Parse the user's message into cart actions using ONLY menu item ids from the catalog below.
Return valid JSON with: reply (friendly, concise), actions (array), suggestions (optional, 2-3 short prompts).

Action types:
- ADD: itemId, quantity (default 1), modifiers (optional object, e.g. {"size":"large","spice":"hot"})
- REMOVE: itemId, quantity (default 1)
- UPDATE_QUANTITY: itemId, quantity
- CLEAR: no other fields

Rules:
- Match user intent even with informal language ("couple of burgers" = quantity 2)
- Infer modifiers from context (large water -> size: large)
- If unclear, return empty actions and ask a clarifying question in reply
- Never invent menu item ids

MENU CATALOG:
`;

export async function processChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return parseWithRules(request);
  }

  try {
    const openai = new OpenAI({ apiKey });
    const cartContext = request.cart?.lines.length
      ? `\nCurrent cart: ${JSON.stringify(request.cart.lines.map((l) => ({ name: l.name, qty: l.quantity })))}`
      : "";

    const historyText =
      request.history
        ?.slice(-6)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n") ?? "";

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + getMenuCatalogForPrompt(),
        },
        {
          role: "user",
          content: `${historyText ? `Conversation:\n${historyText}\n\n` : ""}User message: ${request.message}${cartContext}\n\nRespond with JSON: {"reply":"...","actions":[...],"suggestions":[...]}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");

    const parsed = AiResponseSchema.parse(JSON.parse(raw));
    const actions = validateActions(parsed.actions as CartAction[]);

    return {
      reply: parsed.reply,
      actions,
      suggestions: parsed.suggestions,
      parsedBy: "openai",
    };
  } catch {
    const fallback = parseWithRules(request);
    return {
      ...fallback,
      reply: `${fallback.reply} (Using offline parser — set OPENAI_API_KEY for full AI.)`,
    };
  }
}

function validateActions(actions: CartAction[]): CartAction[] {
  const validIds = new Set(MENU_ITEMS.map((item) => item.id));

  return actions.filter((action) => {
    if (action.type === "CLEAR") return true;
    if (!action.itemId || !validIds.has(action.itemId)) return false;
    return true;
  });
}
