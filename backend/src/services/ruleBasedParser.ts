import { MENU_ITEMS, getMenuItemById } from "../data/menu.js";
import type { CartAction, ChatRequest, ChatResponse } from "../types/index.js";
import { menuInquiryReply } from "./menuInquiry.js";
import {
  buildOrderReply,
  orderDetailReply,
  orderListReply,
  parseOrderActions,
} from "./orderParser.js";
import {
  dedupeCartActions,
  extractQuantity,
  matchMenuItem,
  normalizeText,
  parseAllCartActionsFromMessage,
  splitOrderSegments,
} from "./orderSegmentParser.js";

function parseRemoveActions(message: string): CartAction[] {
  const actions: CartAction[] = [];
  const lower = normalizeText(message);
  if (!/(remove|delete|take off)/.test(lower)) return actions;

  const segments = message
    .replace(/.*(remove|delete|take off)\s+/i, "")
    .split(/\s+and\s+|,\s*|\.\s+/i);

  for (const segment of segments) {
    const { quantity, rest } = extractQuantity(segment);
    const item = matchMenuItem(rest);
    if (item) {
      actions.push({ type: "REMOVE", itemId: item.id, quantity });
    }
  }
  return actions;
}

function parseUpdateQuantity(message: string): CartAction[] {
  const match = message.match(
    /(change|update|set)\s+(.+?)\s+to\s+(\d+)|make\s+it\s+(\d+)\s+(.+)/i,
  );
  if (!match) return [];
  const qty = parseInt(match[3] ?? match[4], 10);
  const itemPhrase = match[2] ?? match[5];
  const item = matchMenuItem(itemPhrase);
  if (!item || !qty) return [];
  return [{ type: "UPDATE_QUANTITY", itemId: item.id, quantity: qty }];
}

function buildReply(actions: CartAction[], message: string): string {
  if (!actions.length) {
    const segments = splitOrderSegments(message);
    const unmatched = segments.filter((s) => s !== "__CLEAR__" && !matchMenuItem(s));
    if (unmatched.length) {
      return `I understood part of your order but couldn't match: "${unmatched.join('", "')}". Try naming items from the menu (e.g. sparkling water, spicy chicken sandwich).`;
    }
    return 'I couldn\'t match that to our menu. Try: "What are your starters?" or "Add two spicy chicken sandwiches and two sparkling waters."';
  }

  const added: string[] = [];
  const other: string[] = [];

  for (const action of actions) {
    const item = action.itemId ? getMenuItemById(action.itemId) : undefined;
    const name = item?.name ?? "item";
    const qty = action.quantity ?? 1;
    const modStr =
      action.modifiers && Object.keys(action.modifiers).length
        ? ` (${Object.entries(action.modifiers)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")})`
        : "";

    switch (action.type) {
      case "ADD":
        added.push(`${qty}× ${name}${modStr}`);
        break;
      case "REMOVE":
        other.push(`removed ${qty}× ${name}`);
        break;
      case "UPDATE_QUANTITY":
        other.push(`set ${name} to ${qty}`);
        break;
      case "CLEAR":
        other.push("cleared your cart");
        break;
      default:
        break;
    }
  }

  if (added.length) {
    return `I've added ${added.join(", ")}.`;
  }
  if (other.length) {
    return other.join(", ").charAt(0).toUpperCase() + other.join(", ").slice(1) + ".";
  }
  return "Done.";
}

export function parseWithRules(request: ChatRequest): ChatResponse {
  const message = request.message.trim();

  const orderDetail = orderDetailReply(request);
  if (orderDetail) {
    return {
      reply: orderDetail,
      actions: [],
      orderActions: [],
      suggestions: ["Cancel my last order", "Show my orders", "What are your starters?"],
      parsedBy: "rules",
    };
  }

  const ordersList = orderListReply(request);
  if (ordersList) {
    return {
      reply: ordersList,
      actions: [],
      orderActions: [],
      suggestions: ["Cancel my last order", "Add truffle fries", "View cart"],
      parsedBy: "rules",
    };
  }

  const orderActions = parseOrderActions(request);
  if (orderActions.length) {
    const orderReply = buildOrderReply(orderActions, request);
    return {
      reply: orderReply ?? "Done.",
      actions: [],
      orderActions,
      suggestions: ["Show my orders", "Add a large water", "View cart"],
      parsedBy: "rules",
    };
  }

  if (/(what('s| is) in my cart|show (my )?cart|view cart|list.*cart)/i.test(message)) {
    const lines = request.cart?.lines ?? [];
    if (!lines.length) {
      return {
        reply: "Your cart is empty. Browse the menu or tell me what you'd like to order.",
        actions: [],
        orderActions: [],
        suggestions: ["Add truffle fries", "Show my orders", "What are your starters?"],
        parsedBy: "rules",
      };
    }

    const detail = lines
      .map((line, index) => {
        const lineTotal = line.unitPrice * line.quantity;
        return `${index + 1}. ${line.quantity}× ${line.name} — $${lineTotal.toFixed(2)}`;
      })
      .join("\n");
    const subtotal = request.cart?.subtotal ?? 0;

    return {
      reply: `Your cart (${lines.length} line${lines.length === 1 ? "" : "s"}, $${subtotal.toFixed(2)} subtotal):\n\n${detail}`,
      actions: [],
      orderActions: [],
      suggestions: ["Place order", "Show my orders", "Clear cart"],
      parsedBy: "rules",
    };
  }

  const menuReply = menuInquiryReply(request);
  if (menuReply) {
    return {
      reply: menuReply,
      actions: [],
      orderActions: [],
      suggestions: [
        "Add spicy chicken sandwich",
        "Add two sparkling waters",
        "What are your desserts?",
      ],
      parsedBy: "rules",
    };
  }

  const actions = dedupeCartActions([
    ...parseRemoveActions(message),
    ...parseAllCartActionsFromMessage(message),
    ...parseUpdateQuantity(message),
  ]);

  return {
    reply: buildReply(actions, message),
    actions,
    orderActions: [],
    suggestions: actions.length
      ? ["View cart", "Show my orders", "What are your starters?"]
      : ["What are your starters?", "Add two spicy chicken sandwiches", "Show my orders"],
    parsedBy: "rules",
  };
}
