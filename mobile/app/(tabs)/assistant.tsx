import { Ionicons } from "@expo/vector-icons";

import { hapticImpact, hapticNotification, Haptics } from "@/src/lib/haptics";

import { useVoiceInput } from "@/src/hooks/useVoiceInput";

import { useCallback, useEffect, useRef, useState } from "react";

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

import type { ChatMessage, ChatSessionContext } from "@/src/types";



const STARTER_CHIPS = [
  { label: "🥗 What are your starters?", message: "What are your starters?" },
  { label: "🌶️ Spicy chicken sandwich", message: "Add spicy chicken sandwich" },
  { label: "📋 Show my orders", message: "Show my orders" },
];



export default function AssistantScreen() {

  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [greetingLoaded, setGreetingLoaded] = useState(false);

  const [input, setInput] = useState("");

  const [composerChips, setComposerChips] = useState(STARTER_CHIPS);

  const [sending, setSending] = useState(false);

  const [session, setSession] = useState<ChatSessionContext>({ awaitingConfirmation: null });



  const lines = useCartStore((s) => s.lines);

  const subtotal = useCartStore((s) => s.subtotal);

  const applyActions = useCartStore((s) => s.applyActions);

  const menuItems = useMenuStore((s) => s.items);

  const getOrderSnapshots = useOrdersStore((s) => s.getOrderSnapshots);

  const applyOrderActions = useOrdersStore((s) => s.applyOrderActions);

  const placeOrderFromCart = useOrdersStore((s) => s.placeOrderFromCart);



  useEffect(() => {

    let cancelled = false;



    (async () => {

      try {

        const response = await sendChatMessage({

          message: "hello",

          history: [],

          cart: { lines: [], subtotal: 0 },

          orders: getOrderSnapshots(),

        });



        if (cancelled) return;



        setMessages([

          {

            id: "welcome",

            role: "assistant",

            content: response.reply,

            timestamp: Date.now(),

          },

        ]);

        setComposerChips(
          response.suggestionChips ??
            (response.suggestions ?? STARTER_CHIPS.map((c) => c.message)).map((s) => ({
              label: s,
              message: s,
            })),
        );

        if (response.sessionContext) {

          setSession(response.sessionContext);

        }

      } catch {

        if (!cancelled) {

          setMessages([

            {

              id: "welcome",

              role: "assistant",

              content:

                "Hello! Welcome to The Intelligent Bistro. How are you today? Tell me what you'd like — or ask \"What are your starters?\" to browse the menu.",

              timestamp: Date.now(),

            },

          ]);

        }

      } finally {

        if (!cancelled) setGreetingLoaded(true);

      }

    })();



    return () => {

      cancelled = true;

    };

  }, [getOrderSnapshots]);



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

      setComposerChips([]);



      try {

        const response = await sendChatMessage({

          message: trimmed,

          history: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),

          cart: { lines, subtotal: subtotal() },

          orders: getOrderSnapshots(),

          session,

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



        if (response.placeOrderFromCart) {

          const order = placeOrderFromCart();

          if (order) didUpdate = true;

        }



        if (response.sessionContext) {

          setSession(response.sessionContext);

        }



        if (didUpdate) {

          hapticNotification(Haptics.NotificationFeedbackType.Success);

        }



        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
          suggestionChips: response.suggestionChips,
          recommendationBlocks: response.recommendationBlocks,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        const nextChips =
          response.suggestionChips ??
          (response.suggestions ?? STARTER_CHIPS.map((c) => c.message)).map((s) => ({
            label: s,
            message: s,
          }));
        setComposerChips(nextChips.length ? nextChips : STARTER_CHIPS);

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

        setComposerChips(STARTER_CHIPS);

      } finally {

        setSending(false);

        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

      }

    },

    [

      sending,

      messages,

      lines,

      subtotal,

      applyActions,

      menuItems,

      getOrderSnapshots,

      applyOrderActions,

      placeOrderFromCart,

      session,

    ],

  );



  const { listening, preparing, available, toggle } = useVoiceInput({
    onTranscriptChange: setInput,
    onFinalTranscript: setInput,
    onError: (msg) => Alert.alert("Voice input", msg),
  });

  const voiceActive = listening || preparing;
  const isRecordingHint = listening && partial.startsWith("Recording");



  return (

    <View className="flex-1 bg-bistro-bg">

      <Header

        title="AI Maître d'"

        subtitle={available ? "Type or speak your order" : "Type your order below"}

      />



      <KeyboardAvoidingView

        className="flex-1"

        behavior={Platform.OS === "ios" ? "padding" : undefined}

      >

        <ScrollView

          ref={scrollRef}

          className="flex-1 px-4 pt-4"

          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}

        >

          {!greetingLoaded ? (

            <View className="mb-4 flex-row items-center self-start">

              <ActivityIndicator color="#c9a962" />

              <Text className="ml-2 text-sm text-bistro-muted">Welcome...</Text>

            </View>

          ) : null}

          {messages.map((m) => (

            <ChatBubble
              key={m.id}
              message={m}
              onSuggestionSelect={m.role === "assistant" ? (text) => sendMessage(text) : undefined}
            />

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
                {preparing && !listening
                  ? "Transcribing…"
                  : isRecordingHint
                    ? "Recording… tap stop when done"
                    : preparing
                      ? "Starting microphone…"
                      : "Listening… speak now"}
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

          <SuggestionChips chips={composerChips} onSelect={(s) => sendMessage(s)} />



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

                preparing && !listening

                  ? "Transcribing your speech…"

                  : preparing

                    ? "Opening microphone…"

                    : listening

                      ? partial || "Recording… tap stop when finished"

                      : "Add two spicy chicken sandwiches…"

              }

              placeholderTextColor="#6b6358"

              multiline

              maxLength={500}

              editable={!sending && greetingLoaded}

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

              disabled={sending || !input.trim() || !greetingLoaded}

              style={{

                width: 48,

                height: 48,

                borderRadius: 24,

                alignItems: "center",

                justifyContent: "center",

                backgroundColor:

                  sending || !input.trim() || !greetingLoaded ? "#3d3528" : "#c9a962",

              }}

            >

              <Ionicons

                name="send"

                size={20}

                color={sending || !input.trim() || !greetingLoaded ? "#9a9080" : "#0f0e0c"}

              />

            </Pressable>

          </View>

        </View>

      </KeyboardAvoidingView>

    </View>

  );

}

