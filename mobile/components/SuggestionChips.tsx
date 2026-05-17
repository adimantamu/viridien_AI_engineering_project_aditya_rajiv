import { hapticSelection } from "@/src/lib/haptics";
import { Pressable, ScrollView, Text } from "react-native";

interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function SuggestionChips({ suggestions, onSelect }: Props) {
  if (!suggestions.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-2"
      contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
    >
      {suggestions.map((s) => (
        <Pressable
          key={s}
          onPress={() => {
            hapticSelection();
            onSelect(s);
          }}
          className="rounded-full border border-bistro-gold/40 bg-bistro-surface px-4 py-2 active:opacity-80"
        >
          <Text className="text-sm text-bistro-gold">{s}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
