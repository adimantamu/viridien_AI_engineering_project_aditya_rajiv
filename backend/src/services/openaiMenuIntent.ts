import OpenAI from "openai";
import { z } from "zod";
import type { ChatRequest } from "../types/index.js";
import {
  MENU_CATEGORIES,
  type MenuCategory,
} from "./mealSuggestions.js";

const MenuIntentSchema = z.object({
  categories: z.array(z.string()),
  isMenuBrowse: z.boolean().optional(),
});

function normalizeCategory(raw: string): MenuCategory | null {
  const t = raw.trim().toLowerCase();
  const found = MENU_CATEGORIES.find((c) => c.toLowerCase() === t);
  if (found) return found;

  const aliasMap: Record<string, MenuCategory> = {
    starter: "Starters",
    starters: "Starters",
    appetizer: "Starters",
    main: "Mains",
    mains: "Mains",
    entree: "Mains",
    bowl: "Bowls",
    bowls: "Bowls",
    salad: "Salads",
    salads: "Salads",
    side: "Sides",
    sides: "Sides",
    drink: "Drinks",
    drinks: "Drinks",
    beverage: "Drinks",
    dessert: "Desserts",
    desserts: "Desserts",
  };
  return aliasMap[t] ?? null;
}

const CLASSIFIER_PROMPT = `You extract which menu categories a restaurant guest wants to browse.

Valid categories (exact spelling): ${MENU_CATEGORIES.join(", ")}

Rules:
- If the user mentions multiple categories (e.g. "starters and bowls", "options in mains and drinks"), return ALL of them in "categories".
- "options in X and Y", "what do you have for X and Y", "show me starters and desserts" → include every category named.
- If they ask about the full menu with no specific category, return isMenuBrowse true and categories [].
- If the message is NOT about browsing the menu (ordering, cart, placing order), return isMenuBrowse false and categories [].

Return JSON only: {"categories": string[], "isMenuBrowse": boolean}`;

/** OpenAI pass to catch multi-category and ambiguous menu questions rules may miss. */
export async function classifyMenuCategoriesWithOpenAI(
  request: ChatRequest,
): Promise<MenuCategory[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return [];

  const openai = new OpenAI({ apiKey });
  const history =
    request.history
      ?.slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n") ?? "";

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CLASSIFIER_PROMPT },
      {
        role: "user",
        content: history
          ? `Conversation:\n${history}\n\nLatest message: ${request.message}`
          : request.message,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];

  const parsed = MenuIntentSchema.parse(JSON.parse(raw));
  if (parsed.isMenuBrowse === false) return [];

  const unique = new Set<MenuCategory>();
  for (const name of parsed.categories) {
    const cat = normalizeCategory(name);
    if (cat) unique.add(cat);
  }

  return MENU_CATEGORIES.filter((c) => unique.has(c));
}
