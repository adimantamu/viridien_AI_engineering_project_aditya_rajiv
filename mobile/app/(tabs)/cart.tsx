import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CartLineItem } from "@/components/CartLineItem";
import { Header } from "@/components/Header";
import { useCartStore } from "@/src/store/cartStore";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotal);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const total = subtotal();
  const tax = total * 0.08;
  const grandTotal = total + tax;

  return (
    <View className="flex-1 bg-bistro-bg">
      <Header
        title="Your Cart"
        subtitle={lines.length ? `${lines.length} line item${lines.length === 1 ? "" : "s"}` : "Empty"}
        right={
          lines.length > 0 ? (
            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                clearCart();
              }}
            >
              <Text className="text-sm text-bistro-muted">Clear</Text>
            </Pressable>
          ) : undefined
        }
      />

      {lines.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="bag-outline" size={64} color="#3d3528" />
          <Text className="mt-4 text-center text-lg text-bistro-cream">Your cart is empty</Text>
          <Text className="mt-2 text-center text-sm text-bistro-muted">
            Browse the menu or ask the AI maître d' to add items for you.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView className="flex-1 px-4 pt-4">
            {lines.map((line) => (
              <CartLineItem
                key={line.lineId}
                line={line}
                onIncrement={() => updateQuantity(line.lineId, line.quantity + 1)}
                onDecrement={() => updateQuantity(line.lineId, line.quantity - 1)}
                onRemove={() => removeItem(line.lineId, line.quantity)}
              />
            ))}
            <View className="mt-2 rounded-2xl border border-bistro-border bg-bistro-card p-4">
              <View className="flex-row justify-between py-1">
                <Text className="text-bistro-muted">Subtotal</Text>
                <Text className="text-bistro-cream">${total.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between py-1">
                <Text className="text-bistro-muted">Tax (8%)</Text>
                <Text className="text-bistro-cream">${tax.toFixed(2)}</Text>
              </View>
              <View className="mt-2 flex-row justify-between border-t border-bistro-border pt-3">
                <Text className="font-semibold text-bistro-cream">Total</Text>
                <Text className="font-semibold text-lg text-bistro-gold">${grandTotal.toFixed(2)}</Text>
              </View>
            </View>
            <View className="h-28" />
          </ScrollView>

          <View
            className="absolute bottom-0 left-0 right-0 border-t border-bistro-border bg-bistro-bg px-4 pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <Pressable
              onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
            >
              <LinearGradient
                colors={["#c9a962", "#8a7340"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="items-center rounded-2xl py-4"
              >
                <Text className="font-semibold text-base text-bistro-bg">
                  Place order · ${grandTotal.toFixed(2)}
                </Text>
              </LinearGradient>
            </Pressable>
            <Text className="mt-2 text-center text-xs text-bistro-muted">
              Demo checkout — no payment processed
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
