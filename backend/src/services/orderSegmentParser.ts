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
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  couple: 2,
  few: 3,
  several: 4,
  dozen: 12,
  "half dozen": 6,
  some: 1,
};

const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/\s+/g, "\\s+"))
  .join("|");

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Fix voice glitches: "add.4" → "add 4", missing spaces after punctuation. */
export function normalizeOrderMessage(message: string): string {
  return message
    .replace(/([.!?])(?=\S)/g, "$1 ")
    .replace(/\b(add|include|order|get)\.(\d+)/gi, "$1 $2")
    .replace(/\band\.(\d+)/gi, "and $1")
    .replace(/\s+also\s+include\s+/gi, " and ")
    .replace(/\s+include\s+/gi, " add ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitOrderSegments(message: string): string[] {
  const cleaned = message
    .replace(
      /^(?:please\s+)?(?:(?:in|to)\s+(?:the\s+)?cart\s+)?(?:(?:add|include|put)|(?:can you|please)\s+add)\s+/i,
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

function parseNumberToken(token: string): number | null {
  const t = token.toLowerCase().trim();
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (NUMBER_WORDS[t] !== undefined) {
    return NUMBER_WORDS[t];
  }
  return null;
}

function tryLeadingQuantity(rest: string): { quantity: number; rest: string; found: boolean } {
  let text = rest.replace(/^(about|around|like|maybe|approximately)\s+/i, "");

  const digitMatch = text.match(/^(\d+)\s*(?:x\s*)?/i);
  if (digitMatch) {
    return {
      quantity: parseInt(digitMatch[1], 10),
      rest: text.slice(digitMatch[0].length).trim(),
      found: true,
    };
  }

  const wordMatch = text.match(new RegExp(`^(${NUMBER_WORD_PATTERN})\\s+`, "i"));
  if (wordMatch) {
    const qty = parseNumberToken(wordMatch[1]);
    if (qty) {
      return {
        quantity: qty,
        rest: text.slice(wordMatch[0].length).trim(),
        found: true,
      };
    }
  }

  return { quantity: 1, rest: text, found: false };
}

function tryTrailingQuantity(rest: string): { quantity: number; rest: string; found: boolean } {
  const patterns: { re: RegExp; group: number }[] = [
    { re: /^(.+?)\s+(\d+)\s+in\s+quantity\s*$/i, group: 2 },
    { re: /^(.+?)\s+quantity\s+(?:of\s+)?(\d+)\s*$/i, group: 2 },
    { re: /^(.+?)\s+(\d+)\s*(?:x|items?|orders?|pieces?|portions?)?\s*$/i, group: 2 },
    {
      re: new RegExp(`^(.+?)\\s+(${NUMBER_WORD_PATTERN})\\s*(?:x|items?)?\\s*$`, "i"),
      group: 2,
    },
    { re: /^(.+?)\s+x\s*(\d+)\s*$/i, group: 2 },
  ];

  for (const { re, group } of patterns) {
    const match = rest.match(re);
    if (!match || match[1].trim().length < 3) continue;
    const qty = parseNumberToken(match[group]);
    if (qty && qty > 0) {
      return { quantity: qty, rest: match[1].trim(), found: true };
    }
  }

  return { quantity: 1, rest, found: false };
}

/** Quantity before or after the item name — "3 burgers", "burgers 3", "seven sandwiches". */
export function extractQuantity(segment: string): { quantity: number; rest: string } {
  const normalized = normalizeOrderMessage(segment);

  const leading = tryLeadingQuantity(normalized);
  if (leading.found) {
    return { quantity: leading.quantity, rest: leading.rest };
  }

  const trailing = tryTrailingQuantity(normalized);
  if (trailing.found) {
    return { quantity: trailing.quantity, rest: trailing.rest };
  }

  return { quantity: 1, rest: normalized };
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
  const stripped = segment
    .replace(/\s+\d+\s+in\s+quantity\s*$/i, "")
    .replace(/\s+in\s+quantity\s*$/i, "")
    .trim();

  const variants = [
    normalizeText(stripped),
    singularizePhrase(normalizeText(stripped)),
  ];
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
  const prepared = normalizeOrderMessage(message);
  const lower = normalizeText(prepared);

  if (/^(clear|empty)\s+(my\s+)?cart/.test(lower) || lower === "clear cart") {
    return [{ type: "CLEAR" }];
  }

  const segments = splitOrderSegments(prepared);
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

/** Same item mentioned twice in one message → keep the last quantity. */
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
