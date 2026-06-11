import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type {
  CartLine,
  ChatMessage,
  ChatResponse,
  ChatSessionContext,
  ClientOrderSnapshot,
  MenuItem,
} from "../types";

type ApiExtra = {
  apiUrl?: string;
  apiUrlLocal?: string;
  apiUrlDevice?: string;
};

function getExtra(): ApiExtra {
  return (Constants.expoConfig?.extra ?? {}) as ApiExtra;
}

/**
 * On Expo Go, Metro and the API should share the same LAN host (e.g. 192.168.x.x).
 * Derive it from the dev server so apiUrlDevice does not go stale when Wi‑Fi changes.
 */
function getExpoDevServerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.replace(/^exp:\/\//, "").split(":")[0]?.trim();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }

  const expoGoConfig = (
    Constants as typeof Constants & { expoGoConfig?: { debuggerHost?: string } }
  ).expoGoConfig;
  const debuggerHost = expoGoConfig?.debuggerHost;
  if (debuggerHost) {
    const host = debuggerHost.split(":")[0]?.trim();
    if (host) return host;
  }

  const legacyManifest = (
    Constants as typeof Constants & { manifest?: { debuggerHost?: string } }
  ).manifest;
  const legacyHost = legacyManifest?.debuggerHost?.split(":")[0]?.trim();
  if (legacyHost) return legacyHost;

  return null;
}

export function getApiBaseUrl(): string {
  const extra = getExtra();
  const local = extra.apiUrlLocal ?? extra.apiUrl ?? "http://localhost:3001";
  const configuredDevice = extra.apiUrlDevice ?? local;

  if (Platform.OS === "web") {
    return local;
  }

  if (Platform.OS === "android" && !Device.isDevice) {
    return "http://10.0.2.2:3001";
  }

  if (Device.isDevice) {
    const expoHost = getExpoDevServerHost();
    if (expoHost) {
      return `http://${expoHost}:3001`;
    }
    return configuredDevice;
  }

  return local;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
  session?: ChatSessionContext;
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
  return getApiBaseUrl();
}
