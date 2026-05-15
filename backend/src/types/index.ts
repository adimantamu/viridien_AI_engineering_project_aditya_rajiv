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

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  cart?: ClientCartSnapshot;
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
  suggestions?: string[];
  parsedBy: "openai" | "rules";
}
