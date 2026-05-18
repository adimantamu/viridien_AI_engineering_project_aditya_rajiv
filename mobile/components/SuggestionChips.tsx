import { hapticSelection } from "@/src/lib/haptics";
import { Pressable, ScrollView, Text } from "react-native";
import type { ChatSuggestionChip } from "@/src/types";

interface Props {
  /** Legacy string chips — label and message are the same */
  suggestions?: string[];
  chips?: ChatSuggestionChip[];
  onSelect: (text: string) => void;
  variant?: "composer" | "inline";
}

function normalizeChips(suggestions?: string[], chips?: ChatSuggestionChip[]): ChatSuggestionChip[] {
  if (chips?.length) return chips;
  return (suggestions ?? []).map((s) => ({ label: s, message: s }));
}

export function SuggestionChips({
  suggestions,
  chips,
  onSelect,
  variant = "composer",
}: Props) {
  const items = normalizeChips(suggestions, chips);
  if (!items.length) return null;

  const isInline = variant === "inline";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: isInline ? 0 : 4,
        gap: 8,
        alignItems: "center",
      }}
      style={{ marginBottom: isInline ? 0 : 8 }}
    >
      {items.map((chip) => (
        <Pressable
          key={chip.message}
          onPress={() => {
            hapticSelection();
            onSelect(chip.message);
          }}
          style={({ pressed }) => ({
            height: isInline ? 32 : 34,
            paddingHorizontal: isInline ? 12 : 14,
            borderRadius: isInline ? 16 : 17,
            borderWidth: 1,
            borderColor: pressed ? "#c9a962" : "rgba(201, 169, 98, 0.45)",
            backgroundColor: pressed ? "#2a2520" : isInline ? "#242019" : "#1a1814",
            justifyContent: "center",
            alignItems: "center",
          })}
        >
          <Text
            style={{
              fontSize: isInline ? 12 : 13,
              fontWeight: "500",
              color: "#c9a962",
            }}
          >
            {chip.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
