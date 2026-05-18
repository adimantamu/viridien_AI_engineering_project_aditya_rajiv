import { MENU_ITEMS, getMenuItemById } from "../data/menu.js";
import type {
  ChatRecommendationBlock,
  ChatRecommendationPick,
  ChatRequest,
  ChatSuggestionChip,
  MenuItem,
} from "../types/index.js";
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

const CATEGORY_EMOJI: Record<MenuCategory, string> = {
  Starters: "🥗",
  Mains: "🍔",
  Bowls: "🥙",
  Salads: "🥬",
  Sides: "🍟",
  Drinks: "🥤",
  Desserts: "🍰",
};

const ITEM_EMOJI: Record<string, string> = {
  "truffle-fries": "🍟",
  "garlic-bread": "🥖",
  "onion-rings": "🧅",
  "coleslaw": "🥗",
  "craft-cola": "🥤",
  "craft-lemonade": "🍋",
  "sparkling-water": "💧",
  "still-water": "💧",
  "iced-tea": "🧊",
  "espresso": "☕",
  "chocolate-lava-cake": "🍫",
  "ny-cheesecake": "🍰",
  "citrus-sorbet": "🍨",
  "spicy-chicken-sandwich": "🌶️",
  "truffle-mushroom-burger": "🍄",
  "classic-ribeye": "🥩",
  "grilled-salmon": "🐟",
  "soup-du-jour": "🍲",
  "tomato-bruschetta": "🍅",
  "harvest-bowl": "🌾",
  "caesar-salad": "🥗",
  "shrimp-cocktail": "🦐",
  "poke-bowl": "🍣",
};

const PICK_NOTE_OVERRIDES: Record<string, string> = {
  "truffle-fries": "Golden truffle parmesan crunch",
  "craft-cola": "Classic fizz with a rich main",
  "craft-lemonade": "Bright citrus — cuts through richness",
  "garlic-bread": "Warm, buttery steakhouse classic",
  "chocolate-lava-cake": "Indulgent sweet finish",
  "sparkling-water": "Crisp palate cleanser",
  "caesar-salad": "Fresh greens on the side",
  "coleslaw": "Cool crunch for spicy mains",
  "iced-tea": "Refreshing Southern-style sip",
  "espresso": "Bold finish after dessert",
  "citrus-sorbet": "Light, zesty closer",
};

function emojiForItem(item: MenuItem): string {
  return ITEM_EMOJI[item.id] ?? CATEGORY_EMOJI[item.category as MenuCategory] ?? "✨";
}

function toRecommendationPick(item: MenuItem, reason: string): ChatRecommendationPick {
  return {
    itemId: item.id,
    name: item.name,
    price: item.price,
    emoji: emojiForItem(item),
    note: PICK_NOTE_OVERRIDES[item.id] ?? reason,
    addMessage: `Add ${item.name}`,
  };
}

function chipFromPick(pick: ChatRecommendationPick): ChatSuggestionChip {
  return {
    label: `${pick.emoji} ${pick.name}`,
    message: pick.addMessage,
  };
}

