import type { MenuItem, MenuModifier } from "../types/index.js";

export const SIZE_MODIFIER_ID = "size";
export const SIZE_OPTION_IDS = ["small", "medium", "large"] as const;
export type SizeOptionId = (typeof SIZE_OPTION_IDS)[number];

/** Map legacy drink sizes to standard ids. */
export function normalizeSizeOptionId(raw: string): SizeOptionId | "regular" {
  const t = raw.toLowerCase().trim();
  if (t === "regular" || t === "reg") return "regular";
  if (t === "sm" || t === "small" || t === "petite") return "small";
  if (t === "md" || t === "med" || t === "medium") return "medium";
  if (t === "lg" || t === "large" || t === "big") return "large";
  return t as SizeOptionId;
}

export function normalizeSizeToStandard(raw: string): SizeOptionId {
  const n = normalizeSizeOptionId(raw);
  return n === "regular" ? "medium" : n;
}

function sizeDeltasForCategory(
  category: string,
  basePrice: number,
): { small: number; medium: number; large: number } {
  switch (category) {
    case "Drinks":
      return {
        small: 0,
        medium: Math.round(Math.min(0.75, basePrice * 0.12) * 100) / 100,
        large: Math.round(Math.min(1.5, basePrice * 0.22) * 100) / 100,
      };
    case "Starters":
      return { small: 0, medium: 2, large: 3.5 };
    case "Mains":
      return { small: 0, medium: 3.5, large: 7 };
    case "Bowls":
      return { small: 0, medium: 2.5, large: 4.5 };
    case "Salads":
      return { small: 0, medium: 2, large: 3.5 };
    case "Sides":
      return { small: 0, medium: 1.5, large: 2.5 };
    case "Desserts":
      return { small: 0, medium: 1, large: 2 };
    default:
      return { small: 0, medium: 2, large: 4 };
  }
}

export function buildSizeModifier(category: string, basePrice: number): MenuModifier {
  const d = sizeDeltasForCategory(category, basePrice);
  return {
    id: SIZE_MODIFIER_ID,
    name: "Size",
    required: true,
    options: [
      { id: "small", label: "Small", priceDelta: d.small },
      { id: "medium", label: "Medium", priceDelta: d.medium },
      { id: "large", label: "Large", priceDelta: d.large },
    ],
  };
}

export function withStandardSizeModifiers(item: MenuItem): MenuItem {
  const sizeMod = buildSizeModifier(item.category, item.price);
  const otherMods = (item.modifiers ?? []).filter((m) => m.id !== SIZE_MODIFIER_ID);
  return { ...item, modifiers: [...otherMods, sizeMod] };
}

export function computeUnitPrice(
  item: MenuItem,
  modifiers: Record<string, string>,
): number {
  let price = item.price;
  for (const mod of item.modifiers ?? []) {
    const selected = modifiers[mod.id];
    const option = mod.options.find((o) => o.id === selected);
    if (option?.priceDelta) price += option.priceDelta;
  }
  return Math.round(price * 100) / 100;
}

export function defaultModifiersForItem(item: MenuItem): Record<string, string> {
  const result: Record<string, string> = {};
  for (const mod of item.modifiers ?? []) {
    if (mod.id === SIZE_MODIFIER_ID) {
      result[mod.id] = mod.options.find((o) => o.id === "medium")?.id ?? mod.options[0].id;
    } else if (mod.required && mod.options[0]) {
      result[mod.id] = mod.options[0].id;
    }
  }
  return result;
}

export function formatModifiersLabel(
  item: MenuItem | undefined,
  modifiers: Record<string, string> | undefined,
): string {
  if (!item || !modifiers) return "";
  const parts: string[] = [];
  for (const mod of item.modifiers ?? []) {
    const selected = modifiers[mod.id];
    if (!selected || selected === "none") continue;
    const option = mod.options.find((o) => o.id === selected);
    if (mod.id === SIZE_MODIFIER_ID && option) {
      parts.push(option.label);
    } else if (option) {
      parts.push(`${mod.name}: ${option.label}`);
    }
  }
  return parts.join(" · ");
}
