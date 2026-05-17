import { Ionicons } from "@expo/vector-icons";
import { hapticImpact, Haptics } from "@/src/lib/haptics";
import { Pressable, Text, View } from "react-native";
import { getMenuIcon } from "@/src/constants/icons";
import type { MenuItem } from "@/src/types";

interface Props {
  item: MenuItem;
  onAdd: () => void;
}

export function MenuItemCard({ item, onAdd }: Props) {
  return (
    <View
      style={{
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#3d3528",
        backgroundColor: "#242019",
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", padding: 16 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: "#1a1814",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name={getMenuIcon(item.image)} size={26} color="#c9a962" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <Text
              style={{
                flex: 1,
                paddingRight: 8,
                fontSize: 16,
                fontWeight: "600",
                color: "#f5f0e6",
              }}
            >
              {item.name}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#c9a962" }}>
              ${item.price.toFixed(2)}
            </Text>
          </View>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              lineHeight: 18,
              color: "#9a9080",
            }}
            numberOfLines={2}
          >
            {item.description}
          </Text>
          {item.tags.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {item.tags.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  style={{
                    borderRadius: 10,
                    backgroundColor: "#1a1814",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "500",
                      color: "#8a7340",
                      textTransform: "capitalize",
                    }}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Pressable
          onPress={() => {
            hapticImpact(Haptics.ImpactFeedbackStyle.Light);
            onAdd();
          }}
          style={({ pressed }) => ({
            height: 44,
            borderRadius: 12,
            backgroundColor: pressed ? "#b89850" : "#c9a962",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          })}
        >
          <Ionicons name="add-circle-outline" size={20} color="#0f0e0c" />
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#0f0e0c",
              includeFontPadding: false,
            }}
          >
            Add to cart
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