function collectComboSuggestions(
  anchorItemIds: string[],
  cartItemIds: Set<string>,
  max = 5,
): { item: MenuItem; reason: string }[] {
  const anchors = anchorItemIds
    .map((id) => getMenuItemById(id))
    .filter((x): x is MenuItem => Boolean(x));

  if (!anchors.length) return [];

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
          reason: `Chef's pick with ${primaryAnchor.name}`,
        });
        seen.add(id);
      }
    }
  }

  if (suggestions.length < 2) {
    const anchorCats = new Set(anchors.map((a) => a.category as MenuCategory));
    for (const cat of anchorCats) {
      const catPlan = CATEGORY_PAIRING_PLAN[cat];
      if (!catPlan) continue;
      for (const nextCat of catPlan.nextCategories) {
        const items = pickItemsForCategory(nextCat, seen, 2, catPlan.pickIds);
        for (const item of items) {
          if (suggestions.length >= max) break;
          suggestions.push({
            item,
            reason: `Balances your ${cat.toLowerCase()}`,
          });
          seen.add(item.id);
        }
      }
    }
  }

  return suggestions.slice(0, max);
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
        `\\bwhat\\s+(?:are\\s+)?(?:your\\s+)?${aliasPattern}\\s+do\\s+you\\s+(have|serve|offer)\\b`,
        "i",
      ),
      points: 115,
    },
    {
      pattern: new RegExp(
        `\\bwhat\\s+(are|is)\\s+(there\\s+)?(for|in)\\s+(the\\s+)?${aliasPattern}\\b`,
        "i",
      ),
      points: 118,
    },
    {
      pattern: new RegExp(
        `\\btell\\s+me\\s+(what\\s+)?(are\\s+)?(there\\s+)?(for|in)\\s+(the\\s+)?${aliasPattern}\\b`,
        "i",
      ),
      points: 118,
    },
    {
      pattern: new RegExp(
        `\\bwhat\\s+do\\s+you\\s+have\\s+(for|in)\\s+(the\\s+)?${aliasPattern}\\b`,
        "i",
      ),
      points: 112,
    },
    {
      pattern: new RegExp(`\\b(there\\s+)?(for|in)\\s+(the\\s+)?${aliasPattern}\\b`, "i"),
      points: 55,
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

function isCategoryBrowseQuestion(lower: string): boolean {
  return (
    /\b(options?|choices|dishes?|items?|menu|what are|what do you have|suggestions?|recommend|tell me|show|list|have)\b/i.test(
      lower,
    ) || /\bwhat\s+(are|is)\s+there\b/i.test(lower)
  );
}

function scoreAllCategoriesInText(text: string): Map<MenuCategory, number> {
  const scores = new Map<MenuCategory, number>();

  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    const score = scoreCategoryInText(text, alias, category);
    if (score > 0) {
      scores.set(category, Math.max(scores.get(category) ?? 0, score));
    }
  }

  return scores;
}

function detectSingleCategoryFromClause(clause: string): MenuCategory | null {
  const scores = scoreAllCategoriesInText(clause);
  if (scores.size) {
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const lower = normalizeText(clause);
  const fromItem = detectCategoryFromMenuItemMention(lower);
  if (fromItem) return fromItem;

  return detectCategoryFromKeywordMention(lower);
}

function categoriesFromAliasMentions(lower: string): MenuCategory[] {
  const found = new Set<MenuCategory>();
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (alias.length < 3) continue;
    if (new RegExp(`\\b${escapeRegex(alias)}\\b`, "i").test(lower)) {
      found.add(category);
    }
  }
  return MENU_CATEGORIES.filter((c) => found.has(c));
}

/** All menu categories the user is asking about (e.g. "starters and bowls"). */
export function detectMenuCategories(message: string): MenuCategory[] {
  const normalized = normalizeCompoundMessage(message);
  const inquiryText = extractMenuInquiryText(normalized);
  const lower = normalizeText(inquiryText);
  const merged = new Map<MenuCategory, number>();

  const hasMultiJoin = /\s+(and|or|&|,|plus)\s+/i.test(inquiryText);
  if (hasMultiJoin) {
    const parts = inquiryText
      .split(/\s+and\s+|\s+or\s+|\s*,\s*|\s+&\s+|\s+plus\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const cat = detectSingleCategoryFromClause(part);
      if (cat) merged.set(cat, (merged.get(cat) ?? 0) + 120);
    }
  }

  if (isCategoryBrowseQuestion(lower)) {
    for (const cat of categoriesFromAliasMentions(lower)) {
      merged.set(cat, (merged.get(cat) ?? 0) + 85);
    }
  }

  for (const [category, score] of scoreAllCategoriesInText(inquiryText)) {
    merged.set(category, Math.max(merged.get(category) ?? 0, score));
  }

  const MIN = 40;
  const ranked = [...merged.entries()]
    .filter(([, score]) => score >= MIN)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length > 1) {
    return ranked.map(([category]) => category);
  }
  if (ranked.length === 1) {
    return [ranked[0][0]];
  }

  const single = detectSingleCategoryFromClause(inquiryText);
  return single ? [single] : [];
}

export function detectMenuCategory(message: string): MenuCategory | null {
  return detectMenuCategories(message)[0] ?? null;
}

