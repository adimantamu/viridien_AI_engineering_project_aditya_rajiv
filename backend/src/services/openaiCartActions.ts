import OpenAI from "openai";
import { z } from "zod";
import { getMenuCatalogForPrompt, MENU_ITEMS } from "../data/menu.js";
import { defaultModifiersForItem } from "../data/menuModifiers.js";
import type { CartAction, ChatRequest } from "../types/index.js";
import { dedupeCartActions, reconcileAiCartActions } from "./orderSegmentParser.js";

function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

const CartActionSchema = z.object({
  type: z.enum(["ADD", "REMOVE", "UPDATE_QUANTITY", "CLEAR", "SET_MODIFIER"]),
  itemId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  modifiers: z.record(z.string()).optional(),
});

const CartParseSchema = z.object({
  actions: z.array(CartActionSchema),
});

const CART_PARSE_PROMPT = `You parse restaurant cart commands into structured cart actions. Return JSON only: {"actions":[...]}

Each menu line lists itemId, name, sizes, aliases — use exact itemId values.

Action types: ADD, REMOVE, UPDATE_QUANTITY, CLEAR, SET_MODIFIER

RULES (critical):
1. Every distinct item with its own quantity = separate action. Never merge quantities across different dishes.
2. "with three lemonades" / "along with 2 fries" / "plus four waters" AFTER other items = ADD those items with THAT quantity — do NOT apply their quantity to the previous dish.
   Example: "7 burgers with 3 lemonades" → ADD burger qty 7, ADD lemonade qty 3 (NOT lemonade qty 7).
3. "and" separates items: "4 sandwiches and 7 burgers and 3 drinks" → three ADD actions.
4. Word numbers: one=1, two=2, three=3, four=4, five=5, six=6, seven=7, eight=8, nine=9, ten=10, dozen=12.
5. Size modifier id is always "size" (small|medium|large). Default {"size":"medium"} on ADD when size not stated.
6. "remove two large waters" → REMOVE with quantity and modifiers.
7. "change burger to large" → SET_MODIFIER.
8. "clear cart" → CLEAR.
9. Only output actions explicitly requested in the guest's latest message; do not invent items.
10. If current cart contents are provided, they are READ-ONLY context. Never output ADD for items already in the cart unless the guest names them again in this message (e.g. "add another water").
11. "Add craft lavender lemonade" → exactly one ADD for craft-lemonade — not every cart line.

MENU:
`;

function validateCartActions(actions: CartAction[]): CartAction[] {
  const validIds = new Set(MENU_ITEMS.map((i) => i.id));
  return actions.filter((action) => {
    if (action.type === "CLEAR") return true;
    if (action.type === "SET_MODIFIER") {
      return Boolean(action.itemId && validIds.has(action.itemId) && action.modifiers?.size);
    }
    if (!action.itemId || !validIds.has(action.itemId)) return false;
    return true;
  });
}

function applyDefaultModifiers(actions: CartAction[]): CartAction[] {
  return actions.map((action) => {
    if (action.type !== "ADD" || !action.itemId) return action;
    const item = MENU_ITEMS.find((i) => i.id === action.itemId);
    if (!item) return action;
    const defaults = defaultModifiersForItem(item);
    return {
      ...action,
      modifiers: { ...defaults, ...action.modifiers },
    };
  });
}

/** OpenAI cart parser — primary path for add/remove/update/clear when API key is set. */
export async function parseCartActionsWithOpenAI(
  request: ChatRequest,
): Promise<CartAction[] | null> {
  if (!isOpenAiConfigured()) return null;

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const openai = new OpenAI({ apiKey });

  const history =
    request.history
      ?.slice(-8)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n") ?? "";

  const cartContext = request.cart?.lines.length
    ? `\nCart already contains (do NOT re-add unless named in this message): ${request.cart.lines
        .map((l) => `${l.quantity}x ${l.name} (${l.itemId})`)
        .join("; ")}`
    : "";

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CART_PARSE_PROMPT + getMenuCatalogForPrompt() },
      {
        role: "user",
        content: `${history ? `Conversation:\n${history}\n\n` : ""}Guest message: ${request.message}${cartContext}\n\nReturn cart actions JSON.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  const parsed = CartParseSchema.parse(JSON.parse(raw));
  const validated = validateCartActions(parsed.actions as CartAction[]);
  if (!validated.length) return null;

  const withDefaults = applyDefaultModifiers(validated);
  return reconcileAiCartActions(request.message, withDefaults);
}

