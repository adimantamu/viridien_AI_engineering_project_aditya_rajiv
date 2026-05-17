import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { CartLine, ChatMessage, ChatResponse, ClientOrderSnapshot, MenuItem } from "../types";

type ApiExtra = {
  apiUrl?: string;
  apiUrlLocal?: string;
  apiUrlDevice?: string;
};

function getExtra(): ApiExtra {
  return (Constants.expoConfig?.extra ?? {}) as ApiExtra;
}

export function getApiBaseUrl(): string {
  const extra = getExtra();
  const local = extra.apiUrlLocal ?? extra.apiUrl ?? "http://localhost:3001";
  const device = extra.apiUrlDevice ?? local;

  if (Platform.OS === "web") {
    return local;
  }

  if (Platform.OS === "android" && !Device.isDevice) {
    return "http://10.0.2.2:3001";
  }

  if (Device.isDevice) {
    return device;
  }

  return local;
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
  orders: ClientOrderSnapshot[];
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
