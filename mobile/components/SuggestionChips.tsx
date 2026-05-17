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
      contentContainerStyle={{ paddingHorizontal: 4, gap: 8, alignItems: "center" }}
      style={{ marginBottom: 8 }}
    >
      {suggestions.map((s) => (
        <Pressable
          key={s}
          onPress={() => {
            hapticSelection();
            onSelect(s);
          }}
          style={{
            height: 34,
            paddingHorizontal: 14,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: "rgba(201, 169, 98, 0.45)",
            backgroundColor: "#1a1814",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "500", color: "#c9a962" }}>{s}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
