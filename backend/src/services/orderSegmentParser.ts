import { MENU_ITEMS } from "../data/menu.js";
import type { CartAction } from "../types/index.js";

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
  some: 1,
};

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Fix "sandwiches.And some" → "sandwiches. And some" */
export function normalizeOrderMessage(message: string): string {
  return message
    .replace(/([.!?])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitOrderSegments(message: string): string[] {
  const cleaned = message
    .replace(
      /^(add|get|order|i want|i'd like|please add|put|i need|give me|can i (have|get))\s+/i,
      "",
    )
    .replace(/^(remove|delete|take off)\s+/i, "REMOVE ")
    .trim();

  if (/^(clear|empty)\s+(my\s+)?cart/i.test(cleaned)) {
    return ["__CLEAR__"];
  }

  const normalized = normalizeOrderMessage(cleaned);

  return normalized
    .split(/\s+and\s+|\s*,\s*|\s+plus\s+|\s+also\s+|\s+with\s+|\.\s+/i)
    .map((s) =>
      s
        .replace(/^(and|also|plus|with)\s+/i, "")
        .replace(/^(some|a bit of)\s+/i, "")
        .trim(),
    )
    .filter(Boolean);
}

export function extractQuantity(segment: string): { quantity: number; rest: string } {
  let rest = segment.trim();
  rest = rest.replace(/^(about|around|like|maybe|approximately)\s+/i, "");

  const digitMatch = rest.match(/^(\d+)\s*(x\s*)?/i);
  if (digitMatch) {
    return {
      quantity: parseInt(digitMatch[1], 10),
      rest: rest.slice(digitMatch[0].length).trim(),
    };
  }

  for (const [word, qty] of Object.entries(NUMBER_WORDS)) {
    const pattern = new RegExp(`^${word}\\s+`, "i");
    if (pattern.test(rest)) {
      return { quantity: qty, rest: rest.replace(pattern, "").trim() };
    }
  }

  return { quantity: 1, rest };
}

function singularizePhrase(phrase: string): string {
  return phrase
    .split(" ")
    .map((word) => {
      if (word.length <= 3) return word;
      if (word.endsWith("ies")) return word.slice(0, -3) + "y";
      if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
      if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

export function matchMenuItem(segment: string) {
  const variants = [normalizeText(segment), singularizePhrase(normalizeText(segment))];
  let best: { item: (typeof MENU_ITEMS)[0]; score: number } | null = null;

  for (const normalized of variants) {
    if (!normalized) continue;

    for (const item of MENU_ITEMS) {
      const candidates = [item.name, ...(item.aliases ?? [])].map(normalizeText);
      for (const candidate of candidates) {
        if (normalized === candidate) {
          const score = 1000 + candidate.length;
          if (!best || score > best.score) best = { item, score };
          continue;
        }
        if (normalized.includes(candidate) || candidate.includes(normalized)) {
          const score = candidate.length;
          if (!best || score > best.score) best = { item, score };
        }
      }
    }
  }

  return best?.item;
}

export function extractModifiers(
  segment: string,
  item: (typeof MENU_ITEMS)[0],
): Record<string, string> {
  const mods: Record<string, string> = {};
  const lower = segment.toLowerCase();

  if (item.modifiers) {
    for (const modifier of item.modifiers) {
      for (const option of modifier.options) {
        const label = option.label.toLowerCase();
        const id = option.id.toLowerCase();
        if (lower.includes(label) || lower.includes(id.replace(/-/g, " "))) {
          mods[modifier.id] = option.id;
        }
      }
    }
  }

  if (item.id === "water" || item.id === "sparkling-water") {
    if (/\blarge\b/.test(lower)) mods.size = "large";
    else if (/\bmedium\b/.test(lower)) mods.size = "medium";
    else if (/\bsmall\b/.test(lower)) mods.size = "small";
    else mods.size = "medium";
  }

  if (item.id === "spicy-chicken-sandwich") {
    if (/\bextra[- ]?hot\b/.test(lower)) mods.spice = "extra-hot";
    else if (/\bhot\b|\bspicy\b/.test(lower)) mods.spice = mods.spice ?? "hot";
    else if (/\bmild\b/.test(lower)) mods.spice = "mild";
    else mods.spice = "hot";
  }

  return mods;
}

export function parseAddActionsFromMessage(message: string): CartAction[] {
  const actions: CartAction[] = [];
  const lower = normalizeText(message);

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

    const modifiers = extractModifiers(`${segment} ${rest}`, item);

    actions.push({
      type: isRemove ? "REMOVE" : "ADD",
      itemId: item.id,
      quantity,
      modifiers: Object.keys(modifiers).length ? modifiers : undefined,
    });
  }

  return actions;
}

/** Same item mentioned twice in one message → keep the last quantity (e.g. "some water" then "about two waters"). */
export function dedupeCartActions(actions: CartAction[]): CartAction[] {
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
      existing.quantity = action.quantity ?? 1;
    } else {
      result.push({ ...action });
    }
  }

  return result;
}
