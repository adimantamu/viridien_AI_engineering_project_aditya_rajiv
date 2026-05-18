import { MENU_ITEMS, getMenuItemById } from "../data/menu.js";
import type { CartAction, ChatRequest, ChatResponse, ChatSessionContext } from "../types/index.js";
import { buildMenuInquiryResponse, menuInquiryReply } from "./menuInquiry.js";
import {
  buildOrderReply,
  orderDetailReply,
  orderListReply,
  parseOrderActions,
} from "./orderParser.js";
import {
  extractAddText,
  messageHasAddIntent,
  messageHasCartMutation,
  messageHasMenuInquiry,
  normalizeCompoundMessage,
} from "./messageNormalizer.js";
import {
  buildMealGapAdvice,
  defaultActionChips,
  detectMenuCategories,
  buildMultiCategoryMenuResponse,
  listCategoryItems,
  mergeChips,
  postAddAdviceStructured,
} from "./mealSuggestions.js";
import { formatModifiersLabel } from "../data/menuModifiers.js";
import { sizeLabelForAction } from "./sizeParser.js";
import { parseCartActionsWithOpenAI } from "./openaiCartActions.js";
import {
  dedupeCartActions,
  parseAllCartActionsFromMessage,
  parseUpdateQuantityFromMessage,
} from "./orderSegmentParser.js";

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

function describeCartChangeSummary(actions: CartAction[]): string {
  const parts: string[] = [];
  for (const a of actions) {
    const item = a.itemId ? getMenuItemById(a.itemId) : undefined;
    const name = item?.name ?? "item";
    const qty = a.quantity ?? 1;
    const size = sizeLabelForAction(a.itemId, a.modifiers);
    if (a.type === "ADD") parts.push(`added ${qty}× ${name}${size}`);
    else if (a.type === "REMOVE") parts.push(`removed ${qty}× ${name}${size}`);
    else if (a.type === "UPDATE_QUANTITY") parts.push(`set ${name}${size} to ${qty}`);
    else if (a.type === "SET_MODIFIER" && a.modifiers) {
      const label = formatModifiersLabel(item, a.modifiers);
      parts.push(`updated ${name} to ${label || "new options"}`);
    } else if (a.type === "CLEAR") parts.push("cleared your cart");
  }
  return parts.join(", ");
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
    const advice = postAddAdviceStructured(request, pendingIds);
    const chips = mergeChips(advice.chips);
    let reply = `✅ Done — I've added ${added} to your cart.`;
    if (advice.headline) reply += `\n\n${advice.headline}`;
    return {
      reply,
      actions: session.pendingActions,
      orderActions: [],
      sessionContext: { awaitingConfirmation: null, pendingActions: [] },
      suggestions: chips.map((c) => c.message),
      suggestionChips: chips,
      recommendationBlocks: advice.blocks,
      parsedBy: "rules",
    };
  }

  return null;
}

async function resolveCartActions(request: ChatRequest, messageOverride?: string): Promise<{
  actions: CartAction[];
  parsedBy: "openai" | "rules";
}> {
  const req = messageOverride ? { ...request, message: messageOverride } : request;

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const aiActions = await parseCartActionsWithOpenAI(req);
      if (aiActions?.length) {
        return { actions: aiActions, parsedBy: "openai" };
      }
    } catch (error) {
      console.error("[cart] OpenAI parse failed, using rules:", error);
    }
  }

  const normalized = normalizeCompoundMessage(req.message);
  const addText =
    messageHasMenuInquiry(normalized) && extractAddText(normalized)
      ? extractAddText(normalized)
      : normalized;
  const rules = dedupeCartActions([
    ...parseAllCartActionsFromMessage(addText),
    ...parseUpdateQuantityFromMessage(addText),
  ]);
  return { actions: rules, parsedBy: "rules" };
}

