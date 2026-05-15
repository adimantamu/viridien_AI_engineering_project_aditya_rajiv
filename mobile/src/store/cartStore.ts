import { create } from "zustand";
import type { CartAction, CartLine, MenuItem } from "../types";

function lineKey(itemId: string, modifiers: Record<string, string>): string {
  return `${itemId}:${JSON.stringify(modifiers)}`;
}

function computeUnitPrice(item: MenuItem, modifiers: Record<string, string>): number {
  let price = item.price;
  if (item.modifiers) {
    for (const mod of item.modifiers) {
      const selected = modifiers[mod.id];
      const option = mod.options.find((o) => o.id === selected);
      if (option?.priceDelta) price += option.priceDelta;
    }
  }
  return price;
}

function applyModifiersDefaults(item: MenuItem, modifiers?: Record<string, string>): Record<string, string> {
  const result = { ...modifiers };
  if (item.modifiers) {
    for (const mod of item.modifiers) {
      if (!result[mod.id] && mod.options[0]) {
        if (mod.required || mod.id === "size") {
          result[mod.id] = mod.options.find((o) => o.id === "medium")?.id ?? mod.options[0].id;
        }
      }
    }
  }
  return result;
}

interface CartState {
  lines: CartLine[];
  addItem: (item: MenuItem, quantity?: number, modifiers?: Record<string, string>) => void;
  removeItem: (lineId: string, quantity?: number) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateQuantityByItemId: (itemId: string, quantity: number) => void;
  removeByItemId: (itemId: string, quantity?: number) => void;
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

  updateQuantityByItemId: (itemId, quantity) => {
    const line = get().lines.find((l) => l.itemId === itemId);
    if (line) get().updateQuantity(line.lineId, quantity);
  },

  removeByItemId: (itemId, quantity = 1) => {
    const line = get().lines.find((l) => l.itemId === itemId);
    if (line) get().removeItem(line.lineId, quantity);
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
          if (action.itemId) get().removeByItemId(action.itemId, action.quantity ?? 1);
          break;
        case "UPDATE_QUANTITY":
          if (action.itemId && action.quantity) {
            get().updateQuantityByItemId(action.itemId, action.quantity);
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
