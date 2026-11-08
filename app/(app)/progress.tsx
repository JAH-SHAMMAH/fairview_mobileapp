import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { Card, Empty, ErrorBox, H1, Loading, Muted, Pill, StatLabel } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

interface Progress {
  overall: { taken: number; average: number | null; best: number | null; pending_results: number; trend: number[] };
  subjects: { name: string; taken: number; average: number | null; best: number }[];
  recent: { attempt_id: string; title: string; exam_type: string; subject_name: string | null; score: number | null; max_score: number | null; percentage: number | null; pending: boolean; submitted_at: string | null }[];
}
const pctColor = (p: number | null) => (p == null ? colors.muted : p >= 70 ? colors.green : p >= 50 ? colors.amber : colors.red);

export default function ProgressScreen() {
  const q = useQuery<Progress>({ queryKey: ["my-progress"], queryFn: () => api.get("/cbt/my-progress").then((r) => r.data) });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorBox text="Couldn't load your progress." onRetry={() => q.refetch()} />;
  const { overall, subjects, recent } = q.data;
  const trend = overall.trend ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { q.refetch(); }} />}>
        <H1>My progress</H1>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Card style={{ flex: 1, padding: 12 }}><Text style={{ fontSize: 24, fontWeight: "900", color: pctColor(overall.average) }}>{overall.average == null ? "–" : `${Math.round(overall.average)}%`}</Text><StatLabel>Average</StatLabel></Card>
          <Card style={{ flex: 1, padding: 12 }}><Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>{overall.taken}</Text><StatLabel>Taken</StatLabel></Card>
          <Card style={{ flex: 1, padding: 12 }}><Text style={{ fontSize: 24, fontWeight: "900", color: colors.green }}>{overall.best == null ? "–" : `${Math.round(overall.best)}%`}</Text><StatLabel>Best</StatLabel></Card>
        </View>

        {trend.length > 1 && (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontWeight: "900", color: colors.text }}>Recent scores</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 90 }}>
              {trend.map((p, i) => <View key={i} style={{ flex: 1, height: Math.max(6, (p / 100) * 90), borderRadius: 6, backgroundColor: pctColor(p) }} />)}
            </View>
          </Card>
        )}
        {overall.pending_results > 0 && <Card><Muted>{overall.pending_results} result(s) are waiting for your teacher to release them.</Muted></Card>}

        {subjects.length > 0 && <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>By subject</Text>}
        {subjects.map((s) => (
          <Card key={s.name} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "900", color: colors.text, flex: 1 }}>{s.name}</Text>
              <Text style={{ fontWeight: "900", color: pctColor(s.average) }}>{s.average == null ? "–" : `${Math.round(s.average)}%`}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "#EFEDE3" }}><View style={{ width: `${Math.min(100, s.average ?? 0)}%`, height: 8, borderRadius: 4, backgroundColor: pctColor(s.average) }} /></View>
            <Muted>{s.taken} taken · best {Math.round(s.best)}%</Muted>
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>Recent results</Text>
        {recent.length === 0 ? <Empty title="No results yet" sub="Finish an exam or practice test to see it here." /> : recent.map((r) => (
          <Card key={r.attempt_id} style={{ gap: 6 }}>
            <Text style={{ fontWeight: "900", color: colors.text }}>{r.title}</Text>
            <Muted>{[r.subject_name, r.submitted_at ? fmtDate(r.submitted_at) : null].filter(Boolean).join(" · ")}</Muted>
            {r.pending ? <Pill text="Result pending" color={colors.amber} /> : <Pill text={`${r.score ?? 0}/${r.max_score ?? 0} · ${Math.round(r.percentage ?? 0)}%`} color={pctColor(r.percentage)} />}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
