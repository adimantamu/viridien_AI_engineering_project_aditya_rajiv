import type { ChatRequest, ChatResponse } from "../types/index.js";
import { buildMenuInquiryResponse } from "./menuInquiry.js";
import {
  buildCategoryMenuResponse,
  buildMultiCategoryMenuResponse,
  detectMenuCategories,
  MENU_CATEGORIES,
  type MenuCategory,
} from "./mealSuggestions.js";
import { messageHasMenuInquiry } from "./messageNormalizer.js";
import { classifyMenuCategoriesWithOpenAI } from "./openaiMenuIntent.js";

function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function mergeCategoryLists(...lists: MenuCategory[][]): MenuCategory[] {
  const seen = new Set<MenuCategory>();
  for (const list of lists) {
    for (const cat of list) seen.add(cat);
  }
  return MENU_CATEGORIES.filter((c) => seen.has(c));
}

function menuResponseFromCategories(
  categories: MenuCategory[],
  parsedBy: ChatResponse["parsedBy"],
): ChatResponse {
  const rich =
    categories.length > 1
      ? buildMultiCategoryMenuResponse(categories)
      : buildCategoryMenuResponse(categories[0]);

  return {
    reply: rich.reply,
    actions: [],
    orderActions: [],
    sessionContext: { awaitingConfirmation: null },
    suggestions: rich.chips.map((c) => c.message),
    suggestionChips: rich.chips,
    recommendationBlocks: rich.blocks,
    parsedBy,
  };
}

/** Rules + OpenAI for menu browse — handles multi-category and ambiguous phrasing. */
export async function resolveMenuBrowse(request: ChatRequest): Promise<ChatResponse | null> {
  if (!messageHasMenuInquiry(request.message)) return null;

  const ruleCats = detectMenuCategories(request.message);
  const fromRules = buildMenuInquiryResponse(request);

  if (fromRules?.parsedBy === "rules-multi" || ruleCats.length > 1) {
    return fromRules ?? menuResponseFromCategories(ruleCats, "rules-multi");
  }

  const likelyMulti =
    /\b(and|or|&|,|plus)\b/i.test(request.message) && messageHasMenuInquiry(request.message);

  if (fromRules && !likelyMulti) {
    return fromRules;
  }

  if (!isOpenAiConfigured()) {
    return fromRules;
  }

  try {
    const aiCats = await classifyMenuCategoriesWithOpenAI(request);
    const merged = mergeCategoryLists(ruleCats, aiCats);

    if (merged.length > 1) {
      return menuResponseFromCategories(merged, "openai+rules");
    }
    if (merged.length === 1 && !fromRules) {
      return menuResponseFromCategories(merged, "openai+rules");
    }
  } catch (error) {
    console.error("[menu] OpenAI category classifier failed:", error);
  }

  return fromRules;
}
