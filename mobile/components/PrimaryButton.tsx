import { LinearGradient } from "expo-linear-gradient";
import { Pressable, Text, ViewStyle } from "react-native";

interface Props {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: "100%",
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <LinearGradient
        colors={["#d4b96e", "#b89850", "#8f7340"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: "#0f0e0c",
            letterSpacing: 0.2,
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
