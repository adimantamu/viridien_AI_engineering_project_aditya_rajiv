import { Ionicons } from "@expo/vector-icons";
import { hapticImpact, Haptics } from "@/src/lib/haptics";
import {
  computeUnitPrice,
  defaultModifiersForItem,
  getSizeModifier,
} from "@/src/lib/menuModifiers";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AddToCartButton } from "@/components/AddToCartButton";
import { SizeSelector } from "@/components/SizeSelector";
import { getMenuIcon } from "@/src/constants/icons";
import type { MenuItem } from "@/src/types";

interface Props {
  item: MenuItem;
  onAdd: (modifiers: Record<string, string>) => void;
}

export function MenuItemCard({ item, onAdd }: Props) {
  const sizeMod = getSizeModifier(item);
  const [modifiers, setModifiers] = useState(() => defaultModifiersForItem(item));

  const unitPrice = useMemo(() => computeUnitPrice(item, modifiers), [item, modifiers]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name={getMenuIcon(item.image)} size={26} color="#c9a962" />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>${unitPrice.toFixed(2)}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          {item.tags.length > 0 ? (
            <View style={styles.tags}>
              {item.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {sizeMod ? (
        <View style={styles.sizeBlock}>
          <Text style={styles.sizeLabel}>Size</Text>
          <SizeSelector
            item={item}
            modifier={sizeMod}
            selectedId={modifiers[sizeMod.id] ?? "medium"}
            onSelect={(optionId) =>
              setModifiers((prev) => ({ ...prev, [sizeMod.id]: optionId }))
            }
            compact
          />
        </View>
      ) : null}

      <View style={styles.footer}>
        <AddToCartButton
          onPress={() => {
            hapticImpact(Haptics.ImpactFeedbackStyle.Light);
            onAdd(modifiers);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3d3528",
    backgroundColor: "#242019",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 8,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#1a1814",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  name: {
    flex: 1,
    paddingRight: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#f5f0e6",
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#c9a962",
  },
  description: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "#9a9080",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  tag: {
    borderRadius: 10,
    backgroundColor: "#1a1814",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#8a7340",
    textTransform: "capitalize",
  },
  sizeBlock: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  sizeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9a9080",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
});
