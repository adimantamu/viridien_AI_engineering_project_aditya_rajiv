import { Ionicons } from "@expo/vector-icons";
import { hapticImpact, hapticNotification, Haptics } from "@/src/lib/haptics";
import { useVoiceInput } from "@/src/hooks/useVoiceInput";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useOrdersStore } from "@/src/store/ordersStore";
import type { ChatMessage } from "@/src/types";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Bonjour! I'm your maître d'. Tell me or tap the microphone to order — e.g. \"Add two spicy chicken sandwiches and a large water.\" You can also cancel orders by saying \"Cancel order #1001.\"",
  timestamp: Date.now(),
};

const STARTER_SUGGESTIONS = [
  "Add two spicy chicken sandwiches",
  "Show my orders",
  "Cancel my last order",
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
  const getOrderSnapshots = useOrdersStore((s) => s.getOrderSnapshots);
  const applyOrderActions = useOrdersStore((s) => s.applyOrderActions);

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
          orders: getOrderSnapshots(),
        });

        let didUpdate = false;

        if (response.actions.length && menuItems.length) {
          applyActions(response.actions, menuItems);
          didUpdate = true;
        }

        if (response.orderActions?.length) {
          applyOrderActions(response.orderActions);
          didUpdate = true;
        }

        if (didUpdate) {
          hapticNotification(Haptics.NotificationFeedbackType.Success);
        }

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setSuggestions(response.suggestions ?? STARTER_SUGGESTIONS);
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
    [sending, messages, lines, subtotal, applyActions, menuItems, getOrderSnapshots, applyOrderActions],
  );

  const { listening, preparing, available, toggle } = useVoiceInput({
    onTranscriptChange: setInput,
    onFinalTranscript: setInput,
    onError: (msg) => Alert.alert("Voice input", msg),
  });

  const voiceActive = listening || preparing;

  return (
    <View className="flex-1 bg-bistro-bg">
      <Header title="AI Maître d'" subtitle="Type or speak your order" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 pt-4"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {voiceActive ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: preparing ? "#c9a962" : "#e85d4c",
                  marginRight: 8,
                }}
              />
              <Text style={{ color: "#c9a962", fontSize: 13 }}>
                {preparing ? "Starting microphone…" : "Listening… speak now"}
              </Text>
            </View>
          ) : null}
          {sending ? (
            <View className="mb-4 flex-row items-center self-start">
              <ActivityIndicator color="#c9a962" />
              <Text className="ml-2 text-sm text-bistro-muted">Thinking...</Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "#3d3528",
            backgroundColor: "#1a1814",
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: insets.bottom + 8,
          }}
        >
          <SuggestionChips suggestions={suggestions} onSelect={(s) => sendMessage(s)} />

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <Pressable
              onPress={() => {
                hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
                toggle();
              }}
              disabled={!available || sending}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: voiceActive ? "#e85d4c" : pressed ? "#2a2520" : "#242019",
                borderWidth: 1,
                borderColor: voiceActive ? "#e85d4c" : "#3d3528",
                opacity: !available || sending ? 0.45 : 1,
              })}
            >
              <Ionicons
                name={voiceActive ? "stop" : "mic"}
                size={22}
                color={voiceActive ? "#fff" : "#c9a962"}
              />
            </Pressable>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={
                preparing
                  ? "Opening microphone…"
                  : listening
                    ? "Speak now — words appear here…"
                    : "Add two spicy chicken sandwiches…"
              }
              placeholderTextColor="#6b6358"
              multiline
              maxLength={500}
              editable={!sending}
              style={{
                flex: 1,
                maxHeight: 96,
                minHeight: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: voiceActive ? "#c9a962" : "#3d3528",
                backgroundColor: voiceActive ? "#2a2520" : "#242019",
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: "#f5f0e6",
              }}
              onSubmitEditing={() => sendMessage(input)}
            />

            <Pressable
              onPress={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: sending || !input.trim() ? "#3d3528" : "#c9a962",
              }}
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
