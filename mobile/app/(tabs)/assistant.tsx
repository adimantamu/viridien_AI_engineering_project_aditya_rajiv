import { Ionicons } from "@expo/vector-icons";

import { hapticImpact, hapticNotification, Haptics } from "@/src/lib/haptics";

import { useOrderSpeech } from "@/src/hooks/useOrderSpeech";
import { useVoiceInput } from "@/src/hooks/useVoiceInput";
import { getOrderSpeechStatusLine } from "@/src/lib/orderSpeechUi";
import { buildAssistantSpeechText, sanitizeChatForSpeech } from "@/src/lib/speechText";
import { getVoicePlaceholder, getVoiceStatusLine, showVoiceError } from "@/src/lib/voiceUi";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  AppState,
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

import { getApiUrl, sendChatMessage } from "@/src/lib/api";
import { fetchApiHealth } from "@/src/lib/transcribeAudio";

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

  const [voiceWhisperReady, setVoiceWhisperReady] = useState<boolean | null>(null);

  const stopVoiceRef = useRef<() => void>(() => {});

  const lines = useCartStore((s) => s.lines);

  const subtotal = useCartStore((s) => s.subtotal);

  const applyActions = useCartStore((s) => s.applyActions);

  const menuItems = useMenuStore((s) => s.items);

  const getOrderSnapshots = useOrdersStore((s) => s.getOrderSnapshots);

  const applyOrderActions = useOrdersStore((s) => s.applyOrderActions);

  const placeOrderFromCart = useOrdersStore((s) => s.placeOrderFromCart);

  const {
    isPlaying,
    isPaused,
    hasPlayback,
    available: speechAvailable,
    speak,
    pause: pauseSpeech,
    resume: resumeSpeech,
    stop: stopSpeech,
  } = useOrderSpeech({
    onBeforeSpeak: () => stopVoiceRef.current(),
  });

  const { listening, preparing, partial, available, stop: stopVoice, toggle } = useVoiceInput({
    onTranscriptChange: setInput,
    onFinalTranscript: setInput,
    onError: showVoiceError,
  });

  useEffect(() => {
    stopVoiceRef.current = stopVoice;
  }, [stopVoice]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [stopSpeech]);

  useEffect(() => {
    let cancelled = false;

    const refreshVoiceHealth = async () => {
      const health = await fetchApiHealth();
      if (!cancelled) {
        setVoiceWhisperReady(health.ok && health.voice === "whisper");
      }
    };

    void refreshVoiceHealth();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshVoiceHealth();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

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

      stopSpeech();

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

        const cartState = useCartStore.getState();
        const speechText = buildAssistantSpeechText(
          response,
          cartState.lines,
          cartState.subtotal(),
        );
        if (speechText && speechAvailable) {
          speak(speechText, assistantMsg.id);
        }

        const nextChips =
          response.suggestionChips ??
          (response.suggestions ?? STARTER_CHIPS.map((c) => c.message)).map((s) => ({
            label: s,
            message: s,
          }));
        setComposerChips(nextChips.length ? nextChips : STARTER_CHIPS);

      } catch {
        const errId = `err-${Date.now()}`;
        const errContent =
          "I couldn't reach the server. Make sure the backend is running on port 3001, then try again.";

        setMessages((prev) => [
          ...prev,
          {
            id: errId,
            role: "assistant",
            content: errContent,
            timestamp: Date.now(),
          },
        ]);

        const errSpeech = sanitizeChatForSpeech(errContent);
        if (errSpeech && speechAvailable) speak(errSpeech, errId);

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

      speak,

      stopSpeech,

      speechAvailable,

    ],

  );

  const isWeb = Platform.OS === "web";

  const voiceActive = listening || preparing;
  const voiceStatus = getVoiceStatusLine({
    isWeb,
    listening,
    preparing,
    partial: partial ?? "",
  });
  const voicePlaceholder = getVoicePlaceholder({
    isWeb,
    listening,
    preparing,
    partial: partial ?? "",
  });

  const speechStatus = getOrderSpeechStatusLine(isPlaying, isPaused);

  return (

    <View className="flex-1 bg-bistro-bg">

      <Header
        title="AI Maître d'"
        subtitle={
          Platform.OS === "web"
            ? available
              ? "Type or speak your order"
              : "Type your order below"
            : voiceWhisperReady === false
              ? "Type your order — voice needs OPENAI_API_KEY on server"
              : available
                ? "Type or speak your order"
                : `Type your order — check API at ${getApiUrl()}`
        }
      />



      <KeyboardAvoidingView

        className="flex-1"

        behavior={Platform.OS === "ios" ? "padding" : undefined}

      >

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >

          {!greetingLoaded ? (

            <View
              style={{
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                flexGrow: 0,
              }}
            >
              <ActivityIndicator color="#c9a962" />
              <Text style={{ marginLeft: 8, fontSize: 14, color: "#9a9080" }}>Welcome...</Text>
            </View>

          ) : null}

          {messages.map((m) => (
            <View key={m.id} style={{ flexGrow: 0, flexShrink: 0, width: "100%" }}>
              <ChatBubble
                message={m}
                onSuggestionSelect={
                  m.role === "assistant" ? (text) => sendMessage(text) : undefined
                }
              />
            </View>
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
              <Text style={{ color: "#c9a962", fontSize: 13 }}>{voiceStatus}</Text>
            </View>
          ) : null}

          {sending ? (

            <View
              style={{
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                flexGrow: 0,
              }}
            >
              <ActivityIndicator color="#c9a962" />
              <Text style={{ marginLeft: 8, fontSize: 14, color: "#9a9080" }}>Thinking...</Text>
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

          {speechAvailable && hasPlayback && !voiceActive ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#3d3528",
                backgroundColor: "#242019",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: isPaused ? "#9a9080" : "#c9a962",
                }}
              />
              <Text style={{ flex: 1, color: "#c9a962", fontSize: 13 }}>{speechStatus}</Text>
              {isPlaying ? (
                <Pressable
                  onPress={() => {
                    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
                    pauseSpeech();
                  }}
                  accessibilityLabel="Pause read aloud"
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? "#3d3528" : "#2a2520",
                    borderWidth: 1,
                    borderColor: "#c9a962",
                  })}
                >
                  <Ionicons name="pause" size={18} color="#c9a962" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
                    resumeSpeech();
                  }}
                  accessibilityLabel="Resume read aloud"
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? "#3d3528" : "#2a2520",
                    borderWidth: 1,
                    borderColor: "#c9a962",
                  })}
                >
                  <Ionicons name="play" size={18} color="#c9a962" />
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  hapticImpact(Haptics.ImpactFeedbackStyle.Light);
                  stopSpeech();
                }}
                accessibilityLabel="Stop read aloud"
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? "#3d3528" : "#2a2520",
                  borderWidth: 1,
                  borderColor: "#6b6358",
                })}
              >
                <Ionicons name="close" size={18} color="#9a9080" />
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <Pressable
              onPress={() => {
                hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
                stopSpeech();
                toggle();
              }}
              disabled={sending || (Platform.OS === "web" && !available)}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: voiceActive ? "#e85d4c" : pressed ? "#2a2520" : "#242019",
                borderWidth: 1,
                borderColor: voiceActive ? "#e85d4c" : "#3d3528",
                opacity: sending || (Platform.OS === "web" && !available) ? 0.45 : 1,
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

              placeholder={voicePlaceholder}

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

