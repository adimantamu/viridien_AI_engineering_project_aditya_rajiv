import { CategoryFilter } from "@/components/CategoryFilter";
import { hapticNotification, Haptics } from "@/src/lib/haptics";
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
      <CategoryFilter categories={categories} selected={category} onSelect={setCategory} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadMenu} tintColor="#c9a962" />}
      >
        {loading && !items.length ? (
          <ActivityIndicator color="#c9a962" style={{ marginTop: 48 }} />
        ) : null}
        {error ? (
          <View className="mb-4 rounded-2xl border border-bistro-accent/50 bg-bistro-card p-4">
            <Text className="text-bistro-cream">Could not reach the kitchen API.</Text>
            <Text className="mt-1 text-sm text-bistro-muted" selectable>
              {error}
            </Text>
            <Pressable onPress={loadMenu} className="mt-3">
              <Text className="font-medium text-bistro-gold">Tap to retry</Text>
            </Pressable>
          </View>
        ) : null}
        {filtered.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onAdd={(modifiers) => {
              addItem(item, 1, modifiers);
              hapticNotification(Haptics.NotificationFeedbackType.Success);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
