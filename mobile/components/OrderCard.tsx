import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import type { Order } from "@/src/types";

interface Props {
  order: Order;
  onCancel?: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderCard({ order, onCancel }: Props) {
  const placed = order.status === "placed";
  const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <View
      style={{
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: placed ? "#3d3528" : "#2a2520",
        backgroundColor: "#242019",
        padding: 16,
        opacity: placed ? 1 : 0.72,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#f5f0e6" }}>
            Order #{order.orderNumber}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 12, color: "#6b6358" }}>{formatTime(order.createdAt)}</Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
            backgroundColor: placed ? "rgba(107, 158, 120, 0.2)" : "rgba(154, 144, 128, 0.15)",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              textTransform: "uppercase",
              color: placed ? "#6b9e78" : "#9a9080",
            }}
          >
            {placed ? "Placed" : "Cancelled"}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12, gap: 8 }}>
        {order.lines.map((line) => (
          <View key={line.lineId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ flex: 1, color: "#f5f0e6", fontSize: 14 }}>
              {line.quantity}× {line.name}
            </Text>
            <Text style={{ color: "#c9a962", fontSize: 14, fontWeight: "600" }}>
              ${(line.unitPrice * line.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "#3d3528",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: "#9a9080", fontSize: 13 }}>
          {itemCount} item{itemCount === 1 ? "" : "s"} · incl. tax
        </Text>
        <Text style={{ color: "#c9a962", fontSize: 18, fontWeight: "700" }}>${order.total.toFixed(2)}</Text>
      </View>

      {placed && onCancel ? (
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => ({
            marginTop: 14,
            height: 40,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#e85d4c55",
            backgroundColor: pressed ? "rgba(232, 93, 76, 0.15)" : "rgba(232, 93, 76, 0.08)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          })}
        >
          <Ionicons name="close-circle-outline" size={18} color="#e85d4c" />
          <Text style={{ color: "#e85d4c", fontWeight: "600", fontSize: 14 }}>Cancel order</Text>
        </Pressable>
      ) : null}

      {!placed && order.cancelledAt ? (
        <Text style={{ marginTop: 10, fontSize: 11, color: "#6b6358" }}>
          Cancelled {formatTime(order.cancelledAt)}
        </Text>
      ) : null}
    </View>
  );
}