export function buildCartMutationResponse(
  request: ChatRequest,
  actions: CartAction[],
  parsedBy: "openai" | "rules" = "rules",
): ChatResponse | null {
  if (!actions.length) return null;

  const { immediate, pending } = splitByQuantityThreshold(actions);

  const addedIds = immediate.filter((a) => a.type === "ADD").map((a) => a.itemId!);
  let reply = "";

  let recommendationBlocks;
  let suggestionChips;

  if (immediate.length) {
    const summary = describeCartChangeSummary(immediate);
    const advice =
      addedIds.length && addedIds.length <= 2
        ? postAddAdviceStructured(request, addedIds)
        : null;
    if (advice) {
      recommendationBlocks = advice.blocks;
      suggestionChips = mergeChips(advice.chips);
    }
    reply = `✅ Done — ${summary}.`;
    if (advice?.headline) {
      reply += `\n\n${advice.headline}`;
    }
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
      suggestionChips: [
        { label: "✅ Yes", message: "yes" },
        { label: "❌ No", message: "no" },
        { label: "📋 View cart", message: "What's in my cart?" },
      ],
      recommendationBlocks,
      parsedBy,
    };
  }

  if (!immediate.length) return null;

  const chips = suggestionChips ?? mergeChips([], defaultActionChips());

  return {
    reply,
    actions: immediate,
    orderActions: [],
    sessionContext: { awaitingConfirmation: null, pendingActions: [] },
    suggestions: chips.map((c) => c.message),
    suggestionChips: chips,
    recommendationBlocks,
    parsedBy,
  };
}

async function handleCompoundMessage(request: ChatRequest): Promise<ChatResponse | null> {
  const message = normalizeCompoundMessage(request.message);
  const hasMenu = messageHasMenuInquiry(message);
  const hasAdd = messageHasAddIntent(message);

  if (!hasMenu || !hasAdd) {
    return null;
  }

  const categories = detectMenuCategories(message);
  let menuPart = "";
  if (categories.length > 1) {
    menuPart = buildMultiCategoryMenuResponse(categories).reply;
  } else if (categories.length === 1) {
    menuPart = listCategoryItems(categories[0], `Here are our ${categories[0]}:`);
  } else {
    const menuOnly = menuInquiryReply({ ...request, message });
    if (!menuOnly) return null;
    menuPart = menuOnly;
  }

  const cartResponse = await handleCartAdd({ ...request, message });
  if (!cartResponse) {
    return {
      reply: menuPart,
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["View cart", "Place order"],
      parsedBy: "rules",
    };
  }

  return {
    ...cartResponse,
    reply: `${menuPart}\n\n${cartResponse.reply}`,
    sessionContext: cartResponse.sessionContext,
    suggestions: cartResponse.suggestions ?? ["View cart", "Place order"],
    parsedBy: "rules",
  };
}

async function handleCartAdd(request: ChatRequest): Promise<ChatResponse | null> {
  const { actions, parsedBy } = await resolveCartActions(request);
  return buildCartMutationResponse(request, actions, parsedBy);
}

/** Structured flows that should run before generic OpenAI / cart-fail paths. */
export async function handleStructuredChat(
  request: ChatRequest,
  session?: ChatSessionContext,
): Promise<ChatResponse | null> {
  const activeSession = session ?? request.session;
  const confirmation = handleConfirmation(request, activeSession);
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

  const compound = await handleCompoundMessage(request);
  if (compound) return compound;

  const menuResponse = buildMenuInquiryResponse(request);
  if (menuResponse) return menuResponse;

  if (messageHasCartMutation(request.message)) {
    const cartFirst = await handleCartAdd(request);
    if (cartFirst) return cartFirst;
  }

  const cartAdd = await handleCartAdd(request);
  if (cartAdd) return cartAdd;

  const cartView = handleCartView(request);
  if (cartView) return cartView;

  return null;
}

function handleCartView(request: ChatRequest): ChatResponse | null {
  const message = request.message.trim();
  if (
    !/(what('s| is) in my cart|show (my )?cart|view cart|list.*cart|my cart\b)/i.test(message)
  ) {
    return null;
  }

  const lines = request.cart?.lines ?? [];
  if (!lines.length) {
    return {
      reply: "Your cart is empty. Browse the menu or tell me what you'd like to order.",
      actions: [],
      orderActions: [],
      sessionContext: { awaitingConfirmation: null },
      suggestions: ["What are your starters?", "Add truffle fries", "Show my orders"],
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
    sessionContext: { awaitingConfirmation: null },
    suggestions: ["Place order", "Show my orders", "Clear cart"],
    parsedBy: "rules",
  };
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
