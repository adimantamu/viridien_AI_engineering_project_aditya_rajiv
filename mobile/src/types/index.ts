export type CartActionType =
  | "ADD"
  | "REMOVE"
  | "UPDATE_QUANTITY"
  | "CLEAR"
  | "SET_MODIFIER";

export type OrderActionType = "CANCEL_ORDER" | "CANCEL_ALL_ORDERS";

export type OrderStatus = "placed" | "cancelled";

export interface MenuModifierOption {
  id: string;
  label: string;
  priceDelta?: number;
}

export interface MenuModifier {
  id: string;
  name: string;
  required?: boolean;
  options: MenuModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image: string;
  tags: string[];
  modifiers?: MenuModifier[];
}

export interface CartAction {
  type: CartActionType;
  itemId?: string;
  quantity?: number;
  lineId?: string;
  modifiers?: Record<string, string>;
}

export interface OrderAction {
  type: OrderActionType;
  orderId?: string;
  orderNumber?: number;
}

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: Record<string, string>;
}

export interface Order {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  lines: CartLine[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: number;
  cancelledAt?: number;
}

export interface ChatSuggestionChip {
  label: string;
  message: string;
}

export interface ChatRecommendationPick {
  itemId: string;
  name: string;
  price: number;
  emoji: string;
  note: string;
  addMessage: string;
}

export interface ChatRecommendationBlock {
  title: string;
  titleEmoji: string;
  picks: ChatRecommendationPick[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  suggestionChips?: ChatSuggestionChip[];
  recommendationBlocks?: ChatRecommendationBlock[];
}

export interface ClientOrderLineSnapshot {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers?: Record<string, string>;
}

export interface ClientOrderSnapshot {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: number;
  lines: ClientOrderLineSnapshot[];
}

export type ConfirmationType = "place_order" | "bulk_add";

export interface ChatSessionContext {
  awaitingConfirmation?: ConfirmationType | null;
  pendingActions?: CartAction[];
}

export interface ChatResponse {
  reply: string;
  actions: CartAction[];
  orderActions?: OrderAction[];
  suggestions?: string[];
  suggestionChips?: ChatSuggestionChip[];
  recommendationBlocks?: ChatRecommendationBlock[];
  parsedBy: "openai" | "rules" | "rules-multi" | "openai+rules";
  placeOrderFromCart?: boolean;
  sessionContext?: ChatSessionContext;
}
