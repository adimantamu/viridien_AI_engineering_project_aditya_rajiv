import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const IMAGE_ICON_MAP: Record<string, IoniconName> = {
  sandwich: "fast-food-outline",
  burger: "restaurant-outline",
  bowl: "leaf-outline",
  salad: "nutrition-outline",
  fries: "flame-outline",
  soup: "cafe-outline",
  water: "water-outline",
  sparkling: "water-outline",
  lemonade: "wine-outline",
  espresso: "cafe-outline",
  dessert: "ice-cream-outline",
  bruschetta: "pizza-outline",
  calamari: "fish-outline",
  shrimp: "fish-outline",
  salmon: "fish-outline",
  steak: "flame-outline",
  poke: "fish-outline",
  buddha: "leaf-outline",
  mediterranean: "leaf-outline",
  greek: "nutrition-outline",
  kale: "leaf-outline",
  caprese: "nutrition-outline",
  rings: "ellipse-outline",
  bread: "restaurant-outline",
  slaw: "leaf-outline",
  "iced-tea": "cafe-outline",
  cola: "wine-outline",
  cheesecake: "ice-cream-outline",
  tiramisu: "cafe-outline",
  sorbet: "snow-outline",
};

export function getMenuIcon(imageKey: string): IoniconName {
  return IMAGE_ICON_MAP[imageKey] ?? "restaurant-outline";
}
