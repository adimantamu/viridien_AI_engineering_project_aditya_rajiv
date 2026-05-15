import { Text, View } from "react-native";
import type { ChatMessage } from "@/src/types";

interface Props {
  message: ChatMessage;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <View className={`mb-3 max-w-[88%] ${isUser ? "self-end" : "self-start"}`}>
      <View
        className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-br-md bg-bistro-gold"
            : "rounded-bl-md border border-bistro-border bg-bistro-card"
        }`}
      >
        <Text className={`text-[15px] leading-[22px] ${isUser ? "text-bistro-bg" : "text-bistro-cream"}`}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}
