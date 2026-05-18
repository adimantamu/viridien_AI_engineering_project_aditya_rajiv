import { MENU_ITEMS } from "../data/menu.js";
import type { ChatRequest, ChatResponse } from "../types/index.js";
import { normalizeCompoundMessage } from "./messageNormalizer.js";
import {
  buildCategoryMenuResponse,
  buildMultiCategoryMenuResponse,
  detectMenuCategories,
  formatSmartRecommendations,
  mealCompletionReply,
  mergeChips,
  pairingAdviceReply,
  type MenuCategory,
} from "./mealSuggestions.js";
import { normalizeText } from "./orderSegmentParser.js";

function formatItemLine(item: (typeof MENU_ITEMS)[0]): string {
  return `• ${item.name} — $${item.price.toFixed(2)} — ${item.description}`;
}

export function menuInquiryReply(request: ChatRequest): string | null {
  const built = buildMenuInquiryResponse(request);
  return built?.reply ?? null;
}

/** Rules-first menu Q&A — always preferred over OpenAI for browsing. */
export function buildMenuInquiryResponse(request: ChatRequest): ChatResponse | null {
  const message = normalizeCompoundMessage(request.message.trim());
  const lower = normalizeText(message);

  const completion = mealCompletionReply(request);
  if (completion) {
    return {
      reply: completion,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["Place order", "What are your desserts?", "Add truffle fries"],
      parsedBy: "rules",
    };
  }

  const pairing = pairingAdviceReply(request);
  if (pairing) {
    return {
      reply: pairing,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["Add truffle fries", "Place order", "View cart"],
      parsedBy: "rules",
    };
  }

  const categories = detectMenuCategories(message);
  if (categories.length) {
    const isSuggestion = /\b(suggestions?|recommend(?:ations?)?|ideas?|picks?)\b/i.test(lower);
    const rich =
      categories.length > 1
        ? buildMultiCategoryMenuResponse(categories, { isSuggestion })
        : buildCategoryMenuResponse(categories[0], {
            isSuggestion,
            intro: isSuggestion
              ? `✨ Lovely choice — here are ${categories[0]} our guests love:`
              : `${CATEGORY_INTRO(categories[0])}`,
          });
    return {
      reply: rich.reply,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: rich.chips.map((c) => c.message),
      suggestionChips: rich.chips,
      recommendationBlocks: rich.blocks,
      parsedBy: categories.length > 1 ? "rules-multi" : "rules",
    };
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

    const chips = mergeChips(
      ["Starters", "Mains", "Bowls", "Drinks", "Desserts"].map((cat) => ({
        label: `📋 ${cat}`,
        message: `What are your ${cat.toLowerCase()}?`,
      })),
    );

    return {
      reply: `🍽️ **Welcome to our menu!**\n\nHere's everything at a glance:\n\n${sections}\n\nAsk about any category — e.g. "What are your starters?" — or tap a suggestion below.`,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: chips.map((c) => c.message),
      suggestionChips: chips,
      parsedBy: "rules",
    };
  }

  if (/recommend|suggestion|what should i (get|order)|what('s| is) good/i.test(lower)) {
    return {
      reply: formatSmartRecommendations(request),
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["What are your starters?", "Add spicy chicken sandwich", "Place order"],
      parsedBy: "rules",
    };
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
      return {
        reply: `💰 **${item.name}** is **$${item.price.toFixed(2)}**.\n\nSay "Add ${item.name.toLowerCase()}" and I'll pop it in your cart.`,
        actions: [],
        orderActions: [],
        sessionContext: { awaitingConfirmation: null },
        suggestions: [`Add ${item.name.toLowerCase()}`, "View cart", "What are your starters?"],
        suggestionChips: [
          { label: `➕ ${item.name}`, message: `Add ${item.name}` },
          { label: "📋 Starters", message: "What are your starters?" },
        ],
        parsedBy: "rules",
      };
    }
  }

  return null;
}

function CATEGORY_INTRO(category: MenuCategory): string {
  switch (category) {
    case "Starters":
      return "🥗 **Starters** — perfect to begin your meal:";
    case "Mains":
      return "🍔 **Mains** — hearty signatures from our kitchen:";
    case "Bowls":
      return "🥙 **Bowls** — balanced, flavourful one-bowl meals:";
    case "Salads":
      return "🥬 **Salads** — fresh and satisfying:";
    case "Sides":
      return "🍟 **Sides** — the perfect accompaniment:";
    case "Drinks":
      return "🥤 **Drinks** — to sip and refresh:";
    case "Desserts":
      return "🍰 **Desserts** — sweet finishes:";
    default:
      return `Here are our ${category}:`;
  }
}
