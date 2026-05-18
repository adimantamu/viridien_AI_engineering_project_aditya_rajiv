import { getMenuItemById } from "../data/menu.js";
import {
  SIZE_MODIFIER_ID,
  normalizeSizeToStandard,
} from "../data/menuModifiers.js";
import type { CartAction } from "../types/index.js";
import { matchMenuItem, normalizeText } from "./orderSegmentParser.js";

const SIZE_WORD_PATTERN =
  /\b(extra\s+)?large\b|\blarge\b|\bbig\b|\blg\b|\bmedium\b|\bmed\b|\bmd\b|\bregular\b|\breg\b|\bsmall\b|\bsm\b|\bpetite\b/gi;

export function extractSizeFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(extra\s+)?large\b|\blarge\b|\bbig\b|\blg\b/.test(lower)) return "large";
  if (/\bregular\b|\breg\b/.test(lower)) return "medium";
  if (/\bmedium\b|\bmed\b|\bmd\b/.test(lower)) return "medium";
  if (/\bsmall\b|\bsm\b|\bpetite\b/.test(lower)) return "small";
  return null;
}

export function stripSizeWords(text: string): string {
  return text
    .replace(SIZE_WORD_PATTERN, " ")
    .replace(/\bsize\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemPhraseFromMatch(groups: string[]): string {
  return groups.map((g) => g?.trim()).filter(Boolean).join(" ").trim();
}

/** "change my water to large", "make the burger medium", "update fries size to small". */
export function parseModifierChangeActions(message: string): CartAction[] {
  const actions: CartAction[] = [];
  const patterns: RegExp[] = [
    /(?:change|update|switch|set)\s+(?:my\s+|the\s+)?(.+?)\s+(?:size\s+)?to\s+(?:a\s+)?(small|medium|large|regular)\b/i,
    /(?:change|update)\s+(?:my\s+)?(.+?)\s+size\s+to\s+(small|medium|large|regular)\b/i,
    /make\s+(?:my\s+|the\s+)?(.+?)\s+(?:a\s+)?(small|medium|large|regular)(?:\s+size)?\b/i,
    /(?:swap|switch)\s+(?:my\s+)?(.+?)\s+to\s+(small|medium|large|regular)\b/i,
    /(?:upgrade|upsize)\s+(?:my\s+|the\s+)?(.+?)\s+to\s+(small|medium|large|regular)\b/i,
    /(?:downsize|downgrade)\s+(?:my\s+|the\s+)?(.+?)\s+to\s+(small|medium|large|regular)\b/i,
    /(?:go|make)\s+(small|medium|large|regular)\s+on\s+(?:my\s+|the\s+)?(.+?)\b/i,
    /(?:my\s+|the\s+)?(.+?)\s+in\s+(?:a\s+)?(small|medium|large|regular)(?:\s+size)?\b/i,
    /(?:same\s+)?(.+?)\s+but\s+(small|medium|large|regular)\b/i,
  ];

  const sizeToken = /^(small|medium|large|regular)$/i;

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) continue;

    const g1 = match[1]?.trim() ?? "";
    const g2 = match[2]?.trim() ?? "";
    const phrase = stripSizeWords(
      itemPhraseFromMatch(sizeToken.test(g1) ? [g2] : [g1]),
    );
    const sizeRaw = sizeToken.test(g1) ? g1 : g2;
    const item = matchMenuItem(phrase);
    if (!item || !sizeRaw) continue;

    actions.push({
      type: "SET_MODIFIER",
      itemId: item.id,
      modifiers: { [SIZE_MODIFIER_ID]: normalizeSizeToStandard(sizeRaw) },
    });
    break;
  }

  return actions;
}

export function parseSizeInquiryReply(message: string): string | null {
  const lower = message.toLowerCase();
  if (
    !/\b(size|sizes|portion|how big|what size|large|medium|small)\b/i.test(lower) ||
    !/\b(price|cost|how much|options?)\b/i.test(lower)
  ) {
    return null;
  }

  const item = matchMenuItem(stripSizeWords(message));
  if (!item) return null;

  const sizeMod = item.modifiers?.find((m) => m.id === SIZE_MODIFIER_ID);
  if (!sizeMod) return null;

  const lines = sizeMod.options.map((o) => {
    const total = item.price + (o.priceDelta ?? 0);
    return `• **${o.label}** — $${total.toFixed(2)}`;
  });

  return `**${item.name}** sizes:\n\n${lines.join("\n")}\n\nSay e.g. "Add a large ${item.name.toLowerCase()}" or "Change my ${item.name.toLowerCase()} to medium".`;
}

export function sizeLabelForAction(
  itemId: string | undefined,
  modifiers: Record<string, string> | undefined,
): string {
  if (!itemId || !modifiers?.[SIZE_MODIFIER_ID]) return "";
  const item = getMenuItemById(itemId);
  const opt = item?.modifiers
    ?.find((m) => m.id === SIZE_MODIFIER_ID)
    ?.options.find((o) => o.id === modifiers[SIZE_MODIFIER_ID]);
  return opt ? ` (${opt.label})` : ` (${modifiers[SIZE_MODIFIER_ID]})`;
}
