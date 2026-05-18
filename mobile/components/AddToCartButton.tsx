import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  onPress: () => void;
}

/** Full-width gold CTA — same look on iOS, Android, and web (no NativeWind). */
export function AddToCartButton({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add to cart"
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={["#d4b96e", "#c9a962", "#b89850"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="add" size={20} color="#0f0e0c" />
        </View>
        <Text style={styles.label}>Add to cart</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 4,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  gradient: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 14, 12, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f0e0c",
    letterSpacing: 0.2,
  },
});
