import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Header } from "@/components/Header";
import { MenuItemCard } from "@/components/MenuItemCard";
import { useCartStore } from "@/src/store/cartStore";
import { useMenuStore } from "@/src/store/menuStore";

export default function MenuScreen() {
  const { items, loading, error, loadMenu } = useMenuStore();
  const addItem = useCartStore((s) => s.addItem);
  const [category, setCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const cats = [...new Set(items.map((i) => i.category))];
    return ["All", ...cats];
  }, [items]);

  const filtered = useMemo(() => {
    if (category === "All") return items;
    return items.filter((i) => i.category === category);
  }, [items, category]);

  return (
    <View className="flex-1 bg-bistro-bg">
      <Header title="Menu" subtitle="Seasonal plates & craft drinks" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 border-b border-bistro-border"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            className={`rounded-full px-4 py-1.5 ${
              category === cat ? "bg-bistro-gold" : "border border-bistro-border bg-bistro-surface"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                category === cat ? "text-bistro-bg" : "text-bistro-muted"
              }`}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMenu} tintColor="#c9a962" />}
      >
        {loading && !items.length ? (
          <ActivityIndicator color="#c9a962" className="mt-12" />
        ) : null}
        {error ? (
          <View className="mb-4 rounded-xl border border-bistro-accent/50 bg-bistro-card p-4">
            <Text className="text-bistro-cream">Could not reach the kitchen API.</Text>
            <Text className="mt-1 text-sm text-bistro-muted">{error}</Text>
            <Pressable onPress={loadMenu} className="mt-3">
              <Text className="font-medium text-bistro-gold">Tap to retry</Text>
            </Pressable>
          </View>
        ) : null}
        {filtered.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onAdd={() => {
              addItem(item, 1);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        ))}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
