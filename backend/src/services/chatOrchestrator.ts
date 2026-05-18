import { MENU_ITEMS, getMenuItemById } from "../data/menu.js";
import type { CartAction, ChatRequest, ChatResponse, ChatSessionContext } from "../types/index.js";
import { menuInquiryReply } from "./menuInquiry.js";
import {
  buildOrderReply,
  orderDetailReply,
  orderListReply,
  parseOrderActions,
} from "./orderParser.js";
import { buildMealGapAdvice, postAddAdvice } from "./mealSuggestions.js";
import { dedupeCartActions, parseAddActionsFromMessage } from "./orderSegmentParser.js";

export const HIGH_QUANTITY_THRESHOLD = 10;
const TAX_RATE = 0.08;

function isAffirmative(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /^(yes|yeah|yep|yup|sure|ok|okay|confirm|confirmed|go ahead|please do|proceed|do it|place it)\b/.test(
    t,
  );
}

function isNegative(message: string): boolean {
  const t = message.trim().toLowerCase();
  return /^(no|nope|nah|cancel that|never mind|nevermind|don't|do not|not now)\b/.test(t);
}

function wantsPlaceOrder(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(place|submit|checkout)\b.*\b(order|cart)\b/i.test(lower) ||
    /\b(place my order|checkout now|submit order)\b/i.test(lower) ||
    /^(place order|checkout)$/i.test(message.trim())
  );
}

function formatCartSummary(request: ChatRequest): string {
  const lines = request.cart?.lines ?? [];
  if (!lines.length) return "";

  const subtotal = request.cart?.subtotal ?? 0;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const items = lines
    .map((line, i) => {
      const lineTotal = line.unitPrice * line.quantity;
      return `${i + 1}. ${line.quantity}× ${line.name} — $${lineTotal.toFixed(2)}`;
    })
    .join("\n");

  return `${items}\n\nSubtotal: $${subtotal.toFixed(2)}\nTax (8%): $${tax.toFixed(2)}\nTotal: $${total.toFixed(2)}`;
}

export function splitByQuantityThreshold(actions: CartAction[]): {
  immediate: CartAction[];
  pending: CartAction[];
} {
  const immediate: CartAction[] = [];
  const pending: CartAction[] = [];

  for (const action of actions) {
    if (action.type === "ADD" && (action.quantity ?? 1) > HIGH_QUANTITY_THRESHOLD) {
      pending.push(action);
    } else {
      immediate.push(action);
    }
  }

  return { immediate, pending };
}

function describeActions(actions: CartAction[]): string {
  return actions
    .map((a) => {
      const item = a.itemId ? getMenuItemById(a.itemId) : undefined;
      return `${a.quantity ?? 1}× ${item?.name ?? a.itemId}`;
    })
    .join(", ");
}

function handleConfirmation(
  request: ChatRequest,
  session: ChatSessionContext | undefined,
): ChatResponse | null {
  if (!session?.awaitingConfirmation) return null;

  if (isNegative(request.message)) {
    return {
      reply:
        session.awaitingConfirmation === "place_order"
          ? "No problem — your cart is unchanged. Add more items or say place order when ready."
          : "Understood — I won't add those large quantities. Your cart has the other items.",
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null, pendingActions: [] },
      suggestions: ["View cart", "Show my orders", "What are your starters?"],
      parsedBy: "rules",
    };
  }

  if (!isAffirmative(request.message)) {
    return {
      reply: 'Please reply **yes** to confirm or **no** to cancel.',
      actions: [],
      orderActions: [],
      sessionContext: session,
      suggestions: ["Yes", "No"],
      parsedBy: "rules",
    };
  }

  if (session.awaitingConfirmation === "place_order") {
    const summary = formatCartSummary(request);
    if (!summary) {
      return {
        reply: "Your cart is empty — add items before placing an order.",
        actions: [],
        orderActions: [],
        sessionContext: { awaitingConfirmation: null },
        suggestions: ["What are your starters?", "Add spicy chicken sandwich"],
        parsedBy: "rules",
      };
    }

    return {
      reply: `Wonderful — your order is placed!\n\n${summary}\n\nSee the Orders tab for details.`,
      actions: [],
      orderActions: [],
      placeOrderFromCart: true,
      sessionContext: { awaitingConfirmation: null, pendingActions: [] },
      suggestions: ["Show my orders", "Add more items", "View menu"],
      parsedBy: "rules",
    };
  }

  if (session.awaitingConfirmation === "bulk_add" && session.pendingActions?.length) {
    const added = describeActions(session.pendingActions);
    const pendingIds = session.pendingActions
      .filter((a) => a.type === "ADD" && a.itemId)
      .map((a) => a.itemId!);
    const advice = postAddAdvice(request, pendingIds);
    return {
      reply: `Done — I've added ${added} to your cart.${advice}`,
      actions: session.pendingActions,
      orderActions: [],
      sessionContext: { awaitingConfirmation: null, pendingActions: [] },
      suggestions: ["View cart", "Place order", "What else should I add?"],
      parsedBy: "rules",
    };
  }

  return null;
}

