import OpenAI from "openai";
import { z } from "zod";
import { getMenuCatalogForPrompt, MENU_ITEMS } from "../data/menu.js";
import type { CartAction, ChatRequest, ChatResponse, OrderAction } from "../types/index.js";
import { orderDetailReply } from "./orderParser.js";
import { parseWithRules } from "./ruleBasedParser.js";

const CartActionSchema = z.object({
  type: z.enum(["ADD", "REMOVE", "UPDATE_QUANTITY", "CLEAR", "SET_MODIFIER"]),
  itemId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  lineId: z.string().optional(),
  modifiers: z.record(z.string()).optional(),
});

const OrderActionSchema = z.object({
  type: z.enum(["CANCEL_ORDER", "CANCEL_ALL_ORDERS"]),
  orderId: z.string().optional(),
  orderNumber: z.number().int().positive().optional(),
});

const AiResponseSchema = z.object({
  reply: z.string(),
  actions: z.array(CartActionSchema),
  orderActions: z.array(OrderActionSchema).optional(),
  suggestions: z.array(z.string()).optional(),
});

const SYSTEM_PROMPT = `You are the AI maître d' for "The Intelligent Bistro", a premium restaurant ordering assistant.
Return valid JSON: reply, actions (cart), orderActions (optional), suggestions (optional).

Cart action types:
- ADD: itemId, quantity (default 1), modifiers (optional)
- REMOVE: itemId, quantity (default 1)
- UPDATE_QUANTITY: itemId, quantity
- CLEAR: no other fields

Order action types:
- CANCEL_ORDER: orderId and/or orderNumber from the orders list in context
- CANCEL_ALL_ORDERS: cancel every active (placed) order

Rules:
- Answer menu questions conversationally (starters, mains, prices, recommendations) using the MENU CATALOG — actions may be empty for pure Q&A
- Parse messy natural language: "Add 2 sandwiches. And some sparkling water. About two waters" → multiple ADD actions; prefer the final quantity when the user corrects themselves
- Match informal language; infer modifiers (size, spice, doneness) from context
- Never invent menu item ids — only use ids from the catalog
- When listing order or cart items, include EVERY line with quantity, name, and price
- If user asks to place order, tell them to use Place order on the Cart tab

MENU CATALOG:
`;

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function processChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const orderDetail = orderDetailReply(request);
  if (orderDetail) {
    return {
      reply: orderDetail,
      actions: [],
      orderActions: [],
      suggestions: ["Cancel my last order", "Show my orders", "View cart"],
      parsedBy: "rules",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return parseWithRules(request);
  }

  try {
    const openai = new OpenAI({ apiKey });
    const cartContext = request.cart?.lines.length
      ? `\nCurrent cart: ${JSON.stringify(request.cart.lines.map((l) => ({ name: l.name, qty: l.quantity })))}`
      : "";

    const ordersContext = request.orders?.length
      ? `\nPlaced orders (include every line when listing):\n${JSON.stringify(
          request.orders.filter((o) => o.status === "placed"),
          null,
          2,
        )}`
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
          content: `${historyText ? `Conversation:\n${historyText}\n\n` : ""}User message: ${request.message}${cartContext}${ordersContext}\n\nRespond with JSON: {"reply":"...","actions":[...],"orderActions":[...],"suggestions":[...]}`,
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
      orderActions: validateOrderActions(parsed.orderActions as OrderAction[] | undefined, request),
      suggestions: parsed.suggestions,
      parsedBy: "openai",
    };
  } catch (error) {
    console.error("[chat] OpenAI failed, using rule-based parser:", error);
    return parseWithRules(request);
  }
}

function validateOrderActions(
  actions: OrderAction[] | undefined,
  request: ChatRequest,
): OrderAction[] {
  if (!actions?.length) return [];
  const placedIds = new Set(request.orders?.filter((o) => o.status === "placed").map((o) => o.id));

  return actions.filter((action) => {
    if (action.type === "CANCEL_ALL_ORDERS") return true;
    if (action.type === "CANCEL_ORDER") {
      if (action.orderId && placedIds.has(action.orderId)) return true;
      if (action.orderNumber) {
        const match = request.orders?.find(
          (o) => o.orderNumber === action.orderNumber && o.status === "placed",
        );
        return Boolean(match);
      }
    }
    return false;
  });
}

function validateActions(actions: CartAction[]): CartAction[] {
  const validIds = new Set(MENU_ITEMS.map((item) => item.id));

  return actions.filter((action) => {
    if (action.type === "CLEAR") return true;
    if (!action.itemId || !validIds.has(action.itemId)) return false;
    return true;
  });
}
