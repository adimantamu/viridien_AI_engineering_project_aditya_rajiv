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
    <LinearGradient
      colors={["#1a1814", "#0f0e0c"]}
      className="border-b border-bistro-border"
    >
      <View style={{ paddingTop: insets.top + 8 }} className="px-5 pb-4">
        <View className="flex-row items-end justify-between">
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-[3px] text-bistro-gold-dim">The Intelligent Bistro</Text>
            <Text className="mt-1 font-serif text-2xl text-bistro-cream">{title}</Text>
            {subtitle ? <Text className="mt-1 text-sm text-bistro-muted">{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      </View>
    </LinearGradient>
  );
}
