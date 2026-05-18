import OpenAI from "openai";
import { z } from "zod";
import { getMenuCatalogForPrompt, MENU_ITEMS } from "../data/menu.js";
import type { CartAction, ChatRequest, ChatResponse, OrderAction } from "../types/index.js";
import {
  getGreetingReply,
  handleStructuredChat,
  HIGH_QUANTITY_THRESHOLD,
  isGreetingMessage,
  splitByQuantityThreshold,
} from "./chatOrchestrator.js";
import { analyzeMealGaps, getCartCategories } from "./mealSuggestions.js";
import { dedupeCartActions } from "./orderSegmentParser.js";

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

Cart action types: ADD, REMOVE, UPDATE_QUANTITY, CLEAR
Order action types: CANCEL_ORDER, CANCEL_ALL_ORDERS

Rules:
- Answer menu questions warmly using the MENU CATALOG
- When user says cancel order / cancel my last order → return CANCEL_ORDER orderActions (do NOT list order items as the only response)
- When user wants to place/checkout order → summarize cart and ask them to reply "yes" to confirm (do not place in actions)
- Parse messy multi-item orders into multiple ADD actions
- For quantities over ${HIGH_QUANTITY_THRESHOLD} of one item, mention you need confirmation in your reply
- When user asks for suggestions/recommendations for a category (bowls, starters, drinks, etc.), list ONLY items from that category — never unrelated chef picks
- Suggest real combos (e.g. burger + fries + drink; soup + bread; dessert + espresso)
- If the cart context lists missing meal categories, proactively suggest 2–3 items from those missing categories
- Never invent menu item ids

MENU CATALOG:
`;

function guardHighQuantityActions(
  response: ChatResponse,
  session: ChatRequest["session"],
): ChatResponse {
  if (!response.actions.length) {
    return { ...response, sessionContext: session ?? { awaitingConfirmation: null } };
  }

  const deduped = dedupeCartActions(response.actions);
  const { immediate, pending } = splitByQuantityThreshold(deduped);

  if (!pending.length) {
    return {
      ...response,
      actions: immediate,
      sessionContext: session?.awaitingConfirmation ? session : { awaitingConfirmation: null },
    };
  }

  const pendingDesc = pending
    .map((a) => {
      const item = MENU_ITEMS.find((i) => i.id === a.itemId);
      return `${a.quantity}× ${item?.name ?? a.itemId}`;
    })
    .join(", ");

  let reply = response.reply;
  if (!reply.toLowerCase().includes("confirm")) {
    reply += `\n\nPlease confirm the large quantity: ${pendingDesc}. Reply yes or no.`;
  }

  return {
    ...response,
    reply,
    actions: immediate,
    sessionContext: {
      awaitingConfirmation: "bulk_add",
      pendingActions: pending,
    },
    suggestions: ["Yes", "No", "View cart"],
  };
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function processChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const session = request.session;

  if (isGreetingMessage(request.message) && (!request.history?.length || request.history.length <= 1)) {
    return getGreetingReply();
  }

  const structured = handleStructuredChat(request, session);
  if (structured) return structured;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      reply: 'Tell me what you\'d like — e.g. "Add two burgers" or "What are your starters?"',
      actions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["What are your starters?", "Add spicy chicken sandwich", "Place order"],
      parsedBy: "rules",
    };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const cartCats = getCartCategories(request);
    const missingCats = analyzeMealGaps(cartCats);
    const cartContext = request.cart?.lines.length
      ? `\nCurrent cart: ${JSON.stringify(request.cart.lines.map((l) => ({ name: l.name, qty: l.quantity })))}\nCart categories present: ${[...cartCats].join(", ") || "none"}${missingCats.length ? `\nMissing for a balanced meal: ${missingCats.join(", ")}` : ""}`
      : "";

    const ordersContext = request.orders?.length
      ? `\nPlaced orders:\n${JSON.stringify(request.orders.filter((o) => o.status === "placed"), null, 2)}`
      : "";

    const sessionContext = session?.awaitingConfirmation
      ? `\nSession: awaiting confirmation "${session.awaitingConfirmation}"${session.pendingActions?.length ? ` pending actions: ${JSON.stringify(session.pendingActions)}` : ""}`
      : "";

    const historyText =
      request.history
        ?.slice(-8)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n") ?? "";

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT + getMenuCatalogForPrompt() },
        {
          role: "user",
          content: `${historyText ? `Conversation:\n${historyText}\n\n` : ""}User: ${request.message}${cartContext}${ordersContext}${sessionContext}\n\nJSON: {"reply","actions","orderActions","suggestions"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");

    const parsed = AiResponseSchema.parse(JSON.parse(raw));
    const actions = validateActions(parsed.actions as CartAction[]);
    const orderActions = validateOrderActions(
      parsed.orderActions as OrderAction[] | undefined,
      request,
    );

    const base: ChatResponse = {
      reply: parsed.reply,
      actions,
      orderActions,
      suggestions: parsed.suggestions,
      parsedBy: "openai",
    };

    if (orderActions.length) {
      return {
        ...base,
        actions: [],
        sessionContext: { awaitingConfirmation: null, pendingActions: [] },
      };
    }

    if (wantsPlaceOrderFromAi(request.message) && request.cart?.lines.length) {
      return (
        handleStructuredChat(request, session) ?? {
          reply: parsed.reply,
          actions: [],
          sessionContext: { awaitingConfirmation: "place_order" },
          suggestions: ["Yes", "No", "View cart"],
          parsedBy: "openai",
        }
      );
    }

    return guardHighQuantityActions(base, session);
  } catch (error) {
    console.error("[chat] OpenAI failed:", error);
    const fallback = handleStructuredChat(request, session);
    if (fallback) return fallback;
    return {
      reply:
        "I'm having trouble reaching the AI service right now, but you can still order from the Menu tab. Try again in a moment, or use shorter phrases like \"Add 4 craft lemonade and 2 salmon.\"",
      actions: [],
      sessionContext: session ?? { awaitingConfirmation: null },
      suggestions: ["Add truffle fries", "What are your starters?", "View cart"],
      parsedBy: "rules",
    };
  }
}

function wantsPlaceOrderFromAi(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(place|submit|checkout)\b.*\b(order|cart)\b/i.test(lower) ||
    /^(place order|checkout)$/i.test(message.trim())
  );
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
        return Boolean(
          request.orders?.find(
            (o) => o.orderNumber === action.orderNumber && o.status === "placed",
          ),
        );
      }
      return placedIds.size > 0;
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
