import { Text, View } from "react-native";
import { RecommendationBlocks } from "@/components/RecommendationBlocks";
import { SuggestionChips } from "@/components/SuggestionChips";
import type { ChatMessage } from "@/src/types";

interface Props {
  message: ChatMessage;
  onSuggestionSelect?: (text: string) => void;
}

/** Split text into segments with optional bold (**…**). */
function renderFormattedText(content: string, baseClass: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <Text key={index} className={`${baseClass} font-semibold text-bistro-gold`}>
          {bold[1]}
        </Text>
      );
    }
    return (
      <Text key={index} className={baseClass}>
        {part}
      </Text>
    );
  });
}

export function ChatBubble({ message, onSuggestionSelect }: Props) {
  const isUser = message.role === "user";
  const hasBlocks = !isUser && (message.recommendationBlocks?.length ?? 0) > 0;
  const hasChips = !isUser && (message.suggestionChips?.length ?? 0) > 0;

  return (
    <View className={`mb-3 max-w-[92%] ${isUser ? "self-end" : "self-start"}`}>
      <View
        className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "rounded-br-md bg-bistro-gold"
            : "rounded-bl-md border border-bistro-border bg-bistro-card"
        }`}
      >
        <Text className={`text-[15px] leading-[22px] ${isUser ? "text-bistro-bg" : "text-bistro-cream"}`}>
          {renderFormattedText(
            message.content.replace(/\n{3,}/g, "\n\n").trim(),
            isUser ? "text-bistro-bg" : "text-bistro-cream",
          )}
        </Text>

        {hasBlocks && onSuggestionSelect ? (
          <RecommendationBlocks
            blocks={message.recommendationBlocks!}
            onAddPick={onSuggestionSelect}
          />
        ) : null}
      </View>

      {hasChips && onSuggestionSelect ? (
        <View style={{ marginTop: 8, marginLeft: 2 }}>
          <SuggestionChips
            chips={message.suggestionChips!}
            onSelect={onSuggestionSelect}
            variant="inline"
          />
        </View>
      ) : null}
    </View>
  );
}
