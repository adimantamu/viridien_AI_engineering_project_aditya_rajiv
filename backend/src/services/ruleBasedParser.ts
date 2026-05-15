import { MENU_ITEMS, getMenuItemById } from "../data/menu.js";
import type { CartAction, ChatRequest, ChatResponse } from "../types/index.js";

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  couple: 2,
  few: 3,
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function extractQuantity(segment: string): { quantity: number; rest: string } {
  const digitMatch = segment.match(/^(\d+)\s+/);
  if (digitMatch) {
    return { quantity: parseInt(digitMatch[1], 10), rest: segment.slice(digitMatch[0].length) };
  }
  for (const [word, qty] of Object.entries(NUMBER_WORDS)) {
    const pattern = new RegExp(`^${word}\\s+`, "i");
    if (pattern.test(segment)) {
      return { quantity: qty, rest: segment.replace(pattern, "") };
    }
  }
  return { quantity: 1, rest: segment };
}

function matchMenuItem(segment: string) {
  const normalized = normalize(segment);
  let best: { item: (typeof MENU_ITEMS)[0]; score: number } | null = null;

  for (const item of MENU_ITEMS) {
    const candidates = [item.name, ...(item.aliases ?? [])].map(normalize);
    for (const candidate of candidates) {
      if (normalized.includes(candidate) || candidate.includes(normalized)) {
        const score = candidate.length;
        if (!best || score > best.score) {
          best = { item, score };
        }
      }
    }
  }
  return best?.item;
}

function extractModifiers(segment: string, item: (typeof MENU_ITEMS)[0]): Record<string, string> {
  const mods: Record<string, string> = {};
  const lower = segment.toLowerCase();

  if (item.modifiers) {
    for (const modifier of item.modifiers) {
      for (const option of modifier.options) {
        const label = option.label.toLowerCase();
        const id = option.id.toLowerCase();
        if (lower.includes(label) || lower.includes(id.replace("-", " "))) {
          mods[modifier.id] = option.id;
        }
      }
    }
  }

  if (item.id === "water" || item.id === "sparkling-water") {
    if (/\blarge\b/.test(lower)) mods.size = "large";
    else if (/\bmedium\b/.test(lower)) mods.size = "medium";
    else if (/\bsmall\b/.test(lower)) mods.size = "small";
  }

  if (item.id === "spicy-chicken-sandwich") {
    if (/\bextra[- ]?hot\b/.test(lower)) mods.spice = "extra-hot";
    else if (/\bhot\b|\bspicy\b/.test(lower)) mods.spice = mods.spice ?? "hot";
    else if (/\bmild\b/.test(lower)) mods.spice = "mild";
  }

  return mods;
}

