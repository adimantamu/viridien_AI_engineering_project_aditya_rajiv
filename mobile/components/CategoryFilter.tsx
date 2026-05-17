import { Pressable, ScrollView, Text, View } from "react-native";

interface Props {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: Props) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: "#3d3528",
        backgroundColor: "#0f0e0c",
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          alignItems: "center",
          gap: 8,
        }}
      >
        {categories.map((cat) => {
          const active = selected === cat;
          return (
            <Pressable
              key={cat}
              onPress={() => onSelect(cat)}
              style={{
                height: 36,
                paddingHorizontal: 16,
                borderRadius: 18,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: active ? "#c9a962" : "#1a1814",
                borderWidth: active ? 0 : 1,
                borderColor: "#3d3528",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: active ? "#0f0e0c" : "#c9a962",
                  lineHeight: 18,
                  includeFontPadding: false,
                  textAlignVertical: "center",
                }}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
