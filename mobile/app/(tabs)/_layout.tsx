import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useCartStore } from "@/src/store/cartStore";

export default function TabLayout() {
  const itemCount = useCartStore((s) => s.itemCount());

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1a1814",
          borderTopColor: "#3d3528",
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#c9a962",
        tabBarInactiveTintColor: "#9a9080",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "AI",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="bag-handle" size={size} color={color} />
              {itemCount > 0 && (
                <View className="absolute -right-2 -top-1 min-w-[16px] items-center justify-center rounded-full bg-bistro-accent px-1">
                  <Text className="text-[10px] font-bold text-white">{itemCount > 9 ? "9+" : itemCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
