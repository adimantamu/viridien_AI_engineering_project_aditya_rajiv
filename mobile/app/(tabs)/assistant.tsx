import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatBubble } from "@/components/ChatBubble";
import { Header } from "@/components/Header";
import { SuggestionChips } from "@/components/SuggestionChips";
import { sendChatMessage } from "@/src/lib/api";
import { useCartStore } from "@/src/store/cartStore";
import { useMenuStore } from "@/src/store/menuStore";
import type { ChatMessage } from "@/src/types";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Bonjour! I'm your maître d'. Tell me what you'd like — for example: \"Add two spicy chicken sandwiches and a large water.\"",
  timestamp: Date.now(),
};

const STARTER_SUGGESTIONS = [
  "Add two spicy chicken sandwiches",
  "Add truffle fries and a large water",
  "What's on the menu?",
];

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(STARTER_SUGGESTIONS);
  const [sending, setSending] = useState(false);

  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotal);
  const applyActions = useCartStore((s) => s.applyActions);
  const menuItems = useMenuStore((s) => s.items);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);
      setSuggestions([]);

      try {
        const response = await sendChatMessage({
          message: trimmed,
          history: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          cart: { lines, subtotal: subtotal() },
        });

        if (response.actions.length && menuItems.length) {
          applyActions(response.actions, menuItems);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setSuggestions(response.suggestions ?? []);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content:
              "I couldn't reach the server. Make sure the backend is running on port 3001, then try again.",
            timestamp: Date.now(),
          },
        ]);
        setSuggestions(STARTER_SUGGESTIONS);
      } finally {
        setSending(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [sending, messages, lines, subtotal, applyActions, menuItems],
  );

  return (
    <View className="flex-1 bg-bistro-bg">
      <Header
        title="AI Maître d'"
        subtitle="Natural language ordering"
        right={
          <View className="rounded-full border border-bistro-gold/30 bg-bistro-surface px-3 py-1">
            <Text className="text-xs text-bistro-gold">Powered by API</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 pt-4"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {sending ? (
            <View className="mb-4 flex-row items-center self-start">
              <ActivityIndicator color="#c9a962" />
              <Text className="ml-2 text-sm text-bistro-muted">Thinking...</Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="border-t border-bistro-border bg-bistro-surface px-4 pt-2" style={{ paddingBottom: insets.bottom + 8 }}>
          <SuggestionChips suggestions={suggestions} onSelect={(s) => sendMessage(s)} />
          <View className="flex-row items-end gap-2">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Add two spicy chicken sandwiches..."
              placeholderTextColor="#6b6358"
              multiline
              maxLength={500}
              className="max-h-24 flex-1 rounded-2xl border border-bistro-border bg-bistro-card px-4 py-3 text-base text-bistro-cream"
              onSubmitEditing={() => sendMessage(input)}
              editable={!sending}
            />
            <Pressable
              onPress={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              className={`h-12 w-12 items-center justify-center rounded-full ${
                sending || !input.trim() ? "bg-bistro-border" : "bg-bistro-gold"
              }`}
            >
              <Ionicons
                name="send"
                size={20}
                color={sending || !input.trim() ? "#9a9080" : "#0f0e0c"}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
