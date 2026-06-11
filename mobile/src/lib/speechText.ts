import type { CartLine, ChatRecommendationBlock, ChatResponse } from "../types";

const TAX_RATE = 0.08;

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE00}-\u{FE0F}\u{200D}\u{2705}\u{274C}]/gu;

/** Strip markdown, emoji, and UI noise so platform TTS reads naturally. */
export function sanitizeChatForSpeech(text: string): string {
  let out = text
    .replace(EMOJI_PATTERN, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[•·▪►▸]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();

  out = out.replace(/(\d+)\s*×/g, "$1 ");
  out = out.replace(/\$(\d+(?:\.\d{2})?)/g, (_, amount) => formatCurrencyForSpeech(parseFloat(amount)));

  return out;
}

function formatCurrencyForSpeech(amount: number): string {
  const safe = Math.max(0, amount);
  const dollars = Math.floor(safe);
  const cents = Math.round((safe - dollars) * 100);

  if (cents === 0) {
    return dollars === 1 ? "1 dollar" : `${dollars} dollars`;
  }

  const dollarPart = dollars === 0 ? "" : dollars === 1 ? "1 dollar and " : `${dollars} dollars and `;
  const centPart = cents === 1 ? "1 cent" : `${cents} cents`;
  return `${dollarPart}${centPart}`.trim();
}

function modifierLabelForSpeech(modifiers: Record<string, string>): string {
  const size = modifiers.size;
  if (!size) return "";
  return `, ${size}`;
}

export function buildCartSummarySpeech(lines: CartLine[], cartSubtotal: number): string {
  if (!lines.length) return "";

  const tax = cartSubtotal * TAX_RATE;
  const total = cartSubtotal + tax;

  const itemParts = lines.map((line, index) => {
    const lineTotal = line.unitPrice * line.quantity;
    const qtyLabel = line.quantity === 1 ? "1" : String(line.quantity);
    return `Item ${index + 1}: ${qtyLabel} ${line.name}${modifierLabelForSpeech(line.modifiers)}, ${formatCurrencyForSpeech(lineTotal)}`;
  });

  return [
    "Here is your order summary.",
    ...itemParts,
    `Subtotal ${formatCurrencyForSpeech(cartSubtotal)}.`,
    `Tax ${formatCurrencyForSpeech(tax)}.`,
    `Total ${formatCurrencyForSpeech(total)}.`,
    "Reply yes to place this order, or no to keep editing your cart.",
  ].join(" ");
}

function buildRecommendationBlocksSpeech(blocks?: ChatRecommendationBlock[]): string[] {
  if (!blocks?.length) return [];

  const parts: string[] = [];

  for (const block of blocks) {
    const title = sanitizeChatForSpeech(block.title);
    if (title) parts.push(title);

    for (const pick of block.picks) {
      const note = pick.note ? sanitizeChatForSpeech(pick.note) : "";
      const price = formatCurrencyForSpeech(pick.price);
      parts.push(note ? `${pick.name}, ${price}. ${note}` : `${pick.name}, ${price}`);
    }
  }

  return parts;
}

/** Build the full spoken version of everything shown in an assistant reply. */
export function buildAssistantSpeechText(
  response: ChatResponse,
  cartLines: CartLine[],
  cartSubtotal: number,
): string {
  const confirmation = response.sessionContext?.awaitingConfirmation;

  if (confirmation === "place_order") {
    const summary = buildCartSummarySpeech(cartLines, cartSubtotal);
    if (summary) return summary;
  }

  if (response.placeOrderFromCart) {
    const placed = sanitizeChatForSpeech(response.reply);
    return placed || "Wonderful! Your order has been placed. Thank you!";
  }

  const parts: string[] = [];

  const main = sanitizeChatForSpeech(response.reply);
  if (main) parts.push(main);

  parts.push(...buildRecommendationBlocksSpeech(response.recommendationBlocks));

  return parts.join(" ");
}

/** Split long text for platform TTS input limits (Android is much shorter than iOS). */
export function chunkTextForSpeech(text: string, maxLength: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLength) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf(". ", maxLength);
    if (splitAt < maxLength * 0.4) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitAt < maxLength * 0.25) {
      splitAt = maxLength;
    }

    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
