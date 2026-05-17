import { Ionicons } from "@expo/vector-icons";
import { hapticNotification, Haptics } from "@/src/lib/haptics";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CartLineItem } from "@/components/CartLineItem";
import { Header } from "@/components/Header";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useCartStore } from "@/src/store/cartStore";
import { useOrdersStore } from "@/src/store/ordersStore";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotal);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const placeOrderFromCart = useOrdersStore((s) => s.placeOrderFromCart);

  const total = subtotal();
  const tax = total * 0.08;
  const grandTotal = total + tax;

  const handlePlaceOrder = () => {
    const order = placeOrderFromCart();
    if (!order) {
      Alert.alert("Cart is empty", "Add items from the menu before placing an order.");
      return;
    }
    hapticNotification(Haptics.NotificationFeedbackType.Success);
    router.push("/(tabs)/orders");
  };

  return (
    <View className="flex-1 bg-bistro-bg">
      <Header
        title="Your Cart"
        subtitle={lines.length ? `${lines.length} line item${lines.length === 1 ? "" : "s"}` : "Empty"}
        right={
          lines.length > 0 ? (
            <Pressable
              onPress={() => {
                hapticNotification(Haptics.NotificationFeedbackType.Warning);
                clearCart();
              }}
              hitSlop={8}
            >
              <Text style={{ fontSize: 14, color: "#9a9080", fontWeight: "500" }}>Clear</Text>
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
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 16,
            }}
            showsVerticalScrollIndicator={false}
          >
            {lines.map((line) => (
              <CartLineItem
                key={line.lineId}
                line={line}
                onIncrement={() => updateQuantity(line.lineId, line.quantity + 1)}
                onDecrement={() => updateQuantity(line.lineId, line.quantity - 1)}
                onRemove={() => removeItem(line.lineId, line.quantity)}
              />
            ))}

            <View
              style={{
                marginTop: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#3d3528",
                backgroundColor: "#242019",
                padding: 16,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ color: "#9a9080", fontSize: 15 }}>Subtotal</Text>
                <Text style={{ color: "#f5f0e6", fontSize: 15 }}>${total.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <Text style={{ color: "#9a9080", fontSize: 15 }}>Tax (8%)</Text>
                <Text style={{ color: "#f5f0e6", fontSize: 15 }}>${tax.toFixed(2)}</Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 8,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "#3d3528",
                }}
              >
                <Text style={{ color: "#f5f0e6", fontSize: 16, fontWeight: "600" }}>Total</Text>
                <Text style={{ color: "#c9a962", fontSize: 20, fontWeight: "700" }}>
                  ${grandTotal.toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 12) + 4,
              borderTopWidth: 1,
              borderTopColor: "#3d3528",
              backgroundColor: "#0f0e0c",
            }}
          >
            <PrimaryButton
              label={`Place order  ·  $${grandTotal.toFixed(2)}`}
              onPress={handlePlaceOrder}
            />
            <Text
              style={{
                marginTop: 10,
                textAlign: "center",
                fontSize: 11,
                color: "#6b6358",
              }}
            >
              Demo checkout — order appears in Orders tab
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
