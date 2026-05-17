import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function Header({ title, subtitle, right }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={["#1a1814", "#0f0e0c"]} style={{ borderBottomWidth: 1, borderBottomColor: "#3d3528" }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                letterSpacing: 3,
                color: "#8a7340",
                textTransform: "uppercase",
              }}
            >
              The Intelligent Bistro
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 28,
                fontWeight: "400",
                color: "#f5f0e6",
                fontFamily: "Georgia",
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ marginTop: 4, fontSize: 14, color: "#9a9080", lineHeight: 20 }}>{subtitle}</Text>
            ) : null}
          </View>
          {right}
        </View>
      </View>
    </LinearGradient>
  );
}
