import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRole } from "../../src/lib/role";
import { Avatar, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

export default function Children() {
  const { ctx, isLoading, isError, refetch } = useRole();
  if (isLoading) return <Loading />;
  if (isError || !ctx) return <ErrorBox text="Couldn't load your children." onRetry={refetch} />;
  const kids = ctx.as_parent?.children ?? [];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
        <H1>My children</H1>
        {kids.length === 0 ? <Empty title="No children linked" sub="Contact the school office to link your children." /> : kids.map((c) => {
          const att = c.stats.attendance_pct;
          const ac = att == null ? colors.muted : att >= 90 ? colors.green : att >= 75 ? colors.amber : colors.red;
          return (
            <Card key={c.id} style={{ gap: 14 }}>
              <View style={st.top}>
                <Avatar name={`${c.first_name} ${c.last_name}`} size={60} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={st.name}>{c.first_name} {c.last_name}</Text>
                  <Muted>{c.class_name || "No class yet"} · {c.relationship}</Muted>
                  {c.is_primary ? <Pill text="Primary contact" color={colors.indigo} /> : null}
                </View>
              </View>
              <View style={st.stats}>
                <View style={st.stat}><Text style={[st.num, { color: ac }]}>{att == null ? "–" : `${Math.round(att)}%`}</Text><Muted>Attendance</Muted></View>
                <View style={st.stat}><Text style={st.num}>{c.stats.latest_grade_letter ?? "–"}</Text><Muted>Latest grade</Muted></View>
                <View style={st.stat}><Text style={st.num}>{c.stats.pending_assignments}</Text><Muted>Assignments</Muted></View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  top: { flexDirection: "row", gap: 14, alignItems: "center" },
  name: { fontSize: 19, fontWeight: "900", color: colors.text },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: "#FBFAF5", borderRadius: 12, padding: 10, gap: 2 },
  num: { fontSize: 22, fontWeight: "900", color: colors.text },
});
