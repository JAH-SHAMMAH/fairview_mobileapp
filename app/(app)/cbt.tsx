import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

interface Exam { id: string; title: string; subject_name?: string | null; class_name?: string | null; status?: string; exam_type?: string; hold_results?: boolean }
interface Results {
  exam: { title: string; hold_results: boolean; results_published_at: string | null; pass_percentage: number };
  attempts: { id: string; student_name: string | null; score: number; max_score: number; percentage: number; status: string; passed: boolean; needs_review: boolean; superseded: boolean }[];
  stats: { attempts: number; completed: number; average: number; highest: number; lowest: number; pass_rate: number; pending_review: number };
}

function ResultsView({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery<Results>({ queryKey: ["cbt-results", id], queryFn: () => api.get(`/cbt/exams/${id}/results`).then((r) => r.data) });
  const publish = useMutation({
    mutationFn: () => api.post(`/cbt/exams/${id}/publish-results`).then((r) => r.data),
    onSuccess: () => { Alert.alert("Released", "Students can now see their results."); qc.invalidateQueries({ queryKey: ["cbt-results", id] }); },
    onError: (e) => Alert.alert("Couldn't release", errorText(e)),
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorBox text="Couldn't load results." onRetry={() => q.refetch()} />;
  const { stats, attempts, exam } = q.data;
  const held = exam.hold_results && !exam.results_published_at;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Card style={{ flex: 1, padding: 10 }}><Text style={{ fontWeight: "900", fontSize: 20, color: colors.text }}>{stats.completed}</Text><Muted>Done</Muted></Card>
        <Card style={{ flex: 1, padding: 10 }}><Text style={{ fontWeight: "900", fontSize: 20, color: colors.text }}>{stats.average}</Text><Muted>Average</Muted></Card>
        <Card style={{ flex: 1, padding: 10 }}><Text style={{ fontWeight: "900", fontSize: 20, color: colors.green }}>{stats.pass_rate}%</Text><Muted>Passed</Muted></Card>
      </View>
      {stats.pending_review > 0 && <Muted>{stats.pending_review} attempt(s) have written answers to mark. Tap a name to mark.</Muted>}
      {held && <Button title="Release results to students" color={colors.indigo} loading={publish.isPending} onPress={() => Alert.alert("Release results?", "Students and parents will see the scores.", [{ text: "Cancel", style: "cancel" }, { text: "Release", onPress: () => publish.mutate() }])} />}
      {attempts.filter((a) => !a.superseded).map((a) => (
        <View key={a.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, gap: 8 }}>
          <Text onPress={() => a.status !== "in_progress" && router.push({ pathname: "/remark/[id]", params: { id: a.id } })} style={{ flex: 1, color: a.needs_review ? colors.amber : colors.text, fontWeight: "700" }}>{a.student_name || "Student"}{a.needs_review ? "  · mark ›" : "  ›"}</Text>
          <Text style={{ fontWeight: "900", color: a.status === "in_progress" ? colors.muted : a.passed ? colors.green : colors.red }}>{a.status === "in_progress" ? "In progress" : `${a.score}/${a.max_score} · ${Math.round(a.percentage)}%`}</Text>
        </View>
      ))}
      {attempts.length === 0 && <Muted>No one has taken this yet.</Muted>}
    </View>
  );
}

export default function TeacherCbt() {
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery<{ items: Exam[] }>({ queryKey: ["staff-exams"], queryFn: () => api.get("/cbt/exams", { params: { for_me: true, page: 1, page_size: 100 } }).then((r) => r.data) });
  const items = (q.data?.items ?? []).filter((e) => e.exam_type !== "practice");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { q.refetch(); }} />}>
        <H1>CBT results</H1>
        <Muted>Your exams, tests and mocks. Tap one to see how students did.</Muted>
        {q.isLoading ? <Loading /> : q.isError ? <ErrorBox text="Couldn't load your exams." onRetry={() => q.refetch()} /> : items.length === 0 ? <Empty title="No exams yet" sub="Create exams in the web portal and they'll show up here." /> : items.map((e) => (
          <Card key={e.id} style={{ gap: 8 }}>
            <Text onPress={() => setOpen(open === e.id ? null : e.id)} style={{ fontSize: 17, fontWeight: "900", color: colors.text }}>{e.title}</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Pill text={(e.exam_type || "exam").toUpperCase()} color={colors.indigo} />
              <Muted>{[e.subject_name, e.class_name].filter(Boolean).join(" · ")}</Muted>
            </View>
            {open === e.id ? <ResultsView id={e.id} /> : <Text onPress={() => setOpen(e.id)} style={{ color: colors.indigo, fontWeight: "800" }}>View results ›</Text>}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
