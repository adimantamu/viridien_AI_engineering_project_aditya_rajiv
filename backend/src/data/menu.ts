import type { MenuItem } from "../types/index.js";

export const MENU_ITEMS: MenuItem[] = [
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
    aliases: ["truffle burger", "mushroom burger"],
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
    aliases: ["caesar", "salad"],
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
    aliases: ["lava cake", "chocolate cake", "dessert"],
  },
];

export function getMenuItemById(id: string): MenuItem | undefined {
  return MENU_ITEMS.find((item) => item.id === id);
}

export function getMenuCatalogForPrompt(): string {
  return MENU_ITEMS.map((item) => {
    const mods =
      item.modifiers
        ?.map(
          (m) =>
            `${m.id}: [${m.options.map((o) => `${o.id}=${o.label}`).join(", ")}]`,
        )
        .join("; ") ?? "none";
    const aliases = item.aliases?.join(", ") ?? "";
    return `- id="${item.id}" name="${item.name}" price=$${item.price.toFixed(2)} category=${item.category} modifiers={${mods}} aliases=[${aliases}]`;
  }).join("\n");
}
