import type { ChatRequest, OrderAction } from "../types/index.js";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s#-]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseOrderActions(request: ChatRequest): OrderAction[] {
  const message = request.message.trim();
  const lower = normalize(message);
  const orders = request.orders?.filter((o) => o.status === "placed") ?? [];

  if (!orders.length) {
    if (/(cancel|delete)\s+(my\s+)?orders?/i.test(message)) {
      return [];
    }
    return [];
  }

  if (/(cancel|delete)\s+all\s+(my\s+)?orders?/i.test(lower)) {
    return [{ type: "CANCEL_ALL_ORDERS" }];
  }

  const numberMatch = lower.match(/(?:cancel|delete)\s+(?:order\s*)?#?(\d{3,})/i);
  if (numberMatch) {
    const orderNumber = parseInt(numberMatch[1], 10);
    const target = orders.find((o) => o.orderNumber === orderNumber);
    if (target) {
      return [{ type: "CANCEL_ORDER", orderId: target.id, orderNumber }];
    }
  }

  if (
    /(cancel|delete)\s+(my\s+)?(last|latest|recent)\s+order/i.test(lower) ||
    /(cancel|delete)\s+(my\s+)?order$/i.test(lower) ||
    /cancel\s+it$/i.test(lower)
  ) {
    const latest = [...orders].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (latest) {
      return [{ type: "CANCEL_ORDER", orderId: latest.id, orderNumber: latest.orderNumber }];
    }
  }

  return [];
}

export function buildOrderReply(actions: OrderAction[], request: ChatRequest): string | null {
  if (!actions.length) return null;

  const orders = request.orders ?? [];

  for (const action of actions) {
    if (action.type === "CANCEL_ALL_ORDERS") {
      const count = orders.filter((o) => o.status === "placed").length;
      return count > 0
        ? `Cancelled ${count} active order${count === 1 ? "" : "s"}. Check the Orders tab for details.`
        : "You don't have any active orders to cancel.";
    }
    if (action.type === "CANCEL_ORDER") {
      const target = orders.find(
        (o) => o.id === action.orderId || o.orderNumber === action.orderNumber,
      );
      if (target) {
        return `Cancelled order #${target.orderNumber}.`;
      }
      return "I couldn't find that order. Check the Orders tab for your order numbers.";
    }
  }

  return null;
}

export function orderListReply(request: ChatRequest): string | null {
  const message = request.message.trim();
  if (!/(show|view|list|what are)\s+(my\s+)?orders?/i.test(message)) {
    return null;
  }

  const active = request.orders?.filter((o) => o.status === "placed") ?? [];
  if (!active.length) {
    return "You have no active orders. Place an order from your cart when you're ready.";
  }

  const summary = active
    .map((o) => `#${o.orderNumber} ($${o.total.toFixed(2)}, ${o.itemCount} items)`)
    .join(", ");
  return `Active orders: ${summary}. Open the Orders tab for full details.`;
}
