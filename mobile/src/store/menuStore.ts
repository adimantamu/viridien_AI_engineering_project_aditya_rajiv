import { create } from "zustand";
import { fetchMenu } from "../lib/api";
import type { MenuItem } from "../types";

interface MenuState {
  items: MenuItem[];
  loading: boolean;
  error: string | null;
  loaded: boolean;
  loadMenu: () => Promise<void>;
  getItem: (id: string) => MenuItem | undefined;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  loaded: false,

  getItem: (id) => get().items.find((i) => i.id === id),

  loadMenu: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const items = await fetchMenu();
      set({ items, loaded: true, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load menu",
        loading: false,
      });
    }
  },
}));
