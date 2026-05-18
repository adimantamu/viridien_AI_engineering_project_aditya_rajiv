import { Text, View } from "react-native";
import { RecommendationBlocks } from "@/components/RecommendationBlocks";
import { SuggestionChips } from "@/components/SuggestionChips";
import type { ChatMessage } from "@/src/types";

interface Props {
  message: ChatMessage;
  onSuggestionSelect?: (text: string) => void;
}

/** Split text into segments with optional bold (**…**). */
function renderFormattedText(content: string, color: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <Text key={index} style={{ color: "#c9a962", fontWeight: "600" }}>
          {bold[1]}
        </Text>
      );
    }
    return (
      <Text key={index} style={{ color }}>
        {part}
      </Text>
    );
  });
}

export function ChatBubble({ message, onSuggestionSelect }: Props) {
  const isUser = message.role === "user";
  const hasBlocks = !isUser && (message.recommendationBlocks?.length ?? 0) > 0;
  const hasChips = !isUser && (message.suggestionChips?.length ?? 0) > 0;
  const textColor = isUser ? "#0f0e0c" : "#f5f0e6";

  return (
    <View
      style={{
        marginBottom: 12,
        width: "100%",
        maxWidth: "100%",
        alignSelf: isUser ? "flex-end" : "flex-start",
        flexGrow: 0,
        flexShrink: 0,
      }}
    >
      <View
        style={{
          maxWidth: isUser ? "88%" : "100%",
          alignSelf: isUser ? "flex-end" : "flex-start",
          flexGrow: 0,
        }}
      >
        <View
          style={{
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexGrow: 0,
            ...(isUser
              ? {
                  borderBottomRightRadius: 6,
                  backgroundColor: "#c9a962",
                }
              : {
                  borderBottomLeftRadius: 6,
                  borderWidth: 1,
                  borderColor: "#3d3528",
                  backgroundColor: "#242019",
                }),
          }}
        >
          <Text style={{ fontSize: 15, lineHeight: 22, color: textColor }}>
            {renderFormattedText(message.content.replace(/\n{3,}/g, "\n\n").trim(), textColor)}
          </Text>
        </View>

        {hasBlocks && onSuggestionSelect ? (
          <View
            style={{
              marginTop: 8,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: "#3d3528",
              backgroundColor: "#1f1c18",
              flexGrow: 0,
              maxWidth: "100%",
            }}
          >
            <RecommendationBlocks
              blocks={message.recommendationBlocks!}
              onAddPick={onSuggestionSelect}
            />
          </View>
        ) : null}
      </View>

      {hasChips && onSuggestionSelect ? (
        <View style={{ marginTop: 8, marginLeft: 2, flexGrow: 0 }}>
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
