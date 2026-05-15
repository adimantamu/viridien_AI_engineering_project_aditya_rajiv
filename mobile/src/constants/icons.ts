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
};

export function getMenuIcon(imageKey: string): IoniconName {
  return IMAGE_ICON_MAP[imageKey] ?? "restaurant-outline";
}
