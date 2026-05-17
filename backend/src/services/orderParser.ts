import type { ChatRequest, ClientOrderSnapshot, OrderAction } from "../types/index.js";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s#-]/g, " ").replace(/\s+/g, " ").trim();
}

function placedOrders(request: ChatRequest): ClientOrderSnapshot[] {
  return request.orders?.filter((o) => o.status === "placed") ?? [];
}

function formatModifiers(modifiers?: Record<string, string>): string {
  if (!modifiers || !Object.keys(modifiers).length) return "";
  return ` (${Object.values(modifiers).join(", ")})`;
}

function formatOrderLines(order: ClientOrderSnapshot): string {
  if (!order.lines?.length) {
    return `Order #${order.orderNumber} — ${order.itemCount} items, $${order.total.toFixed(2)} total (open Orders tab for line items).`;
  }

  const lines = order.lines
    .map((line, index) => {
      const mods = formatModifiers(line.modifiers);
      return `${index + 1}. ${line.quantity}× ${line.name}${mods} — $${line.lineTotal.toFixed(2)} ($${line.unitPrice.toFixed(2)} each)`;
    })
    .join("\n");

  return `Order #${order.orderNumber} — ${order.itemCount} items, $${order.total.toFixed(2)} total (incl. tax):\n\n${lines}`;
}

function resolveTargetOrder(request: ChatRequest): ClientOrderSnapshot | null {
  const active = placedOrders(request);
  if (!active.length) return null;

  const lower = normalize(request.message);
  const numberMatch = lower.match(/order\s*#?\s*(\d{3,})/i);
  if (numberMatch) {
    const orderNumber = parseInt(numberMatch[1], 10);
    const found = active.find((o) => o.orderNumber === orderNumber);
    if (found) return found;
  }

  return [...active].sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function wantsOrderDetail(message: string): boolean {
  const lower = normalize(message);
  if (/(show|view|list)\s+(my\s+)?orders?\s*$/i.test(message.trim())) {
    return false;
  }
  return (
    (/(list|show|tell|give).*(all|every|full|complete)?.*(items?|details?|everything)/i.test(
      message,
    ) &&
      /(order|ordered)/i.test(message)) ||
    /(what|which).*(did i|have i).*(order|ordered|placed)/i.test(message) ||
    /(current|latest|last|my)\s+order/i.test(message) ||
    /order\s*#?\s*\d+.*(items?|detail|contain)/i.test(message) ||
    /what\s+(is|'s)\s+in\s+(my\s+)?(current\s+)?order/i.test(lower) ||
    /items?\s+in\s+(my\s+)?(current\s+)?order/i.test(lower)
  );
}

export function orderDetailReply(request: ChatRequest): string | null {
  if (!wantsOrderDetail(request.message)) return null;

  const target = resolveTargetOrder(request);
  if (!target) {
    return "You have no active orders. Place an order from your cart when you're ready.";
  }

  return formatOrderLines(target);
}

export function parseOrderActions(request: ChatRequest): OrderAction[] {
  const message = request.message.trim();
  const lower = normalize(message);
  const orders = placedOrders(request);

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
  if (wantsOrderDetail(message)) return null;

  if (!/(show|view|list|what are)\s+(my\s+)?orders?/i.test(message)) {
    return null;
  }

  const active = placedOrders(request);
  if (!active.length) {
    return "You have no active orders. Place an order from your cart when you're ready.";
  }

  if (active.length === 1 && active[0].lines?.length) {
    return `You have 1 active order:\n\n${formatOrderLines(active[0])}`;
  }

  const summary = active
    .map((o) => `#${o.orderNumber} ($${o.total.toFixed(2)}, ${o.itemCount} items)`)
    .join("\n");
  return `You have ${active.length} active orders:\n${summary}\n\nAsk me to "list items in order #1001" for full details.`;
}
