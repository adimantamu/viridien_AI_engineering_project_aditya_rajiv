import { create } from "zustand";
import type { CartAction, CartLine, MenuItem } from "../types";
import {
  computeUnitPrice,
  defaultModifiersForItem,
  mergeModifiers,
} from "../lib/menuModifiers";

function lineKey(itemId: string, modifiers: Record<string, string>): string {
  return `${itemId}:${JSON.stringify(modifiers)}`;
}

function modifiersMatch(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyModifiersDefaults(
  item: MenuItem,
  modifiers?: Record<string, string>,
): Record<string, string> {
  return mergeModifiers(defaultModifiersForItem(item), modifiers ?? {});
}

interface CartState {
  lines: CartLine[];
  addItem: (item: MenuItem, quantity?: number, modifiers?: Record<string, string>) => void;
  removeItem: (lineId: string, quantity?: number) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateQuantityByItemId: (
    itemId: string,
    quantity: number,
    modifiers?: Record<string, string>,
  ) => void;
  removeByItemId: (
    itemId: string,
    quantity?: number,
    modifiers?: Record<string, string>,
  ) => void;
  setLineModifier: (
    lineId: string,
    menuItem: MenuItem,
    modifierId: string,
    optionId: string,
  ) => void;
  clearCart: () => void;
  applyActions: (actions: CartAction[], menuItems: MenuItem[]) => void;
  subtotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

  subtotal: () => get().lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),

  itemCount: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),

  addItem: (item, quantity = 1, modifiers) => {
    const mods = applyModifiersDefaults(item, modifiers);
    const key = lineKey(item.id, mods);
    set((state) => {
      const existing = state.lines.find((l) => lineKey(l.itemId, l.modifiers) === key);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.lineId === existing.lineId ? { ...l, quantity: l.quantity + quantity } : l,
          ),
        };
      }
      const line: CartLine = {
        lineId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        itemId: item.id,
        name: item.name,
        quantity,
        unitPrice: computeUnitPrice(item, mods),
        modifiers: mods,
      };
      return { lines: [...state.lines, line] };
    });
  },

  removeItem: (lineId, quantity = 1) => {
    set((state) => ({
      lines: state.lines
        .map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity - quantity } : l))
        .filter((l) => l.quantity > 0),
    }));
  },

  updateQuantity: (lineId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(lineId, 999);
      return;
    }
    set((state) => ({
      lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
    }));
  },

  updateQuantityByItemId: (itemId, quantity, modifiers) => {
    const line = get().lines.find((l) => {
      if (l.itemId !== itemId) return false;
      if (modifiers) return modifiersMatch(l.modifiers, modifiers);
      return true;
    });
    if (line) get().updateQuantity(line.lineId, quantity);
  },

  removeByItemId: (itemId, quantity = 1, modifiers) => {
    const line = get().lines.find((l) => {
      if (l.itemId !== itemId) return false;
      if (modifiers) return modifiersMatch(l.modifiers, modifiers);
      return true;
    });
    if (line) get().removeItem(line.lineId, quantity);
  },

  setLineModifier: (lineId, menuItem, modifierId, optionId) => {
    set((state) => ({
      lines: state.lines.map((l) => {
        if (l.lineId !== lineId) return l;
        const newMods = { ...l.modifiers, [modifierId]: optionId };
        return {
          ...l,
          modifiers: newMods,
          unitPrice: computeUnitPrice(menuItem, newMods),
        };
      }),
    }));
  },

  clearCart: () => set({ lines: [] }),

  applyActions: (actions, menuItems) => {
    for (const action of actions) {
      const item = menuItems.find((m) => m.id === action.itemId);
      switch (action.type) {
        case "ADD":
          if (item) get().addItem(item, action.quantity ?? 1, action.modifiers);
          break;
        case "REMOVE":
          if (action.itemId) {
            get().removeByItemId(action.itemId, action.quantity ?? 1, action.modifiers);
          }
          break;
        case "UPDATE_QUANTITY":
          if (action.itemId && action.quantity) {
            get().updateQuantityByItemId(action.itemId, action.quantity, action.modifiers);
          }
          break;
        case "SET_MODIFIER":
          if (action.itemId && action.modifiers && item) {
            for (const [modId, optId] of Object.entries(action.modifiers)) {
              const lines = get().lines.filter((l) => l.itemId === action.itemId);
              if (!lines.length) break;
              const target = lines[0];
              const newMods = { ...target.modifiers, [modId]: optId };
              set((state) => ({
                lines: state.lines.map((l) =>
                  l.lineId === target.lineId
                    ? {
                        ...l,
                        modifiers: newMods,
                        unitPrice: computeUnitPrice(item, newMods),
                      }
                    : l,
                ),
              }));
            }
          }
          break;
        case "CLEAR":
          get().clearCart();
          break;
        default:
          break;
      }
    }
  },
}));
