import { hapticSelection } from "@/src/lib/haptics";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ChatRecommendationBlock, ChatRecommendationPick } from "@/src/types";

const PICKS_SCROLL_MAX_HEIGHT = 240;

function PickRow({
  pick,
  onAddPick,
}: {
  pick: ChatRecommendationPick;
  onAddPick: (message: string) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onAddPick(pick.addMessage);
      }}
      accessibilityRole="button"
      style={({ pressed }) => ({
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: pressed ? "#c9a962" : "rgba(201, 169, 98, 0.28)",
        backgroundColor: pressed ? "#2a2520" : "#1f1c18",
        overflow: "hidden",
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <Text style={{ fontSize: 22, marginRight: 10, lineHeight: 26 }}>{pick.emoji}</Text>
        <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#f5f0e6" }}>{pick.name}</Text>
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
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: "rgba(201, 169, 98, 0.15)",
            alignSelf: "center",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#c9a962" }}>Add</Text>
        </View>
      </View>
    </Pressable>
  );
}

function PicksList({
  picks,
  onAddPick,
}: {
  picks: ChatRecommendationPick[];
  onAddPick: (message: string) => void;
}) {
  const rows = picks.map((pick) => (
    <PickRow key={pick.itemId} pick={pick} onAddPick={onAddPick} />
  ));

  return (
    <ScrollView
      style={{ maxHeight: PICKS_SCROLL_MAX_HEIGHT, flexGrow: 0, flexShrink: 1 }}
      contentContainerStyle={{ flexGrow: 0 }}
      nestedScrollEnabled
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
    >
      {rows}
    </ScrollView>
  );
}

interface Props {
  blocks: ChatRecommendationBlock[];
  onAddPick: (message: string) => void;
}

export function RecommendationBlocks({ blocks, onAddPick }: Props) {
  if (!blocks.length) return null;

  return (
    <View style={{ marginTop: 10, flexGrow: 0, flexShrink: 1, width: "100%" }}>
      {blocks.map((block, blockIndex) => (
        <View
          key={`${block.title}-${blockIndex}`}
          style={{ marginBottom: blockIndex < blocks.length - 1 ? 12 : 0, flexGrow: 0 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>{block.titleEmoji}</Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#c9a962",
                letterSpacing: 0.3,
                flexShrink: 1,
              }}
            >
              {block.title}
            </Text>
          </View>
          <PicksList picks={block.picks} onAddPick={onAddPick} />
        </View>
      ))}
    </View>
  );
}