/** Fallback: "for starters", "any desserts", etc. */
function detectCategoryFromKeywordMention(lower: string): MenuCategory | null {
  if (!/\b(for|in|about|any|some)\b/i.test(lower) && !/\btell me\b/i.test(lower)) {
    return null;
  }

  const scores: { category: MenuCategory; score: number }[] = [];
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
    if (!pattern.test(lower)) continue;
    const existing = scores.find((s) => s.category === category);
    if (existing) {
      existing.score += 1;
    } else {
      scores.push({ category, score: 1 });
    }
  }

  if (!scores.length) return null;
  scores.sort((a, b) => b.score - a.score);
  return scores[0].category;
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

/** Rich menu browse response with cards + tap-to-order chips. */
export function buildCategoryMenuResponse(
  category: MenuCategory,
  options?: { intro?: string; isSuggestion?: boolean },
): {
  reply: string;
  blocks: ChatRecommendationBlock[];
  chips: ChatSuggestionChip[];
} {
  const items = MENU_ITEMS.filter((i) => i.category === category);
  const catEmoji = CATEGORY_EMOJI[category];

  if (!items.length) {
    return {
      reply: `We don't have items listed under ${category} right now.`,
      blocks: [],
      chips: defaultActionChips(),
    };
  }

  const intro =
    options?.intro ??
    (options?.isSuggestion
      ? `✨ Great taste — here are ${category} I'd recommend:`
      : `${catEmoji} **${category}** on our menu today:`);

  const picks = items.map((item) =>
    toRecommendationPick(
      item,
      item.description.length > 72 ? `${item.description.slice(0, 69)}…` : item.description,
    ),
  );

  const blocks: ChatRecommendationBlock[] = [
    {
      title: options?.isSuggestion ? `Chef's ${category} picks` : `All ${category}`,
      titleEmoji: catEmoji,
      picks,
    },
  ];

  const itemChips = picks.map(chipFromPick);
  const chips = mergeChips(itemChips, [
    { label: "🍽️ Full menu", message: "Show me the menu" },
    ...defaultActionChips().slice(0, 2),
  ]);

  return {
    reply: `${intro}\n\nTap any dish below to add it, or use the quick suggestions.`,
    blocks,
    chips,
  };
}

const CATEGORY_INTRO_LINES: Record<MenuCategory, string> = {
  Starters: "🥗 **Starters** — perfect to begin your meal",
  Mains: "🍔 **Mains** — hearty signatures from our kitchen",
  Bowls: "🥙 **Bowls** — balanced, flavourful one-bowl meals",
  Salads: "🥬 **Salads** — fresh and satisfying",
  Sides: "🍟 **Sides** — the perfect accompaniment",
  Drinks: "🥤 **Drinks** — to sip and refresh",
  Desserts: "🍰 **Desserts** — sweet finishes",
};

/** Combined browse for multiple categories (starters and bowls, etc.). */
export function buildMultiCategoryMenuResponse(
  categories: MenuCategory[],
  options?: { isSuggestion?: boolean },
): {
  reply: string;
  blocks: ChatRecommendationBlock[];
  chips: ChatSuggestionChip[];
} {
  const unique = MENU_CATEGORIES.filter((c) => categories.includes(c));
  if (!unique.length) {
    return { reply: "I couldn't find those categories on our menu.", blocks: [], chips: defaultActionChips() };
  }

  if (unique.length === 1) {
    return buildCategoryMenuResponse(unique[0], { isSuggestion: options?.isSuggestion });
  }

  const blocks: ChatRecommendationBlock[] = [];
  const chips: ChatSuggestionChip[] = [];

  for (const category of unique) {
    const section = buildCategoryMenuResponse(category, {
      isSuggestion: options?.isSuggestion,
      intro: CATEGORY_INTRO_LINES[category],
    });
    blocks.push(...section.blocks);
    chips.push(...section.chips);
  }

  const names = unique.map((c) => `**${c}**`).join(" and ");
  const reply =
    unique.length === 2
      ? `Here are your options in ${names}:\n\nTap any dish below to add it, or use the quick suggestions.`
      : `Here are your options across ${names}:\n\nTap any dish below to add it, or use the quick suggestions.`;

  return {
    reply,
    blocks,
    chips: mergeChips(chips, defaultActionChips().slice(0, 2)),
  };
}