function handleCartAdd(request: ChatRequest): ChatResponse | null {
  const raw = [
    ...parseAddActionsFromMessage(request.message),
  ];
  if (!raw.length) return null;

  const actions = dedupeCartActions(raw);
  const { immediate, pending } = splitByQuantityThreshold(actions);

  const addedIds = immediate.filter((a) => a.type === "ADD").map((a) => a.itemId!);
  let reply = "";

  if (immediate.length) {
    const parts = immediate
      .filter((a) => a.type === "ADD")
      .map((a) => {
        const item = getMenuItemById(a.itemId!);
        return `${a.quantity}× ${item?.name ?? "item"}`;
      });
    reply = `I've added ${parts.join(", ")}.`;
    reply += postAddAdvice(request, addedIds);
  }

  if (pending.length) {
    const pendingDesc = describeActions(pending);
    reply += immediate.length
      ? `\n\nThat's a large quantity for ${pendingDesc}. Reply **yes** to add them, or **no** to skip.`
      : `You asked for a large quantity: ${pendingDesc}. Reply **yes** to add to your cart, or **no** to skip.`;

    return {
      reply: reply.trim(),
      actions: immediate,
      orderActions: [],
      sessionContext: { awaitingConfirmation: "bulk_add", pendingActions: pending },
      suggestions: ["Yes", "No", "View cart"],
      parsedBy: "rules",
    };
  }

  if (!immediate.length) return null;

  return {
    reply,
    actions: immediate,
    orderActions: [],
    sessionContext: { awaitingConfirmation: null, pendingActions: [] },
    suggestions: ["Place order", "View cart", "Add truffle fries"],
    parsedBy: "rules",
  };
}

/** Structured flows that should run before generic OpenAI / cart-fail paths. */
export function handleStructuredChat(
  request: ChatRequest,
  session?: ChatSessionContext,
): ChatResponse | null {
  const confirmation = handleConfirmation(request, session);
  if (confirmation) return confirmation;

  const orderActions = parseOrderActions(request);
  if (orderActions.length) {
    const orderReply = buildOrderReply(orderActions, request);
    return {
      reply: orderReply ?? "Done.",
      actions: [],
      orderActions,
      sessionContext: { awaitingConfirmation: null, pendingActions: [] },
      suggestions: ["Show my orders", "View cart", "Add truffle fries"],
      parsedBy: "rules",
    };
  }

  const orderDetail = orderDetailReply(request);
  if (orderDetail) {
    return {
      reply: orderDetail,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["Cancel my last order", "Place order", "View cart"],
      parsedBy: "rules",
    };
  }

  const ordersList = orderListReply(request);
  if (ordersList) {
    return {
      reply: ordersList,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["Cancel my last order", "View cart"],
      parsedBy: "rules",
    };
  }

  if (wantsPlaceOrder(request.message)) {
    const summary = formatCartSummary(request);
    if (!summary) {
      return {
        reply: "Your cart is empty. Tell me what you'd like — e.g. \"Add two spicy chicken sandwiches.\"",
        actions: [],
        orderActions: [],
        sessionContext: { awaitingConfirmation: null },
        suggestions: ["What are your starters?", "Show me the menu"],
        parsedBy: "rules",
      };
    }

    const gapAdvice = buildMealGapAdvice(request) ?? "";

    return {
      reply: `Here's your order summary:\n\n${summary}${gapAdvice}\n\nReply **yes** to place this order, or **no** to keep editing your cart.`,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: "place_order", pendingActions: [] },
      suggestions: ["Yes", "No", "View cart"],
      parsedBy: "rules",
    };
  }

  const menuReply = menuInquiryReply(request);
  if (menuReply) {
    return {
      reply: menuReply,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["Add spicy chicken sandwich", "What are your desserts?", "Place order"],
      parsedBy: "rules",
    };
  }

  const cartAdd = handleCartAdd(request);
  if (cartAdd) return cartAdd;

  return null;
}

export function getGreetingReply(): ChatResponse {
  const picks = [
    MENU_ITEMS.find((i) => i.id === "spicy-chicken-sandwich"),
    MENU_ITEMS.find((i) => i.id === "truffle-mushroom-burger"),
    MENU_ITEMS.find((i) => i.id === "soup-du-jour"),
    MENU_ITEMS.find((i) => i.id === "chocolate-lava-cake"),
  ].filter(Boolean) as typeof MENU_ITEMS;

  const options = picks
    .map((i) => `• ${i.name} ($${i.price.toFixed(2)}) — ${i.description}`)
    .join("\n");

  return {
    reply: `Hello! Welcome to The Intelligent Bistro — I'm delighted to have you with us today.\n\nHow are you? What would you like to enjoy? Here are a few guest favourites:\n\n${options}\n\nTell me what sounds good, or ask "What are your starters?" to browse the menu.`,
    actions: [],
    orderActions: [],
    sessionContext: { awaitingConfirmation: null },
    suggestions: ["What are your starters?", "Add spicy chicken sandwich", "Show my orders"],
    parsedBy: "rules",
  };
}

export function isGreetingMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  return (
    /^(hi|hello|hey|good (morning|afternoon|evening)|howdy)\b/.test(t) ||
    /^how are you\b/.test(t) ||
    /^(what's up|whats up|sup)\b/.test(t)
  );
}
