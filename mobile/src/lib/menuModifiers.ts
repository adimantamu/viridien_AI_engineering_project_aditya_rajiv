import type { MenuItem, MenuModifier } from "../types";

export const SIZE_MODIFIER_ID = "size";

export function computeUnitPrice(item: MenuItem, modifiers: Record<string, string>): number {
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

export function getSizeModifier(item: MenuItem): MenuModifier | undefined {
  return item.modifiers?.find((m) => m.id === SIZE_MODIFIER_ID);
}

export function formatLineModifiers(item: MenuItem | undefined, modifiers: Record<string, string>): string {
  if (!item) return "";
  const parts: string[] = [];
  for (const mod of item.modifiers ?? []) {
    const selected = modifiers[mod.id];
    if (!selected || selected === "none") continue;
    const option = mod.options.find((o) => o.id === selected);
    if (!option) continue;
    if (mod.id === SIZE_MODIFIER_ID) {
      parts.push(option.label);
    } else {
      parts.push(`${mod.name}: ${option.label}`);
    }
  }
  return parts.join(" · ");
}

export function mergeModifiers(
  base: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  return { ...base, ...patch };
}
