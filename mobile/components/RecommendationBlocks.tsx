import { hapticSelection } from "@/src/lib/haptics";
import { Pressable, Text, View } from "react-native";
import type { ChatRecommendationBlock } from "@/src/types";

interface Props {
  blocks: ChatRecommendationBlock[];
  onAddPick: (message: string) => void;
}

export function RecommendationBlocks({ blocks, onAddPick }: Props) {
  if (!blocks.length) return null;

  return (
    <View style={{ marginTop: 12, gap: 14 }}>
      {blocks.map((block, blockIndex) => (
        <View key={`${block.title}-${blockIndex}`}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>{block.titleEmoji}</Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#c9a962",
                letterSpacing: 0.3,
              }}
            >
              {block.title}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            {block.picks.map((pick) => (
              <Pressable
                key={pick.itemId}
                onPress={() => {
                  hapticSelection();
                  onAddPick(pick.addMessage);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: pressed ? "#c9a962" : "rgba(201, 169, 98, 0.28)",
                  backgroundColor: pressed ? "#2a2520" : "#1f1c18",
                })}
              >
                <Text style={{ fontSize: 22, marginRight: 10 }}>{pick.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#f5f0e6" }}>
                      {pick.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#c9a962", marginLeft: 6 }}>
                      ${pick.price.toFixed(2)}
                    </Text>
                  </View>
                  <Text
                    style={{ fontSize: 12, color: "#9a9080", marginTop: 3, lineHeight: 16 }}
                    numberOfLines={2}
                  >
                    {pick.note}
                  </Text>
                </View>
                <View
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: "rgba(201, 169, 98, 0.15)",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#c9a962" }}>Add</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
