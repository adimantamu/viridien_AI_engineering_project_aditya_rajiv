import Constants from "expo-constants";
import { Platform } from "react-native";
import type { CartLine, ChatMessage, ChatResponse, MenuItem } from "../types";

function getApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured && !configured.includes("localhost")) {
    return configured;
  }
  // Android emulator uses 10.0.2.2 for host machine localhost
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001";
  }
  return configured ?? "http://localhost:3001";
}

const API_BASE = getApiBaseUrl();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchMenu(): Promise<MenuItem[]> {
  const data = await request<{ items: MenuItem[] }>("/api/menu");
  return data.items;
}

export async function sendChatMessage(params: {
  message: string;
  history: Pick<ChatMessage, "role" | "content">[];
  cart: { lines: CartLine[]; subtotal: number };
}): Promise<ChatResponse> {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function checkHealth(): Promise<boolean> {
  try {
    await request("/health");
    return true;
  } catch {
    return false;
  }
}

export function getApiUrl(): string {
  return API_BASE;
}
