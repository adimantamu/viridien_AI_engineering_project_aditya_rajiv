export type CartActionType =
  | "ADD"
  | "REMOVE"
  | "UPDATE_QUANTITY"
  | "CLEAR"
  | "SET_MODIFIER";

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
  aliases?: string[];
}

export interface CartAction {
  type: CartActionType;
  itemId?: string;
  quantity?: number;
  lineId?: string;
  modifiers?: Record<string, string>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type OrderActionType = "CANCEL_ORDER" | "CANCEL_ALL_ORDERS";

export interface OrderAction {
  type: OrderActionType;
  orderId?: string;
  orderNumber?: number;
}

export interface ClientOrderSnapshot {
  id: string;
  orderNumber: number;
  status: "placed" | "cancelled";
  total: number;
  itemCount: number;
  createdAt: number;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  cart?: ClientCartSnapshot;
  orders?: ClientOrderSnapshot[];
}

export interface ClientCartLine {
  lineId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: Record<string, string>;
}

export interface ClientCartSnapshot {
  lines: ClientCartLine[];
  subtotal: number;
}

export interface ChatResponse {
  reply: string;
  actions: CartAction[];
  orderActions?: OrderAction[];
  suggestions?: string[];
  parsedBy: "openai" | "rules";
}
