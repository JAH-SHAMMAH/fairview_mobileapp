import React from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors } from "../lib/theme";

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function H1({ children }: { children: React.ReactNode }) { return <Text style={s.h1}>{children}</Text>; }
export function Muted({ children }: { children: React.ReactNode }) { return <Text style={s.muted}>{children}</Text>; }
// Label under a number in a narrow stat box: up to two lines, and on phones it
// shrinks to fit (adjustsFontSizeToFit) rather than breaking a word in half.
export function StatLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.statLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{children}</Text>;
}
export function Button({ title, onPress, loading, color = colors.brand, disabled }: { title: string; onPress: () => void; loading?: boolean; color?: string; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={loading || disabled} style={({ pressed }) => [s.btn, { backgroundColor: color, opacity: pressed || disabled ? 0.7 : 1 }]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{title}</Text>}
    </Pressable>
  );
}
export function Loading() { return <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>; }
export function Empty({ title, sub }: { title: string; sub?: string }) {
  return <View style={s.center}><Text style={s.emptyTitle}>{title}</Text>{sub ? <Text style={s.muted}>{sub}</Text> : null}</View>;
}
export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={s.center}>
      <Text style={[s.emptyTitle, { color: colors.red }]}>{text}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} /> : null}
    </View>
  );
}
export function Pill({ text, color }: { text: string; color: string }) {
  return <View style={[s.pill, { backgroundColor: color + "22" }]}><Text style={{ color, fontWeight: "800", fontSize: 12 }}>{text}</Text></View>;
}
export function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const ini = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "900", fontSize: size / 2.6 }}>{ini}</Text></View>;
}
export const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 },
  h1: { fontSize: 26, fontWeight: "900", color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  statLabel: { fontSize: 11.5, lineHeight: 14, color: colors.muted, fontWeight: "600" },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
});