function splitOrderSegments(message: string): string[] {
  const cleaned = message
    .replace(/^(add|get|order|i want|i'd like|please add|put)\s+/i, "")
    .replace(/^(remove|delete|take off)\s+/i, "REMOVE ")
    .trim();

  if (/^(clear|empty)\s+(my\s+)?cart/i.test(cleaned)) {
    return ["__CLEAR__"];
  }

  return cleaned
    .split(/\s+and\s+|,\s*|\s+plus\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRemoveActions(message: string): CartAction[] {
  const actions: CartAction[] = [];
  const lower = normalize(message);
  if (!/(remove|delete|take off|cancel)/.test(lower)) return actions;

  const segments = message
    .replace(/.*(remove|delete|take off|cancel)\s+/i, "")
    .split(/\s+and\s+|,\s*/i);

  for (let segment of segments) {
    const { quantity, rest } = extractQuantity(segment);
    const item = matchMenuItem(rest);
    if (item) {
      actions.push({ type: "REMOVE", itemId: item.id, quantity });
    }
  }
  return actions;
}

function parseAddActions(message: string): CartAction[] {
  const actions: CartAction[] = [];
  const lower = normalize(message);

  if (/^(clear|empty)\s+(my\s+)?cart/.test(lower) || lower === "clear cart") {
    return [{ type: "CLEAR" }];
  }

  const segments = splitOrderSegments(message);
  for (const segment of segments) {
    if (segment === "__CLEAR__") {
      actions.push({ type: "CLEAR" });
      continue;
    }
    if (/^REMOVE /i.test(segment)) continue;

    const isRemove = /^remove\s+/i.test(segment);
    const body = segment.replace(/^REMOVE\s+/i, "");
    const { quantity, rest } = extractQuantity(body);
    const item = matchMenuItem(rest);
    if (!item) continue;

    const modifiers = extractModifiers(rest, item);
    if (item.modifiers?.some((m) => m.required) && !modifiers.size && item.id.includes("water")) {
      modifiers.size = "medium";
    }

    actions.push({
      type: isRemove ? "REMOVE" : "ADD",
      itemId: item.id,
      quantity,
      modifiers: Object.keys(modifiers).length ? modifiers : undefined,
    });
  }
  return actions;
}

function parseUpdateQuantity(message: string): CartAction[] {
  const match = message.match(
    /(change|update|set)\s+(.+?)\s+to\s+(\d+)|make\s+it\s+(\d+)\s+(.+)/i,
  );
  if (!match) return [];
  const qty = parseInt(match[3] ?? match[4], 10);
  const itemPhrase = match[2] ?? match[5];
  const item = matchMenuItem(itemPhrase);
  if (!item || !qty) return [];
  return [{ type: "UPDATE_QUANTITY", itemId: item.id, quantity: qty }];
}

function buildReply(actions: CartAction[]): string {
  if (!actions.length) {
    return "I couldn't match that to our menu. Try something like: \"Add two spicy chicken sandwiches and a large water.\"";
  }

  const parts: string[] = [];
  for (const action of actions) {
    const item = action.itemId ? getMenuItemById(action.itemId) : undefined;
    const name = item?.name ?? "item";
    const qty = action.quantity ?? 1;
    const modStr =
      action.modifiers && Object.keys(action.modifiers).length
        ? ` (${Object.entries(action.modifiers)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")})`
        : "";

    switch (action.type) {
      case "ADD":
        parts.push(`added ${qty}× ${name}${modStr}`);
        break;
      case "REMOVE":
        parts.push(`removed ${qty}× ${name}`);
        break;
      case "UPDATE_QUANTITY":
        parts.push(`set ${name} to ${qty}`);
        break;
      case "CLEAR":
        parts.push("cleared your cart");
        break;
      default:
        break;
    }
  }

  const summary = parts.join(", ");
  return summary.charAt(0).toUpperCase() + summary.slice(1) + ".";
}

export function parseWithRules(request: ChatRequest): ChatResponse {
  const message = request.message.trim();
  const lower = normalize(message);

  let actions: CartAction[] = [];

  if (/(what('s| is) in my cart|show (my )?cart|view cart)/i.test(message)) {
    const count = request.cart?.lines.length ?? 0;
    return {
      reply:
        count > 0
          ? `You have ${count} line item${count === 1 ? "" : "s"} in your cart. Open the Cart tab for details.`
          : "Your cart is empty. Browse the menu or tell me what you'd like to order.",
      actions: [],
      suggestions: ["Add truffle fries", "Add a harvest bowl", "Clear cart"],
      parsedBy: "rules",
    };
  }

  if (/(menu|what do you (have|serve)|recommend)/i.test(lower)) {
    return {
      reply:
        "We have mains like our Spicy Chicken Sandwich and Truffle Mushroom Burger, bowls, salads, sides, drinks, and desserts. Check the Menu tab or ask me to add something.",
      actions: [],
      suggestions: ["Add spicy chicken sandwich", "Add truffle fries", "What's popular?"],
      parsedBy: "rules",
    };
  }

  actions = [
    ...parseRemoveActions(message),
    ...parseAddActions(message),
    ...parseUpdateQuantity(message),
  ];

  const deduped = dedupeActions(actions);

  return {
    reply: buildReply(deduped),
    actions: deduped,
    suggestions: deduped.length
      ? ["Add truffle fries", "View cart", "Remove water"]
      : ["Add two spicy chicken sandwiches", "Add large water", "Clear cart"],
    parsedBy: "rules",
  };
}

function dedupeActions(actions: CartAction[]): CartAction[] {
  const result: CartAction[] = [];
  for (const action of actions) {
    if (action.type === "CLEAR") {
      return [{ type: "CLEAR" }];
    }
    const existing = result.find(
      (a) =>
        a.type === action.type &&
        a.itemId === action.itemId &&
        JSON.stringify(a.modifiers) === JSON.stringify(action.modifiers),
    );
    if (existing && action.type === "ADD") {
      existing.quantity = (existing.quantity ?? 1) + (action.quantity ?? 1);
    } else {
      result.push({ ...action });
    }
  }
  return result;
}
