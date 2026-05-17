import { create } from "zustand";
import type { CartLine, Order, OrderAction, OrderStatus } from "../types";
import { useCartStore } from "./cartStore";

const TAX_RATE = 0.08;
let nextOrderNumber = 1001;

function cloneLines(lines: CartLine[]): CartLine[] {
  return lines.map((l) => ({ ...l, modifiers: { ...l.modifiers } }));
}

interface OrdersState {
  orders: Order[];
  placeOrderFromCart: () => Order | null;
  cancelOrder: (orderId: string) => boolean;
  cancelAllPlaced: () => number;
  applyOrderActions: (actions: OrderAction[]) => void;
  getOrderSnapshots: () => {
    id: string;
    orderNumber: number;
    status: OrderStatus;
    total: number;
    itemCount: number;
    createdAt: number;
  }[];
  activeOrderCount: () => number;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],

  activeOrderCount: () => get().orders.filter((o) => o.status === "placed").length,

  getOrderSnapshots: () =>
    get().orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      itemCount: o.lines.reduce((sum, l) => sum + l.quantity, 0),
      createdAt: o.createdAt,
    })),

  placeOrderFromCart: () => {
    const cartLines = useCartStore.getState().lines;
    if (!cartLines.length) return null;

    const lines = cloneLines(cartLines);
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const order: Order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderNumber: nextOrderNumber++,
      status: "placed",
      lines,
      subtotal,
      tax,
      total,
      createdAt: Date.now(),
    };

    set((state) => ({ orders: [order, ...state.orders] }));
    useCartStore.getState().clearCart();
    return order;
  },

  cancelOrder: (orderId) => {
    const order = get().orders.find((o) => o.id === orderId && o.status === "placed");
    if (!order) return false;

    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: "cancelled" as const, cancelledAt: Date.now() }
          : o,
      ),
    }));
    return true;
  },

  cancelAllPlaced: () => {
    const placed = get().orders.filter((o) => o.status === "placed");
    if (!placed.length) return 0;

    const now = Date.now();
    set((state) => ({
      orders: state.orders.map((o) =>
        o.status === "placed" ? { ...o, status: "cancelled", cancelledAt: now } : o,
      ),
    }));
    return placed.length;
  },

  applyOrderActions: (actions) => {
    for (const action of actions) {
      switch (action.type) {
        case "CANCEL_ALL_ORDERS":
          get().cancelAllPlaced();
          break;
        case "CANCEL_ORDER": {
          const target =
            get().orders.find(
              (o) =>
                o.status === "placed" &&
                (o.id === action.orderId || o.orderNumber === action.orderNumber),
            ) ?? get().orders.find((o) => o.status === "placed");
          if (target) get().cancelOrder(target.id);
          break;
        }
        default:
          break;
      }
    }
  },
}));
