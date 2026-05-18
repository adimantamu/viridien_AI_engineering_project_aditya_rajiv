import { MENU_ITEMS } from "../data/menu.js";
import type { ChatRequest } from "../types/index.js";
import {
  normalizeCompoundMessage,
} from "./messageNormalizer.js";
import {
  detectMenuCategory,
  formatSmartRecommendations,
  listCategoryItems,
  mealCompletionReply,
  pairingAdviceReply,
} from "./mealSuggestions.js";
import { normalizeText } from "./orderSegmentParser.js";

function formatItemLine(item: (typeof MENU_ITEMS)[0]): string {
  return `• ${item.name} — $${item.price.toFixed(2)} — ${item.description}`;
}

export function menuInquiryReply(request: ChatRequest): string | null {
  const message = normalizeCompoundMessage(request.message.trim());
  const lower = normalizeText(message);

  const completion = mealCompletionReply(request);
  if (completion) return completion;

  const pairing = pairingAdviceReply(request);
  if (pairing) return pairing;

  const category = detectMenuCategory(message);
  if (category) {
    const isSuggestion = /\b(suggestions?|recommend(?:ations?)?|ideas?|picks?)\b/i.test(lower);
    const intro = isSuggestion
      ? `Great choice — here are some ${category} I'd suggest:`
      : undefined;
    return listCategoryItems(category, intro);
  }

  if (
    /^(what('s| is)|tell me about)\s+(on\s+)?(the\s+)?menu/i.test(message) ||
    /what do you (have|serve|offer)/i.test(lower) ||
    /show me (the )?menu/i.test(lower)
  ) {
    const byCategory = new Map<string, typeof MENU_ITEMS>();
    for (const item of MENU_ITEMS) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const sections = [...byCategory.entries()]
      .map(([cat, items]) => {
        const lines = items.map((i) => `  • ${i.name} ($${i.price.toFixed(2)})`).join("\n");
        return `${cat}\n${lines}`;
      })
      .join("\n\n");

    return `Here's our menu at a glance:\n\n${sections}\n\nAsk for a category (e.g. "What are your starters?") or order by saying "Add two spicy chicken sandwiches."`;
  }

  if (/recommend|suggestion|what should i (get|order)|what('s| is) good/i.test(lower)) {
    return formatSmartRecommendations(request);
  }

  const priceMatch = lower.match(/how much (is|are|for)\s+(?:the\s+)?(.+?)(?:\?|$)/);
  if (priceMatch) {
    const phrase = priceMatch[2];
    const item = MENU_ITEMS.find((i) => {
      const n = normalizeText(phrase);
      return (
        normalizeText(i.name).includes(n) ||
        n.includes(normalizeText(i.name)) ||
        i.aliases?.some((a) => normalizeText(a).includes(n) || n.includes(normalizeText(a)))
      );
    });
    if (item) {
      return `${item.name} is $${item.price.toFixed(2)}. Say "Add ${item.name.toLowerCase()}" to order.`;
    }
  }

  return null;
}
