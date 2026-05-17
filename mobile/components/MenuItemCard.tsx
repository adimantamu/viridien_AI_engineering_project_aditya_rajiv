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
    <View className="mb-3 overflow-hidden rounded-2xl border border-bistro-border bg-bistro-card">
      <View className="flex-row p-4">
        <View className="mr-4 h-16 w-16 items-center justify-center rounded-xl bg-bistro-surface">
          <Ionicons name={getMenuIcon(item.image)} size={28} color="#c9a962" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 pr-2 font-semibold text-base text-bistro-cream">{item.name}</Text>
            <Text className="font-semibold text-bistro-gold">${item.price.toFixed(2)}</Text>
          </View>
          <Text className="mt-1 text-sm leading-5 text-bistro-muted" numberOfLines={2}>
            {item.description}
          </Text>
          {item.tags.length > 0 && (
            <View className="mt-2 flex-row flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag) => (
                <View key={tag} className="rounded-full bg-bistro-surface px-2 py-0.5">
                  <Text className="text-xs capitalize text-bistro-gold-dim">{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      <Pressable
        onPress={() => {
          hapticImpact(Haptics.ImpactFeedbackStyle.Light);
          onAdd();
        }}
        className="border-t border-bistro-border bg-bistro-surface/50 py-3 active:opacity-80"
      >
        <Text className="text-center font-medium text-sm text-bistro-gold">Add to cart</Text>
      </Pressable>
    </View>
  );
}
