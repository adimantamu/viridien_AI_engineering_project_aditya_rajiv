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
import { resolveMenuBrowse } from "./menuBrowseResolver.js";
import { messageHasMenuInquiry } from "./messageNormalizer.js";
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
Return valid JSON only: {"reply": string, "actions": [], "orderActions": [], "suggestions": string[]}

You MUST understand natural, casual phrasing including:
- "please tell me what are there for starters" → list ALL Starters from the menu with prices
- "what are the options in starters and bowls" → list EVERY item in BOTH Starters AND Bowls with prices (never only the first category)
- "what do you have for drinks" / "any desserts?" → list that category only
- Typos and filler words (please, tell me, there, what are) are normal

Cart action types: ADD, REMOVE, UPDATE_QUANTITY, CLEAR
Order action types: CANCEL_ORDER, CANCEL_ALL_ORDERS

Rules:
- Menu browsing questions: answer from MENU CATALOG only — list items with prices, never say you cannot help
- Never respond with generic errors; always give a useful menu or cart answer
- Cancel order → CANCEL_ORDER orderActions
- Place/checkout → summarize cart, ask user to reply "yes" (do not place in actions)
- Parse multi-item orders into multiple ADD actions with correct itemIds
- "with three lemonades" after other items = ADD lemonades qty 3 — never attach that quantity to the previous dish
- "add 4 sandwiches and 7 burgers with 3 lemonades" → ADD sandwich×4, ADD burger×7, ADD lemonade×3
- "remove one X and add Y" → REMOVE action for X plus ADD for Y in the same response
- Chained commands: "remove 3 waters and remove 2 sandwiches and then add 3 burgers" → separate actions with exact quantities (3, 2, 3) — never default to quantity 1 when a number or word (three, two) is given
- Sizes: every item has size modifier id "size" with options small, medium, large (prices in catalog sizes={...}). Include modifiers on ADD/REMOVE when user says a size.
- "add two large sparkling waters" → ADD qty 2, modifiers: {"size":"large"}
- "remove the small fries" → REMOVE with modifiers {"size":"small"}
- "change my burger to large" / "make the water medium" → SET_MODIFIER with modifiers {"size":"large"} etc.
- If no size specified on ADD, default modifiers {"size":"medium"}
- "remove", "delete", "take off" → REMOVE (decrease quantity in cart); match size when specified
- Quantities over ${HIGH_QUANTITY_THRESHOLD} need confirmation in reply
- Single-category questions list only that category; multi-category questions must cover every category the user named
- suggestions: 3–5 short tap-to-send phrases (e.g. "Add truffle fries", "What are your desserts?")

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

async function rulesFallback(
  request: ChatRequest,
  session?: ChatRequest["session"],
): Promise<ChatResponse> {
  const menu = await resolveMenuBrowse(request);
  if (menu) return menu;

  const structured = await handleStructuredChat(request, session);
  if (structured) return structured;

  if (messageHasMenuInquiry(request.message)) {
    return {
      reply:
        '🥗 Try asking "What are your starters?" or "Show me the menu" — I can list every category with prices.',
      actions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["What are your starters?", "What are your desserts?", "Show me the menu"],
      parsedBy: "rules",
    };
  }

  return {
    reply:
      'Tell me what you\'d like — e.g. "Add two burgers", "What are your starters?", or "Place order".',
    actions: [],
    sessionContext: { awaitingConfirmation: null },
    suggestions: ["What are your starters?", "Add spicy chicken sandwich", "Place order"],
    parsedBy: "rules",
  };
}

export async function processChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const session = request.session;

  if (isGreetingMessage(request.message) && (!request.history?.length || request.history.length <= 1)) {
    return getGreetingReply();
  }

  const structured = await handleStructuredChat(request, session);
  if (structured) return structured;

  if (messageHasMenuInquiry(request.message)) {
    const menu = await resolveMenuBrowse(request);
    if (menu) return menu;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return rulesFallback(request, session);
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
        ?.slice(-10)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n") ?? "";

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT + getMenuCatalogForPrompt() },
        {
          role: "user",
          content: `${historyText ? `Conversation:\n${historyText}\n\n` : ""}User: ${request.message}${cartContext}${ordersContext}${sessionContext}\n\nRespond with JSON only.`,
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
      const placeFlow = await handleStructuredChat(request, session);
      if (placeFlow) return placeFlow;
    }

    return guardHighQuantityActions(base, session);
  } catch (error) {
    console.error("[chat] OpenAI failed:", error);
    return rulesFallback(request, session);
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
    if (action.type === "SET_MODIFIER") {
      return Boolean(action.itemId && validIds.has(action.itemId) && action.modifiers?.size);
    }
    if (!action.itemId || !validIds.has(action.itemId)) return false;
    return true;
  });
}
