import type { MenuItem } from "../types/index.js";
import { withStandardSizeModifiers } from "./menuModifiers.js";

const MENU_ITEMS_RAW: MenuItem[] = [
  {
    id: "spicy-chicken-sandwich",
    name: "Spicy Chicken Sandwich",
    description: "Crispy chicken, house slaw, pickled jalapeños, brioche bun.",
    category: "Mains",
    price: 14.5,
    image: "sandwich",
    tags: ["spicy", "popular"],
    aliases: ["spicy chicken", "hot chicken sandwich", "chicken sandwich"],
    modifiers: [
      {
        id: "spice",
        name: "Spice Level",
        options: [
          { id: "mild", label: "Mild" },
          { id: "medium", label: "Medium" },
          { id: "hot", label: "Hot" },
          { id: "extra-hot", label: "Extra Hot" },
        ],
      },
    ],
  },
  {
    id: "truffle-mushroom-burger",
    name: "Truffle Mushroom Burger",
    description: "Grass-fed beef, wild mushrooms, truffle aioli, aged cheddar.",
    category: "Mains",
    price: 17.0,
    image: "burger",
    tags: ["chef-special"],
    aliases: ["truffle burger", "mushroom burger", "burger", "burgers"],
    modifiers: [
      {
        id: "doneness",
        name: "Doneness",
        options: [
          { id: "medium-rare", label: "Medium Rare" },
          { id: "medium", label: "Medium" },
          { id: "well-done", label: "Well Done" },
        ],
      },
    ],
  },
  {
    id: "harvest-bowl",
    name: "Harvest Grain Bowl",
    description: "Quinoa, roasted squash, feta, pomegranate, lemon tahini.",
    category: "Bowls",
    price: 13.0,
    image: "bowl",
    tags: ["vegetarian", "healthy"],
    aliases: ["grain bowl", "harvest bowl", "veggie bowl"],
  },
  {
    id: "caesar-salad",
    name: "Classic Caesar Salad",
    description: "Romaine, parmesan crisps, anchovy dressing, garlic croutons.",
    category: "Salads",
    price: 11.0,
    image: "salad",
    tags: ["light"],
    aliases: ["caesar", "caesar salad", "salad"],
    modifiers: [
      {
        id: "protein",
        name: "Add Protein",
        options: [
          { id: "none", label: "None" },
          { id: "chicken", label: "Grilled Chicken", priceDelta: 4 },
          { id: "shrimp", label: "Shrimp", priceDelta: 6 },
        ],
      },
    ],
  },
  {
    id: "truffle-fries",
    name: "Truffle Parmesan Fries",
    description: "Hand-cut fries, truffle oil, parmesan, herbs.",
    category: "Sides",
    price: 7.5,
    image: "fries",
    tags: ["shareable"],
    aliases: ["fries", "truffle fries", "parmesan fries"],
  },
  {
    id: "soup-du-jour",
    name: "Soup du Jour",
    description: "Chef's daily seasonal soup — ask your server for today's pick.",
    category: "Starters",
    price: 8.0,
    image: "soup",
    tags: ["warm"],
    aliases: ["soup", "daily soup"],
  },
  {
    id: "water",
    name: "Still Water",
    description: "Filtered still water.",
    category: "Drinks",
    price: 3.0,
    image: "water",
    tags: ["drink"],
    aliases: ["water", "bottled water", "still water"],
    modifiers: [
      {
        id: "size",
        name: "Size",
        required: true,
        options: [
          { id: "small", label: "Small", priceDelta: 0 },
          { id: "medium", label: "Medium", priceDelta: 0.5 },
          { id: "large", label: "Large", priceDelta: 1 },
        ],
      },
    ],
  },
  {
    id: "sparkling-water",
    name: "Sparkling Water",
    description: "Chilled sparkling mineral water.",
    category: "Drinks",
    price: 3.5,
    image: "sparkling",
    tags: ["drink"],
    aliases: ["sparkling water", "sparkling"],
    modifiers: [
      {
        id: "size",
        name: "Size",
        required: true,
        options: [
          { id: "small", label: "Small", priceDelta: 0 },
          { id: "medium", label: "Medium", priceDelta: 0.5 },
          { id: "large", label: "Large", priceDelta: 1 },
        ],
      },
    ],
  },
  {
    id: "craft-lemonade",
    name: "Craft Lavender Lemonade",
    description: "House lemonade with lavender syrup and fresh mint.",
    category: "Drinks",
    price: 5.5,
    image: "lemonade",
    tags: ["drink", "signature"],
    aliases: ["lemonade", "lavender lemonade"],
    modifiers: [
      {
        id: "size",
        name: "Size",
        options: [
          { id: "regular", label: "Regular" },
          { id: "large", label: "Large", priceDelta: 1 },
        ],
      },
    ],
  },
  {
    id: "espresso",
    name: "Double Espresso",
    description: "Single-origin espresso, pulled to order.",
    category: "Drinks",
    price: 4.0,
    image: "espresso",
    tags: ["coffee"],
    aliases: ["espresso", "coffee", "double espresso"],
  },
  {
    id: "chocolate-lava-cake",
    name: "Chocolate Lava Cake",
    description: "Warm fondant, vanilla bean gelato, cocoa nib crumble.",
    category: "Desserts",
    price: 9.5,
    image: "dessert",
    tags: ["dessert", "popular"],
    aliases: [
      "lava cake",
      "chocolate cake",
      "choc lava cake",
      "choco lava cake",
      "chocolate lava cake",
      "dessert",
    ],
  },
  {
    id: "tomato-bruschetta",
    name: "Tomato Bruschetta",
    description: "Grilled sourdough, heirloom tomatoes, basil, balsamic glaze.",
    category: "Starters",
    price: 9.0,
    image: "bruschetta",
    tags: ["vegetarian", "shareable"],
    aliases: ["bruschetta", "tomato bruschetta"],
  },
  {
    id: "crispy-calamari",
    name: "Crispy Calamari",
    description: "Lightly fried calamari, lemon aioli, pickled peppers.",
    category: "Starters",
    price: 12.5,
    image: "calamari",
    tags: ["seafood"],
    aliases: ["calamari", "fried calamari"],
  },
  {
    id: "shrimp-cocktail",
    name: "Chilled Shrimp Cocktail",
    description: "Poached shrimp, classic cocktail sauce, lemon.",
    category: "Starters",
    price: 14.0,
    image: "shrimp",
    tags: ["seafood", "gluten-free"],
    aliases: ["shrimp cocktail", "prawn cocktail"],
  },
  {
    id: "grilled-salmon",
    name: "Grilled Atlantic Salmon",
    description: "Pan-seared salmon, dill cream, asparagus, lemon capers.",
    category: "Mains",
    price: 22.0,
    image: "salmon",
    tags: ["seafood", "healthy"],
    aliases: [
      "salmon",
      "grilled salmon",
      "grilled atlantic salmon",
      "atlantic salmon",
      "grilled atlantic sandwiches",
      "fish",
    ],
  },
  {
    id: "classic-ribeye",
    name: "Classic Ribeye Steak",
    description: "12oz ribeye, herb butter, roasted garlic, seasonal vegetables.",
    category: "Mains",
    price: 32.0,
    image: "steak",
    tags: ["chef-special"],
    aliases: ["ribeye", "steak", "rib eye"],
    modifiers: [
      {
        id: "doneness",
        name: "Doneness",
        options: [
          { id: "medium-rare", label: "Medium Rare" },
          { id: "medium", label: "Medium" },
          { id: "well-done", label: "Well Done" },
        ],
      },
    ],
  },
  {
    id: "poke-bowl",
    name: "Ahi Poke Bowl",
    description: "Sushi-grade tuna, sushi rice, avocado, edamame, sesame.",
    category: "Bowls",
    price: 16.5,
    image: "poke",
    tags: ["seafood", "popular"],
    aliases: ["poke bowl", "poke", "tuna bowl"],
  },
  {
    id: "buddha-bowl",
    name: "Buddha Power Bowl",
    description: "Brown rice, chickpeas, roasted vegetables, tahini drizzle.",
    category: "Bowls",
    price: 14.0,
    image: "buddha",
    tags: ["vegan", "healthy"],
    aliases: ["buddha bowl", "vegan bowl"],
  },
  {
    id: "mediterranean-bowl",
    name: "Mediterranean Bowl",
    description: "Couscous, falafel, hummus, cucumber, feta, olives.",
    category: "Bowls",
    price: 13.5,
    image: "mediterranean",
    tags: ["vegetarian"],
    aliases: ["mediterranean bowl", "falafel bowl"],
  },
  {
    id: "greek-salad",
    name: "Greek Village Salad",
    description: "Tomatoes, cucumber, red onion, feta, kalamata olives, oregano.",
    category: "Salads",
    price: 12.0,
    image: "greek",
    tags: ["vegetarian", "gluten-free"],
    aliases: ["greek salad", "village salad"],
  },
  {
    id: "kale-quinoa-salad",
    name: "Kale & Quinoa Salad",
    description: "Massaged kale, quinoa, dried cranberries, almonds, lemon vinaigrette.",
    category: "Salads",
    price: 12.5,
    image: "kale",
    tags: ["healthy", "vegetarian"],
    aliases: ["kale salad", "quinoa salad"],
  },
  {
    id: "caprese-salad",
    name: "Caprese Salad",
    description: "Buffalo mozzarella, vine tomatoes, basil, aged balsamic.",
    category: "Salads",
    price: 11.5,
    image: "caprese",
    tags: ["vegetarian"],
    aliases: ["caprese", "mozzarella salad"],
  },
  {
    id: "onion-rings",
    name: "Beer-Battered Onion Rings",
    description: "Crispy rings, smoked paprika aioli.",
    category: "Sides",
    price: 6.5,
    image: "rings",
    tags: ["shareable"],
    aliases: ["onion rings", "rings"],
  },
  {
    id: "garlic-bread",
    name: "Garlic Herb Focaccia",
    description: "Warm focaccia, roasted garlic butter, sea salt.",
    category: "Sides",
    price: 5.5,
    image: "bread",
    tags: ["vegetarian"],
    aliases: ["garlic bread", "focaccia"],
  },
  {
    id: "coleslaw",
    name: "House Coleslaw",
    description: "Creamy slaw with apple cider vinegar and celery seed.",
    category: "Sides",
    price: 4.5,
    image: "slaw",
    tags: ["vegetarian"],
    aliases: ["slaw", "cole slaw", "coleslaw"],
  },
  {
    id: "iced-tea",
    name: "Peach Iced Tea",
    description: "Brewed black tea, natural peach, fresh mint.",
    category: "Drinks",
    price: 4.5,
    image: "iced-tea",
    tags: ["drink"],
    aliases: ["iced tea", "peach tea", "tea"],
    modifiers: [
      {
        id: "size",
        name: "Size",
        options: [
          { id: "regular", label: "Regular" },
          { id: "large", label: "Large", priceDelta: 1 },
        ],
      },
    ],
  },
  {
    id: "craft-cola",
    name: "Craft Cola",
    description: "Small-batch cola with cane sugar and citrus notes.",
    category: "Drinks",
    price: 4.0,
    image: "cola",
    tags: ["drink"],
    aliases: ["cola", "soda", "coke"],
  },
  {
    id: "ny-cheesecake",
    name: "New York Cheesecake",
    description: "Classic baked cheesecake, berry compote, graham crust.",
    category: "Desserts",
    price: 8.5,
    image: "cheesecake",
    tags: ["dessert"],
    aliases: ["cheesecake", "ny cheesecake"],
  },
  {
    id: "tiramisu",
    name: "Tiramisu",
    description: "Espresso-soaked ladyfingers, mascarpone, cocoa dust.",
    category: "Desserts",
    price: 9.0,
    image: "tiramisu",
    tags: ["dessert", "coffee"],
    aliases: ["tiramisu"],
  },
  {
    id: "citrus-sorbet",
    name: "Citrus Sorbet Trio",
    description: "Lemon, blood orange, and grapefruit sorbets.",
    category: "Desserts",
    price: 7.5,
    image: "sorbet",
    tags: ["dessert", "vegan", "gluten-free"],
    aliases: ["sorbet", "citrus sorbet"],
  },
];

export const MENU_ITEMS: MenuItem[] = MENU_ITEMS_RAW.map(withStandardSizeModifiers);

export function getMenuItemById(id: string): MenuItem | undefined {
  return MENU_ITEMS.find((item) => item.id === id);
}

export function getMenuCatalogForPrompt(): string {
  return MENU_ITEMS.map((item) => {
    const sizeMod = item.modifiers?.find((m) => m.id === "size");
    const sizePrices =
      sizeMod?.options
        .map((o) => `${o.id}=$${(item.price + (o.priceDelta ?? 0)).toFixed(2)}`)
        .join(", ") ?? "n/a";
    const otherMods =
      item.modifiers
        ?.filter((m) => m.id !== "size")
        .map(
          (m) =>
            `${m.id}: [${m.options.map((o) => `${o.id}=${o.label}`).join(", ")}]`,
        )
        .join("; ") ?? "";
    const aliases = item.aliases?.join(", ") ?? "";
    return `- id="${item.id}" name="${item.name}" base=$${item.price.toFixed(2)} sizes={${sizePrices}}${otherMods ? ` other={${otherMods}}` : ""} category=${item.category} aliases=[${aliases}]`;
  }).join("\n");
}
