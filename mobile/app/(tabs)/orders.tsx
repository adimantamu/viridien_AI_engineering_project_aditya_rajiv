import { Ionicons } from "@expo/vector-icons";
import { hapticNotification, Haptics } from "@/src/lib/haptics";
import { ScrollView, Text, View } from "react-native";
import { Header } from "@/components/Header";
import { OrderCard } from "@/components/OrderCard";
import { useOrdersStore } from "@/src/store/ordersStore";

export default function OrdersScreen() {
  const orders = useOrdersStore((s) => s.orders);
  const cancelOrder = useOrdersStore((s) => s.cancelOrder);
  const activeCount = useOrdersStore((s) => s.activeOrderCount());

  return (
    <View className="flex-1 bg-bistro-bg">
      <Header
        title="Orders"
        subtitle={
          activeCount > 0
            ? `${activeCount} active · ${orders.length} total this session`
            : orders.length
              ? `${orders.length} order${orders.length === 1 ? "" : "s"} this session`
              : "No orders yet"
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24,
          flexGrow: 1,
        }}
      >
        {orders.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 24 }}>
            <Ionicons name="receipt-outline" size={56} color="#3d3528" />
            <Text style={{ marginTop: 16, fontSize: 17, color: "#f5f0e6", textAlign: "center" }}>
              No orders yet
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: "#9a9080", textAlign: "center", lineHeight: 20 }}>
              Add items to your cart, then tap Place order. You can place multiple orders in one session.
            </Text>
          </View>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onCancel={
                order.status === "placed"
                  ? () => {
                      cancelOrder(order.id);
                      hapticNotification(Haptics.NotificationFeedbackType.Warning);
                    }
                  : undefined
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
