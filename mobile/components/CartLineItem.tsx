import { Ionicons } from "@expo/vector-icons";
import { hapticImpact, hapticSelection, Haptics } from "@/src/lib/haptics";
import { Pressable, Text, View } from "react-native";
import type { CartLine } from "@/src/types";

interface Props {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartLineItem({ line, onIncrement, onDecrement, onRemove }: Props) {
  const modLabels = Object.entries(line.modifiers)
    .filter(([, v]) => v && v !== "none")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  return (
    <View
      style={{
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#3d3528",
        backgroundColor: "#242019",
        padding: 16,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#f5f0e6" }}>{line.name}</Text>
          {modLabels ? (
            <Text style={{ marginTop: 2, fontSize: 12, color: "#9a9080" }}>{modLabels}</Text>
          ) : null}
          <Text style={{ marginTop: 4, fontSize: 15, fontWeight: "600", color: "#c9a962" }}>
            ${(line.unitPrice * line.quantity).toFixed(2)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
            onRemove();
          }}
          hitSlop={12}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: "#1a1814",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="trash-outline" size={18} color="#9a9080" />
        </Pressable>
      </View>

      <View
        style={{
          marginTop: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#3d3528",
            backgroundColor: "#1a1814",
            height: 40,
          }}
        >
          <Pressable
            onPress={() => {
              hapticSelection();
              onDecrement();
            }}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="remove" size={18} color="#c9a962" />
          </Pressable>
          <Text
            style={{
              minWidth: 28,
              textAlign: "center",
              fontSize: 16,
              fontWeight: "700",
              color: "#f5f0e6",
            }}
          >
            {line.quantity}
          </Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              onIncrement();
            }}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={18} color="#c9a962" />
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: "#6b6358" }}>${line.unitPrice.toFixed(2)} each</Text>
      </View>
    </View>
  );
}
