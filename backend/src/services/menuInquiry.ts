import { MENU_ITEMS } from "../data/menu.js";
import type { ChatRequest } from "../types/index.js";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
}

const CATEGORY_ALIASES: Record<string, string> = {
  starter: "Starters",
  starters: "Starters",
  appetizer: "Starters",
  appetizers: "Starters",
  main: "Mains",
  mains: "Mains",
  entree: "Mains",
  entrees: "Mains",
  bowl: "Bowls",
  bowls: "Bowls",
  salad: "Salads",
  salads: "Salads",
  side: "Sides",
  "side dish": "Sides",
  sides: "Sides",
  drink: "Drinks",
  drinks: "Drinks",
  beverage: "Drinks",
  beverages: "Drinks",
  dessert: "Desserts",
  desserts: "Desserts",
  sweet: "Desserts",
};

function formatItemLine(item: (typeof MENU_ITEMS)[0]): string {
  return `• ${item.name} — $${item.price.toFixed(2)} — ${item.description}`;
}

function listByCategory(category: string): string {
  const items = MENU_ITEMS.filter((i) => i.category === category);
  if (!items.length) {
    return `We don't have items listed under ${category} right now.`;
  }
  return `Here are our ${category}:\n\n${items.map(formatItemLine).join("\n")}\n\nSay "Add …" to put something in your cart.`;
}

function detectCategory(lower: string): string | null {
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    const aliasPattern = alias.replace(/\s+/g, "\\s+");
    if (
      new RegExp(`(options?|items?|dishes?|choices|menu).*(for\\s+)?${aliasPattern}\\b`, "i").test(
        lower,
      ) ||
      new RegExp(`\\b${aliasPattern}\\s+(options?|items?|dishes?|menu)`, "i").test(lower) ||
      new RegExp(`what (do you have|('s| is) on).*(the\\s+)?${aliasPattern}\\b`, "i").test(
        lower,
      ) ||
      new RegExp(`^(show|list)\\s+(me\\s+)?(the\\s+)?${aliasPattern}\\b`, "i").test(lower)
    ) {
      return category;
    }
  }
  return null;
}

export function menuInquiryReply(request: ChatRequest): string | null {
  const message = request.message.trim();
  const lower = normalize(message);

  const category = detectCategory(lower);
  if (category) {
    return listByCategory(category);
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
    const picks = [
      MENU_ITEMS.find((i) => i.id === "spicy-chicken-sandwich"),
      MENU_ITEMS.find((i) => i.id === "truffle-mushroom-burger"),
      MENU_ITEMS.find((i) => i.id === "soup-du-jour"),
      MENU_ITEMS.find((i) => i.id === "craft-lemonade"),
    ].filter(Boolean) as typeof MENU_ITEMS;

    return `Chef's picks:\n\n${picks.map(formatItemLine).join("\n")}\n\nWant one? Just say "Add …" with the item name.`;
  }

  const priceMatch = lower.match(
    /how much (is|are|for)\s+(?:the\s+)?(.+?)(?:\?|$)/,
  );
  if (priceMatch) {
    const phrase = priceMatch[2];
    const item = MENU_ITEMS.find((i) => {
      const n = normalize(phrase);
      return (
        normalize(i.name).includes(n) ||
        n.includes(normalize(i.name)) ||
        i.aliases?.some((a) => normalize(a).includes(n) || n.includes(normalize(a)))
      );
    });
    if (item) {
      return `${item.name} is $${item.price.toFixed(2)}. Say "Add ${item.name.toLowerCase()}" to order.`;
    }
  }

  return null;
}
