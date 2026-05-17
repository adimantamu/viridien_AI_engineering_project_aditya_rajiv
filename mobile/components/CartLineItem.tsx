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
    <View className="mb-3 rounded-2xl border border-bistro-border bg-bistro-card p-4">
      <View className="flex-row justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-semibold text-base text-bistro-cream">{line.name}</Text>
          {modLabels ? (
            <Text className="mt-0.5 text-xs text-bistro-muted">{modLabels}</Text>
          ) : null}
          <Text className="mt-1 text-sm text-bistro-gold">
            ${(line.unitPrice * line.quantity).toFixed(2)}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
            onRemove();
          }}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={20} color="#9a9080" />
        </Pressable>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center rounded-xl border border-bistro-border bg-bistro-surface">
          <Pressable
            onPress={() => {
              hapticSelection();
              onDecrement();
            }}
            className="px-3 py-2"
          >
            <Ionicons name="remove" size={18} color="#c9a962" />
          </Pressable>
          <Text className="min-w-[28px] text-center font-semibold text-bistro-cream">{line.quantity}</Text>
          <Pressable
            onPress={() => {
              hapticSelection();
              onIncrement();
            }}
            className="px-3 py-2"
          >
            <Ionicons name="add" size={18} color="#c9a962" />
          </Pressable>
        </View>
        <Text className="text-xs text-bistro-muted">${line.unitPrice.toFixed(2)} each</Text>
      </View>
    </View>
  );
}
