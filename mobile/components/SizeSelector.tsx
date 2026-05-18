import { hapticSelection } from "@/src/lib/haptics";
import { computeUnitPrice } from "@/src/lib/menuModifiers";
import type { MenuItem, MenuModifier } from "@/src/types";
import { Pressable, Text, View } from "react-native";

interface Props {
  item: MenuItem;
  modifier: MenuModifier;
  selectedId: string;
  onSelect: (optionId: string) => void;
  compact?: boolean;
}

export function SizeSelector({ item, modifier, selectedId, onSelect, compact }: Props) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: compact ? 6 : 8, marginTop: compact ? 8 : 10 }}>
      {modifier.options.map((option) => {
        const active = selectedId === option.id;
        const mods = { ...defaultMods(item), [modifier.id]: option.id };
        const price = computeUnitPrice(item, mods);
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              hapticSelection();
              onSelect(option.id);
            }}
            style={{
              paddingHorizontal: compact ? 10 : 12,
              paddingVertical: compact ? 6 : 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: active ? "#c9a962" : "#3d3528",
              backgroundColor: active ? "#2a2520" : "#1a1814",
            }}
          >
            <Text
              style={{
                fontSize: compact ? 12 : 13,
                fontWeight: active ? "700" : "500",
                color: active ? "#c9a962" : "#9a9080",
              }}
            >
              {option.label}
            </Text>
            <Text style={{ fontSize: 11, color: active ? "#f5f0e6" : "#6b6358", marginTop: 2 }}>
              ${price.toFixed(2)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function defaultMods(item: MenuItem): Record<string, string> {
  const r: Record<string, string> = {};
  for (const m of item.modifiers ?? []) {
    if (m.id !== "size" && m.options[0]) r[m.id] = m.options[0].id;
  }
  return r;
}
