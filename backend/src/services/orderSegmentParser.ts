import { MENU_ITEMS, getMenuItemById } from "../data/menu.js";
import {
  SIZE_MODIFIER_ID,
  defaultModifiersForItem,
  normalizeSizeToStandard,
} from "../data/menuModifiers.js";
import type { CartAction } from "../types/index.js";
import { extractSizeFromText, parseModifierChangeActions, stripSizeWords } from "./sizeParser.js";

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

/** Filler between chained cart commands — stripped before qty/item parsing. */
const SEGMENT_LEAD_FILLER =
  /^(?:(?:and\s+)?then(?:\s+|$)|next(?:\s+|$)|after\s+that(?:\s+|$)|(?:you\s+)?can\s+|please\s+|could\s+you\s+|would\s+you\s+|i\s+(?:want|need|'d\s+like)\s+(?:to\s+)?|just\s+|also\s+|finally\s+)*/i;

const CART_VERB_PREFIX =
  /^(?:REMOVE\s+|(?:remove|delete|take\s+off)\s+|(?:add|include|get|order|put)\s+)/i;

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fix voice glitches and normalize chained order phrasing. */
/** "7 burgers with 3 lemonades" → separate add clauses for rules fallback. */
export function expandWithClauses(message: string): string {
  const qty =
    "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)";
  return message
    .replace(
      new RegExp(`\\s+with\\s+(?:also\\s+)?(?=${qty}\\s)`, "gi"),
      " and add ",
    )
    .replace(
      new RegExp(`\\s+along\\s+with\\s+(?=${qty}\\s)`, "gi"),
      " and add ",
    )
    .replace(
      new RegExp(`\\s+plus\\s+(?=${qty}\\s)`, "gi"),
      " and add ",
    )
    .replace(/\s+and\s+add\s+add\s+/gi, " and add ");
}

export function normalizeOrderMessage(message: string): string {
  return expandWithClauses(message)
    .replace(/([.!?])(?=\S)/g, "$1 ")
    .replace(/\b(add|include|order|get)\.(\d+)/gi, "$1 $2")
    .replace(/\band\.(\d+)/gi, "and $1")
    .replace(/\s+also\s+include\s+/gi, " and ")
    .replace(/\s+include\s+/gi, " add ")
    .replace(/\band\s+also\s+(remove|delete|take\s+off)\b/gi, " and REMOVE $1 ")
    .replace(/\balso\s+(remove|delete|take\s+off)\b/gi, "REMOVE $1 ")
    .replace(/\band\s+then\b/gi, " and ")
    .replace(/\bafter\s+that\b/gi, " and ")
    .replace(/\bthen\s+(?:(?:you|please|can\s+you)\s+)*(?=(?:add|remove|delete|take\s+off)\b)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SEGMENT_STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "also",
  "with",
  "along",
  "that",
  "plus",
  "of",
  "in",
  "to",
  "for",
  "my",
  "please",
  "cart",
  "be",
  "then",
  "next",
]);

function stripSegmentLeadFiller(segment: string): string {
  let text = segment.trim();
  for (let i = 0; i < 6; i++) {
    const next = text.replace(SEGMENT_LEAD_FILLER, "").trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

function segmentIntent(segment: string): { isRemove: boolean; body: string } {
  let s = segment.trim();
  const isRemove =
    /^REMOVE\s+/i.test(s) ||
    /^(?:remove|deleted?|take\s+off)\s+/i.test(s);

  s = s
    .replace(/^REMOVE\s+/i, "")
    .replace(/^(?:remove|delete|take\s+off)\s+/i, "")
    .trim();

  s = stripSegmentLeadFiller(s);

  if (!isRemove) {
    s = s
      .replace(/^(?:add|include|get|order|put)\s+/i, "")
      .trim();
    s = stripSegmentLeadFiller(s);
  }

  return { isRemove, body: s };
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

  const normalized = normalizeOrderMessage(cleaned)
    .replace(/\band\s+also\b/gi, " and ")
    .replace(/\balong\s+with\s+that\b/gi, " and ")
    .replace(/\balong\s+with\b/gi, " and ")
    .replace(/\b(?:to be )?added to (?:the )?cart\b/gi, "")
    .replace(/\bthat\s+also\s+add\s+/gi, "")
    .replace(/\balso\s+add\s+/gi, " add ")
    .replace(/\s+and\s+(remove|delete|take off)\s+/gi, " and REMOVE ")
    .replace(/,\s*(remove|delete|take off)\s+/gi, ", REMOVE ")
    .replace(/\s+then\s+(?=REMOVE|remove|delete|take off|add|include|get|order)/gi, " and ");

  return normalized
    .split(/\s+and\s+|\s*,\s*|\s+plus\s+|\.\s+/i)
    .map((s) =>
      s
        .replace(/^(and|also|plus|along|that)\s+/i, "")
        .replace(/^(some|a bit of)\s+/i, "")
        .trim(),
    )
    .filter((s) => {
      if (!s.length) return false;
      const bare = normalizeText(s.replace(CART_VERB_PREFIX, ""));
      return bare.length > 0 && !SEGMENT_STOPWORDS.has(bare);
    });
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
  let text = stripSegmentLeadFiller(rest).replace(/^(about|around|like|maybe|approximately)\s+/i, "");

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
    { re: /^(.+?)\s+of\s+quantity\s+(\d+)\s*$/i, group: 2 },
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
  const normalized = stripSegmentLeadFiller(normalizeOrderMessage(segment));

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
  const stripped = stripSegmentLeadFiller(
    stripSizeWords(
      segment
        .replace(/\s+of\s+quantity\s+\d+\s*$/i, "")
        .replace(/\s+\d+\s+in\s+quantity\s*$/i, "")
        .replace(/\s+in\s+quantity\s*$/i, "")
        .replace(/\s+of\s*$/i, "")
        .trim(),
    ),
  );

  const variants = [
    normalizeText(stripped),
    singularizePhrase(normalizeText(stripped)),
  ];
  let best: { item: (typeof MENU_ITEMS)[0]; score: number } | null = null;

  for (const normalized of variants) {
    if (!normalized || normalized.length < 3) continue;
    if (SEGMENT_STOPWORDS.has(normalized)) continue;

    for (const item of MENU_ITEMS) {
      const candidates = [item.name, ...(item.aliases ?? [])].map(normalizeText);
      for (const candidate of candidates) {
        if (!candidate || candidate.length < 3) continue;

        if (normalized === candidate) {
          const score = 1000 + candidate.length;
          if (!best || score > best.score) best = { item, score };
          continue;
        }

        if (candidate.length >= 4 && normalized.length >= 4) {
          const boundary = new RegExp(`\\b${escapeRegex(candidate)}\\b`, "i");
          if (boundary.test(normalized)) {
            const score = 400 + candidate.length;
            if (!best || score > best.score) best = { item, score };
            continue;
          }
        }

        if (normalized.length >= 5 && candidate.length >= 5 && candidate.includes(normalized)) {
          const score = 300 + normalized.length;
          if (!best || score > best.score) best = { item, score };
          continue;
        }

        if (normalized.length >= 4 && candidate.length >= normalized.length + 2) {
          const tokenInCandidate = new RegExp(`\\b${escapeRegex(normalized)}\\b`, "i");
          if (tokenInCandidate.test(candidate)) {
            const score = 250 + normalized.length;
            if (!best || score > best.score) best = { item, score };
          }
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
  const mods = defaultModifiersForItem(item);
  const lower = segment.toLowerCase();

  const sizeFromText = extractSizeFromText(segment);
  if (sizeFromText && item.modifiers?.some((m) => m.id === SIZE_MODIFIER_ID)) {
    mods[SIZE_MODIFIER_ID] = normalizeSizeToStandard(sizeFromText);
  }

  const lowerNoSize = stripSizeWords(lower);
  if (item.modifiers) {
    for (const modifier of item.modifiers) {
      if (modifier.id === SIZE_MODIFIER_ID) continue;
      for (const option of modifier.options) {
        const label = option.label.toLowerCase();
        const id = option.id.toLowerCase();
        if (
          lowerNoSize.includes(label) ||
          lowerNoSize.includes(id.replace(/-/g, " "))
        ) {
          mods[modifier.id] = option.id;
        }
      }
    }
  }

  if (item.id === "spicy-chicken-sandwich") {
    if (/\bextra[- ]?hot\b/.test(lowerNoSize)) mods.spice = "extra-hot";
    else if (/\bhot\b|\bspicy\b/.test(lowerNoSize)) mods.spice = mods.spice ?? "hot";
    else if (/\bmild\b/.test(lowerNoSize)) mods.spice = "mild";
    else if (!mods.spice) mods.spice = "hot";
  }

  return mods;
}

export function parseUpdateQuantityFromMessage(message: string): CartAction[] {
  const match = message.match(
    /(?:change|update|set)\s+(.+?)\s+to\s+(\d+)|make\s+it\s+(\d+)\s+(.+)/i,
  );
  if (!match) return [];
  const qty = parseInt(match[2] ?? match[3], 10);
  const itemPhrase = match[1] ?? match[4];
  const item = matchMenuItem(itemPhrase);
  if (!item || !qty) return [];
  return [{ type: "UPDATE_QUANTITY", itemId: item.id, quantity: qty }];
}

export function parseAllCartActionsFromMessage(message: string): CartAction[] {
  const modifierActions = parseModifierChangeActions(message);
  const addActions = parseAddActionsFromMessage(message);
  return [...modifierActions, ...addActions];
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

    if (parseModifierChangeActions(segment).length > 0) {
      continue;
    }

    const { isRemove, body } = segmentIntent(segment);
    const { quantity, rest } = extractQuantity(body);
    const item = matchMenuItem(rest);
    if (!item || SEGMENT_STOPWORDS.has(normalizeText(rest))) continue;

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

export function cartActionKey(action: CartAction): string {
  return `${action.type}:${action.itemId ?? ""}:${JSON.stringify(action.modifiers ?? {})}`;
}

/** Items explicitly named in the guest message (not cart context). */
export function itemMentionedInMessage(message: string, itemId: string): boolean {
  const item = getMenuItemById(itemId);
  if (!item) return false;
  const lower = normalizeText(message);
  const candidates = [item.name, ...(item.aliases ?? [])].map(normalizeText);
  return candidates.some((c) => c.length >= 3 && (lower.includes(c) || c.includes(lower)));
}

function parseRulesCartActions(message: string): CartAction[] {
  const normalized = normalizeOrderMessage(message);
  return dedupeCartActions([
    ...parseAllCartActionsFromMessage(normalized),
    ...parseUpdateQuantityFromMessage(normalized),
  ]);
}

/**
 * OpenAI sometimes re-ADDs everything already in the cart when cart context is shown.
 * Anchor ADD/REMOVE to what the rules parser (and message text) support.
 */
export function reconcileAiCartActions(message: string, aiActions: CartAction[]): CartAction[] {
  const rules = parseRulesCartActions(message);
  const rulesMutations = rules.filter(
    (a) => a.type === "ADD" || a.type === "REMOVE" || a.type === "CLEAR",
  );

  const aiOther = aiActions.filter(
    (a) =>
      a.type === "SET_MODIFIER" ||
      a.type === "UPDATE_QUANTITY" ||
      a.type === "CLEAR",
  );

  if (rulesMutations.length > 0) {
    const allowed = new Set(rulesMutations.map(cartActionKey));
    const aiByKey = new Map(
      aiActions
        .filter((a) => a.type === "ADD" || a.type === "REMOVE")
        .map((a) => [cartActionKey(a), a] as const),
    );

    const merged: CartAction[] = [...aiOther];
    for (const rule of rulesMutations) {
      const key = cartActionKey(rule);
      merged.push(aiByKey.get(key) ?? rule);
    }
    return dedupeCartActions(merged);
  }

  const filtered = aiActions.filter((a) => {
    if (a.type !== "ADD") return true;
    if (!a.itemId) return false;
    return itemMentionedInMessage(message, a.itemId);
  });

  return dedupeCartActions(filtered.length ? filtered : rules);
}

/** Merge duplicate item lines in one message — sum ADD/REMOVE quantities per item. */
export function dedupeCartActions(actions: CartAction[]): CartAction[] {
  const result: CartAction[] = [];
  const indexByKey = new Map<string, number>();

  for (const action of actions) {
    if (action.type === "CLEAR") {
      return [{ type: "CLEAR" }];
    }

    const key = cartActionKey(action);
    const existingIdx = indexByKey.get(key);

    if (existingIdx !== undefined && action.type !== "SET_MODIFIER") {
      const existing = result[existingIdx];
      if (action.type === "ADD" || action.type === "REMOVE") {
        existing.quantity = (existing.quantity ?? 1) + (action.quantity ?? 1);
      }
      continue;
    }

    indexByKey.set(key, result.length);
    result.push({ ...action });
  }

  return result;
}
