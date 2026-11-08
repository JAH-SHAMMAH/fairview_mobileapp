import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme";

export interface CheckItem { id: string; label: string; sub?: string }

/** Tap-to-toggle list (roles, sections). Big rows so they're easy to hit on a phone. */
export function CheckList({ items, selected, onToggle, disabled }: {
  items: CheckItem[]; selected: string[]; onToggle: (id: string) => void; disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((it) => {
        const on = selected.includes(it.id);
        return (
          <Pressable
            key={it.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={it.label}
            disabled={disabled}
            onPress={() => onToggle(it.id)}
            style={[st.row, on && st.rowOn]}
          >
            <View style={[st.box, on && st.boxOn]}>{on ? <Text style={st.tick}>✓</Text> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>{it.label}</Text>
              {it.sub ? <Text style={st.sub} numberOfLines={1}>{it.sub}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", minHeight: 48 },
  rowOn: { borderColor: colors.brand, backgroundColor: "#EEF6F1" },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tick: { color: "#fff", fontWeight: "900", fontSize: 14 },
  label: { fontSize: 15, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
});