export function buildComboSuggestions(
  anchorItemIds: string[],
  cartItemIds: Set<string>,
  max = 5,
): string | null {
  const unique = collectComboSuggestions(anchorItemIds, cartItemIds, max);
  if (!unique.length) return null;

  const anchors = anchorItemIds
    .map((id) => getMenuItemById(id))
    .filter((x): x is MenuItem => Boolean(x));
  const primaryAnchor = anchors[anchors.length - 1];
  const anchorLabel = anchors.length > 1 ? "your order" : primaryAnchor?.name ?? "your order";

  return (
    `\n\nWhat would you like with ${anchorLabel}? These pair nicely:\n` +
    unique.map((s) => formatPick(s.item, s.reason)).join("\n")
  );
}

export function buildMealGapBlocks(
  request: ChatRequest,
  maxPerCategory = 2,
): ChatRecommendationBlock[] {
  const cartCats = getCartCategories(request);
  const cartIds = getCartItemIds(request);
  if (!cartCats.size) return [];

  const missing = analyzeMealGaps(cartCats);
  if (!missing.length) return [];

  const blocks: ChatRecommendationBlock[] = [];

  for (const category of missing.slice(0, 3)) {
    const plan = CATEGORY_PAIRING_PLAN[category];
    const picks = pickItemsForCategory(category, cartIds, maxPerCategory, plan?.pickIds ?? []);
    if (!picks.length) continue;

    const label =
      category === "Drinks"
        ? "Quench your thirst"
        : category === "Sides"
          ? "Complete with a side"
          : category === "Desserts"
            ? "Sweet finish"
            : category === "Starters"
              ? "Start strong"
              : `More from ${category}`;

    blocks.push({
      title: label,
      titleEmoji: CATEGORY_EMOJI[category],
      picks: picks.map((item) =>
        toRecommendationPick(
          item,
          category === "Drinks"
            ? "Perfect with your meal"
            : `Round out your ${[...cartCats][0]?.toLowerCase() ?? "order"}`,
        ),
      ),
    });
  }

  return blocks;
}

export interface StructuredPostAddAdvice {
  headline: string;
  blocks: ChatRecommendationBlock[];
  chips: ChatSuggestionChip[];
}

export function postAddAdviceStructured(
  request: ChatRequest,
  addedItemIds: string[],
): StructuredPostAddAdvice {
  const cartIds = getCartItemIds(request);
  const combined = new Set([...cartIds, ...addedItemIds]);

  const comboRows = collectComboSuggestions(addedItemIds, combined, 5);
  const primary = getMenuItemById(addedItemIds[addedItemIds.length - 1] ?? "");

  const blocks: ChatRecommendationBlock[] = [];

  if (comboRows.length) {
    blocks.push({
      title: primary
        ? `Hand-picked for your ${primary.name}`
        : "Goes great with what you ordered",
      titleEmoji: "✨",
      picks: comboRows.map((s) => toRecommendationPick(s.item, s.reason)),
    });
  }

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

  const gapBlocks = buildMealGapBlocks(virtualRequest, 2);
  for (const block of gapBlocks) {
    blocks.push(block);
  }

  const seenChips = new Set<string>();
  const chips: ChatSuggestionChip[] = [];

  for (const block of blocks) {
    for (const pick of block.picks) {
      if (seenChips.has(pick.itemId)) continue;
      seenChips.add(pick.itemId);
      chips.push(chipFromPick(pick));
    }
  }

  const headline =
    blocks.length > 0
      ? primary
        ? `🎉 Nice choice! A few ideas to go with your ${primary.name}:`
        : "🎉 Here are a few ideas picked just for you:"
      : "";

  return { headline, blocks, chips: chips.slice(0, 8) };
}

export function defaultActionChips(): ChatSuggestionChip[] {
  return [
    { label: "🛒 Place order", message: "Place order" },
    { label: "📋 View cart", message: "What's in my cart?" },
    { label: "🍟 Add truffle fries", message: "Add truffle parmesan fries" },
    { label: "🥤 Add a drink", message: "Add craft lavender lemonade" },
  ];
}

export function mergeChips(
  personalized: ChatSuggestionChip[],
  extras: ChatSuggestionChip[] = defaultActionChips(),
  max = 10,
): ChatSuggestionChip[] {
  const seen = new Set<string>();
  const out: ChatSuggestionChip[] = [];
  for (const chip of [...personalized, ...extras]) {
    const key = chip.message.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
    if (out.length >= max) break;
  }
  return out;
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
  const structured = postAddAdviceStructured(request, addedItemIds);
  if (structured.blocks.length) {
    return structured.headline;
  }
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
