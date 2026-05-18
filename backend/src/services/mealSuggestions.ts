import { MENU_ITEMS, getMenuItemById } from "../data/menu.js";
import type { ChatRequest, MenuItem } from "../types/index.js";
import {
  extractMenuInquiryText,
  normalizeCompoundMessage,
} from "./messageNormalizer.js";
import { matchMenuItem, normalizeText } from "./orderSegmentParser.js";

export const MENU_CATEGORIES = [
  "Starters",
  "Mains",
  "Bowls",
  "Salads",
  "Sides",
  "Drinks",
  "Desserts",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

const ENTREE_CATEGORIES = new Set<MenuCategory>(["Mains", "Bowls", "Salads"]);

export const CATEGORY_ALIASES: Record<string, MenuCategory> = {
  starter: "Starters",
  starters: "Starters",
  appetizer: "Starters",
  appetizers: "Starters",
  app: "Starters",
  main: "Mains",
  mains: "Mains",
  entree: "Mains",
  entrees: "Mains",
  bowl: "Bowls",
  bowls: "Bowls",
  grain: "Bowls",
  poke: "Bowls",
  salad: "Salads",
  salads: "Salads",
  side: "Sides",
  "side dish": "Sides",
  sides: "Sides",
  fries: "Sides",
  drink: "Drinks",
  drinks: "Drinks",
  beverage: "Drinks",
  beverages: "Drinks",
  water: "Drinks",
  coffee: "Drinks",
  dessert: "Desserts",
  desserts: "Desserts",
  sweet: "Desserts",
  sweets: "Desserts",
  cake: "Desserts",
};

/** Curated companions: item id → companion ids + short pairing note */
const ITEM_PAIRINGS: Record<string, { ids: string[]; note: string }> = {
  "spicy-chicken-sandwich": {
    ids: ["truffle-fries", "craft-lemonade", "coleslaw"],
    note: "Crispy sandwich loves something cool and crunchy",
  },
  "truffle-mushroom-burger": {
    ids: ["truffle-fries", "craft-cola", "craft-lemonade"],
    note: "Rich burger — classic sides and a drink",
  },
  "classic-ribeye": {
    ids: ["garlic-bread", "caesar-salad", "craft-cola", "chocolate-lava-cake"],
    note: "Steak night favourites",
  },
  "grilled-salmon": {
    ids: ["harvest-bowl", "greek-salad", "sparkling-water", "citrus-sorbet"],
    note: "Light, fresh pairings for fish",
  },
  "soup-du-jour": {
    ids: ["tomato-bruschetta", "garlic-bread", "caesar-salad"],
    note: "Warm starter — bread or salad rounds it out",
  },
  "tomato-bruschetta": {
    ids: ["soup-du-jour", "truffle-mushroom-burger", "sparkling-water"],
    note: "Shareable starter — add a main or soup",
  },
  "crispy-calamari": {
    ids: ["craft-lemonade", "iced-tea", "caesar-salad"],
    note: "Fried seafood — citrus and greens balance it",
  },
  "harvest-bowl": {
    ids: ["sparkling-water", "iced-tea", "chocolate-lava-cake"],
    note: "Hearty bowl — refresh or finish sweet",
  },
  "poke-bowl": {
    ids: ["sparkling-water", "citrus-sorbet", "shrimp-cocktail"],
    note: "Clean flavours — light drink or dessert",
  },
  "caesar-salad": {
    ids: ["garlic-bread", "grilled-salmon", "sparkling-water"],
    note: "Salad as a meal or starter — protein or bread",
  },
  "chocolate-lava-cake": {
    ids: ["espresso", "sparkling-water"],
    note: "Dessert — coffee or water cuts the richness",
  },
};

/** Category-level default companions when no item-specific rule */
const CATEGORY_PAIRING_PLAN: Record<
  MenuCategory,
  { nextCategories: MenuCategory[]; pickIds: string[] }
> = {
  Starters: {
    nextCategories: ["Mains", "Sides", "Drinks"],
    pickIds: ["truffle-mushroom-burger", "grilled-salmon", "truffle-fries", "craft-lemonade"],
  },
  Mains: {
    nextCategories: ["Sides", "Drinks", "Desserts"],
    pickIds: ["truffle-fries", "garlic-bread", "craft-lemonade", "chocolate-lava-cake"],
  },
  Bowls: {
    nextCategories: ["Drinks", "Desserts", "Sides"],
    pickIds: ["sparkling-water", "iced-tea", "citrus-sorbet", "garlic-bread"],
  },
  Salads: {
    nextCategories: ["Drinks", "Sides", "Desserts"],
    pickIds: ["sparkling-water", "garlic-bread", "grilled-salmon", "ny-cheesecake"],
  },
  Sides: {
    nextCategories: ["Mains", "Drinks"],
    pickIds: ["spicy-chicken-sandwich", "truffle-mushroom-burger", "craft-lemonade"],
  },
  Drinks: {
    nextCategories: ["Mains", "Starters", "Desserts"],
    pickIds: ["truffle-mushroom-burger", "soup-du-jour", "chocolate-lava-cake"],
  },
  Desserts: {
    nextCategories: ["Drinks"],
    pickIds: ["espresso", "craft-lemonade", "sparkling-water"],
  },
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatItemLine(item: MenuItem): string {
  return `• ${item.name} — $${item.price.toFixed(2)} — ${item.description}`;
}

function formatPick(item: MenuItem, reason?: string): string {
  const price = `$${item.price.toFixed(2)}`;
  return reason
    ? `• ${item.name} (${price}) — ${reason}`
    : `• ${item.name} (${price}) — ${item.description}`;
}

export function getCartItemIds(request: ChatRequest): Set<string> {
  return new Set((request.cart?.lines ?? []).map((l) => l.itemId));
}

export function getCartCategories(request: ChatRequest): Set<MenuCategory> {
  const cats = new Set<MenuCategory>();
  for (const line of request.cart?.lines ?? []) {
    const item = getMenuItemById(line.itemId);
    if (item && MENU_CATEGORIES.includes(item.category as MenuCategory)) {
      cats.add(item.category as MenuCategory);
    }
  }
  return cats;
}

function scoreCategoryInText(text: string, alias: string, category: MenuCategory): number {
  const lower = normalizeText(text);
  const aliasPattern = escapeRegex(alias).replace(/\s+/g, "\\s+");
  const near = `[?.!,]{0,1}\\s{0,40}`;

  const rules: { pattern: RegExp; points: number }[] = [
    {
      pattern: new RegExp(
        `\\b(different|various|all|what are)\\s+(the\\s+)?(options?|types?|kinds?|dishes?)\\s+(for|of)\\s+${aliasPattern}\\b`,
        "i",
      ),
      points: 120,
    },
    {
      pattern: new RegExp(
        `\\b(options?|dishes?|choices|types?)\\s+(for|of)\\s+(the\\s+)?${aliasPattern}\\b`,
        "i",
      ),
      points: 110,
    },
    {
      pattern: new RegExp(
        `\\b(suggestions?|recommend(?:ations?)?|ideas?)\\s+(for|on|about)\\s+(the\\s+)?${aliasPattern}\\b`,
        "i",
      ),
      points: 105,
    },
    {
      pattern: new RegExp(`what (are|('s| is)) (your |the )?${aliasPattern}\\b`, "i"),
      points: 100,
    },
    {
      pattern: new RegExp(
        `\\b(give|show)\\s+(me\\s+)?(the\\s+)?${aliasPattern}\\b`,
        "i",
      ),
      points: 85,
    },
    {
      pattern: new RegExp(`\\b${aliasPattern}\\s+(options?|items?|dishes?|menu)\\b`, "i"),
      points: 90,
    },
    {
      pattern: new RegExp(
        `\\b(suggestions?|recommend)\\b${near}\\b${aliasPattern}\\b`,
        "i",
      ),
      points: 70,
    },
    {
      pattern: new RegExp(`\\b${aliasPattern}\\b${near}\\b(suggestions?|recommend|options?)\\b`, "i"),
      points: 65,
    },
  ];

  let score = 0;
  for (const rule of rules) {
    if (rule.pattern.test(lower)) {
      score = Math.max(score, rule.points);
    }
  }
  return score;
}

export function detectMenuCategory(message: string): MenuCategory | null {
  const normalized = normalizeCompoundMessage(message);
  const inquiryText = extractMenuInquiryText(normalized);
  const scores: { category: MenuCategory; score: number }[] = [];

  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    const score = scoreCategoryInText(inquiryText, alias, category);
    if (score > 0) {
      const existing = scores.find((s) => s.category === category);
      if (existing) {
        existing.score = Math.max(existing.score, score);
      } else {
        scores.push({ category, score });
      }
    }
  }

  if (scores.length) {
    scores.sort((a, b) => b.score - a.score);
    return scores[0].category;
  }

  return detectCategoryFromMenuItemMention(normalizeText(inquiryText));
}

function detectCategoryFromMenuItemMention(lower: string): MenuCategory | null {
  if (!/\b(suggest|recommend|ideas?|options?|goes with|pair|combo|what should)\b/i.test(lower)) {
    return null;
  }

  let best: { category: MenuCategory; score: number } | null = null;

  for (const item of MENU_ITEMS) {
    const phrases = [item.name, ...(item.aliases ?? [])];
    for (const phrase of phrases) {
      const n = normalizeText(phrase);
      if (n.length < 3) continue;
      if (new RegExp(`\\b${escapeRegex(n)}\\b`, "i").test(lower)) {
        const score = n.length;
        if (!best || score > best.score) {
          best = { category: item.category as MenuCategory, score };
        }
      }
    }
  }

  return best?.category ?? null;
}

export function detectAnchorItem(message: string): MenuItem | null {
  const lower = normalizeText(message);
  if (!/\b(goes with|pair|combo|complete|suggest|recommend|what should)\b/i.test(lower)) {
    return null;
  }

  let best: { item: MenuItem; score: number } | null = null;

  for (const item of MENU_ITEMS) {
    const phrases = [item.name, ...(item.aliases ?? [])];
    for (const phrase of phrases) {
      const n = normalizeText(phrase);
      if (n.length < 4) continue;
      if (new RegExp(`\\b${escapeRegex(n)}\\b`, "i").test(lower)) {
        const score = n.length;
        if (!best || score > best.score) {
          best = { item, score };
        }
      }
    }
  }

  if (best) return best.item;
  return matchMenuItem(message) ?? null;
}

export function analyzeMealGaps(cartCategories: Set<MenuCategory>): MenuCategory[] {
  const missing: MenuCategory[] = [];
  const hasEntree = [...ENTREE_CATEGORIES].some((c) => cartCategories.has(c));

  if (!hasEntree) {
    missing.push("Mains");
  }

  if (!cartCategories.has("Drinks")) {
    missing.push("Drinks");
  }

  if (
    (cartCategories.has("Mains") || cartCategories.has("Starters")) &&
    !cartCategories.has("Sides")
  ) {
    missing.push("Sides");
  }

  if (hasEntree && !cartCategories.has("Desserts")) {
    missing.push("Desserts");
  }

  if (hasEntree && !cartCategories.has("Starters") && cartCategories.size <= 2) {
    missing.push("Starters");
  }

  return missing.filter((c) => !cartCategories.has(c));
}

function pickItemsForCategory(
  category: MenuCategory,
  excludeIds: Set<string>,
  limit: number,
  preferIds: string[] = [],
): MenuItem[] {
  const picked: MenuItem[] = [];
  const seen = new Set<string>();

  for (const id of preferIds) {
    if (picked.length >= limit) break;
    if (excludeIds.has(id) || seen.has(id)) continue;
    const item = getMenuItemById(id);
    if (item?.category === category) {
      picked.push(item);
      seen.add(id);
    }
  }

  for (const item of MENU_ITEMS) {
    if (picked.length >= limit) break;
    if (item.category !== category || excludeIds.has(item.id) || seen.has(item.id)) continue;
    picked.push(item);
    seen.add(item.id);
  }

  return picked;
}

export function listCategoryItems(category: MenuCategory, intro?: string): string {
  const items = MENU_ITEMS.filter((i) => i.category === category);
  if (!items.length) {
    return `We don't have items listed under ${category} right now.`;
  }
  const heading = intro ?? `Here are our ${category}:`;
  return `${heading}\n\n${items.map(formatItemLine).join("\n")}\n\nSay "Add …" to put something in your cart.`;
}

export function buildComboSuggestions(
  anchorItemIds: string[],
  cartItemIds: Set<string>,
  max = 5,
): string | null {
  const anchors = anchorItemIds
    .map((id) => getMenuItemById(id))
    .filter((x): x is MenuItem => Boolean(x));

  if (!anchors.length) return null;

  const suggestions: { item: MenuItem; reason: string }[] = [];
  const seen = new Set<string>([...cartItemIds, ...anchorItemIds]);
  const primaryAnchor = anchors[anchors.length - 1];

  const rule = ITEM_PAIRINGS[primaryAnchor.id];
  if (rule) {
    for (const id of rule.ids) {
      if (suggestions.length >= max) break;
      if (seen.has(id)) continue;
      const item = getMenuItemById(id);
      if (item) {
        suggestions.push({ item, reason: rule.note });
        seen.add(id);
      }
    }
  }

  const plan = CATEGORY_PAIRING_PLAN[primaryAnchor.category as MenuCategory];
  if (plan) {
    for (const id of plan.pickIds) {
      if (suggestions.length >= max) break;
      if (seen.has(id)) continue;
      const item = getMenuItemById(id);
      if (item) {
        suggestions.push({
          item,
          reason: `Goes well with ${primaryAnchor.name}`,
        });
        seen.add(id);
      }
    }
  }

  if (suggestions.length < 2) {
    const anchorCats = new Set(anchors.map((a) => a.category as MenuCategory));
    for (const cat of anchorCats) {
      const plan = CATEGORY_PAIRING_PLAN[cat];
      if (!plan) continue;
      for (const nextCat of plan.nextCategories) {
        const items = pickItemsForCategory(nextCat, seen, 2, plan.pickIds);
        for (const item of items) {
          if (suggestions.length >= max) break;
          suggestions.push({ item, reason: `Complements your ${cat.toLowerCase()}` });
          seen.add(item.id);
        }
      }
    }
  }

  if (suggestions.length < 1) return null;

  const unique = suggestions.slice(0, max);
  const anchorLabel =
    anchors.length > 1 ? "your order" : primaryAnchor.name;

  return (
    `\n\nWhat would you like with ${anchorLabel}? These pair nicely:\n` +
    unique.map((s) => formatPick(s.item, s.reason)).join("\n")
  );
}

export function buildMealGapAdvice(request: ChatRequest, maxPerCategory = 2): string | null {
  const cartCats = getCartCategories(request);
  const cartIds = getCartItemIds(request);

  if (!cartCats.size) return null;

  const missing = analyzeMealGaps(cartCats);
  if (!missing.length) {
    return "\n\nYour cart looks well rounded — say **place order** when you're ready!";
  }

  const lines: string[] = [];
  lines.push("\n\nTo round out your meal, you might add:");

  for (const category of missing.slice(0, 3)) {
    const plan = CATEGORY_PAIRING_PLAN[category];
    const picks = pickItemsForCategory(
      category,
      cartIds,
      maxPerCategory,
      plan?.pickIds ?? [],
    );
    if (!picks.length) continue;

    const label =
      category === "Drinks"
        ? "a drink"
        : category === "Sides"
          ? "a side"
          : category === "Desserts"
            ? "dessert"
            : category === "Starters"
              ? "a starter"
              : `from ${category}`;

    lines.push(`\n**${label}:**`);
    for (const item of picks) {
      lines.push(`• ${item.name} ($${item.price.toFixed(2)})`);
    }
  }

  if (lines.length <= 1) return null;
  return lines.join("\n");
}

export function formatSmartRecommendations(request: ChatRequest): string {
  const cartCats = getCartCategories(request);
  const cartIds = getCartItemIds(request);

  if (cartCats.size > 0) {
    const missing = analyzeMealGaps(cartCats);
    if (missing.length) {
      const gapBlock = buildMealGapAdvice(request);
      if (gapBlock) {
        return `Based on your cart, here's what would complete your meal nicely:${gapBlock}\n\nSay "Add …" for anything you'd like.`;
      }
    }

    const anchors = [...cartIds];
    const combo = buildComboSuggestions(anchors, cartIds);
    if (combo) {
      return `Looking at your cart —${combo}`;
    }
  }

  const picks = [
    getMenuItemById("soup-du-jour"),
    getMenuItemById("truffle-mushroom-burger"),
    getMenuItemById("harvest-bowl"),
    getMenuItemById("craft-lemonade"),
    getMenuItemById("chocolate-lava-cake"),
  ].filter((x): x is MenuItem => Boolean(x));

  return `Chef's balanced picks for a great meal:\n\n${picks.map(formatItemLine).join("\n")}\n\nOr ask "What are your bowls?" / "Suggestions for starters" to browse a category.`;
}

export function wantsMealCompletionAdvice(message: string): boolean {
  const lower = normalizeText(message);
  return (
    /\bwhat (else|more) should i (add|order|get)\b/i.test(lower) ||
    /\bwhat am i missing\b/i.test(lower) ||
    /\b(complete|round out|finish) (my |the )?(meal|order|cart)\b/i.test(lower) ||
    /\banything else (for|with|to) (my |the )?(order|cart|meal)\b/i.test(lower) ||
    /\b(suggest|recommend) something (else|more)\b/i.test(lower) ||
    /\bhelp me (complete|finish) (my )?(order|meal)\b/i.test(lower) ||
    /\bis my (order|cart|meal) (complete|missing anything)\b/i.test(lower)
  );
}

export function mealCompletionReply(request: ChatRequest): string | null {
  if (!wantsMealCompletionAdvice(request.message)) return null;

  const cartLines = request.cart?.lines ?? [];
  if (!cartLines.length) {
    return (
      'Your cart is empty. Try a starter + main + drink — e.g. "Add soup du jour, truffle burger, and craft lemonade."'
    );
  }

  const gap = buildMealGapAdvice(request, 3);
  if (gap) {
    return `Here's how to round out what you have:${gap}\n\nJust tell me what to add!`;
  }

  return "Your cart already covers the essentials — a main, sides or starters, drinks, and room for dessert. Say **place order** when you're happy, or ask for a category (e.g. \"Suggestions for desserts\").";
}

export function pairingAdviceReply(request: ChatRequest): string | null {
  const lower = normalizeText(request.message);
  if (!/\b(goes with|pair with|good with|what (should|can) i (have|get) with)\b/i.test(lower)) {
    return null;
  }

  const anchor = detectAnchorItem(request.message);
  if (!anchor) return null;

  const cartIds = getCartItemIds(request);
  const combo = buildComboSuggestions([anchor.id], cartIds);
  if (!combo) {
    return listCategoryItems(
      anchor.category as MenuCategory,
      `With ${anchor.name}, guests often enjoy these from our ${anchor.category}:`,
    );
  }

  return `Great question!${combo}`;
}

export function postAddAdvice(request: ChatRequest, addedItemIds: string[]): string {
  const cartIds = getCartItemIds(request);
  const combined = new Set([...cartIds, ...addedItemIds]);

  const combo = buildComboSuggestions(addedItemIds, combined);
  const virtualRequest: ChatRequest = {
    ...request,
    cart: {
      lines: [
        ...(request.cart?.lines ?? []),
        ...addedItemIds
          .filter((id) => !cartIds.has(id))
          .map((id) => {
            const item = getMenuItemById(id);
            return item
              ? {
                  lineId: `virt-${id}`,
                  itemId: id,
                  name: item.name,
                  quantity: 1,
                  unitPrice: item.price,
                  modifiers: {},
                }
              : null;
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x)),
      ],
      subtotal: request.cart?.subtotal ?? 0,
    },
  };

  const gap = buildMealGapAdvice(virtualRequest);
  return (combo ?? "") + (gap ?? "");
}
