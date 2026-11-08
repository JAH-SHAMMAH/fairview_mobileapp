import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../../../src/lib/api";
import { Button, Card, ErrorBox, H1, Loading, Muted, Pill } from "../../../src/components/ui";
import { colors } from "../../../src/lib/theme";
import { notify } from "../../../src/lib/confirm";

interface Row { answer_id: string; question_text: string | null; question_type: string | null; max_points: number; correct_answer: string | null; answer_text: string | null; is_correct: boolean | null; points_awarded: number | null; needs_grading: boolean }
const strip = (h: string | null) => (h ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

export default function Remark() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery<{ attempt: { student_name?: string | null; score?: number | null; max_score?: number | null }; answers: Row[] }>({ queryKey: ["review", id], queryFn: () => api.get(`/cbt/attempts/${id}/review`).then((r) => r.data) });
  const [pts, setPts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!q.data) return;
    const m: Record<string, string> = {};
    q.data.answers.forEach((a) => { m[a.answer_id] = a.points_awarded == null ? "" : String(a.points_awarded); });
    setPts(m);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const items = (q.data?.answers ?? []).filter((a) => pts[a.answer_id] !== "" && pts[a.answer_id] != null && !isNaN(Number(pts[a.answer_id])))
        .map((a) => ({ answer_id: a.answer_id, points_awarded: Math.max(0, Math.min(Number(pts[a.answer_id]), a.max_points)) }));
      return api.post(`/cbt/attempts/${id}/remark`, items).then((r) => r.data as { score: number; max_score: number });
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["cbt-results"] }); qc.invalidateQueries({ queryKey: ["review", id] }); notify("Saved", `New score: ${r.score}/${r.max_score}`); router.back(); },
    onError: (e) => Alert.alert("Couldn't save", errorText(e, "You may not have permission to mark this.")),
  });

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorBox text="Couldn't load this attempt." onRetry={() => q.refetch()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Button title="← Back" color={colors.muted} onPress={() => router.back()} />
        <H1>{q.data.attempt.student_name || "Student"}</H1>
        <Muted>Score now: {q.data.attempt.score ?? 0}/{q.data.attempt.max_score ?? 0}. Enter marks for each answer, up to its maximum.</Muted>
        {q.data.answers.map((a, n) => (
          <Card key={a.answer_id} style={{ gap: 8, borderLeftWidth: 6, borderLeftColor: a.needs_grading ? colors.amber : a.is_correct ? colors.green : colors.red }}>
            <Text style={{ fontWeight: "800", color: colors.text }}>{n + 1}. {strip(a.question_text)}</Text>
            <Text style={{ color: colors.text }}>Answer: {a.answer_text || "No answer"}</Text>
            {a.correct_answer ? <Muted>Expected: {a.correct_answer}</Muted> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TextInput value={pts[a.answer_id] ?? ""} onChangeText={(t) => setPts((p) => ({ ...p, [a.answer_id]: t.replace(/[^0-9.]/g, "") }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#9AA5A0" style={{ width: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 16, color: colors.text, backgroundColor: "#fff" }} />
              <Muted>/ {a.max_points}</Muted>
              {a.needs_grading ? <Pill text="Needs marking" color={colors.amber} /> : null}
            </View>
          </Card>
        ))}
        <Button title="Save marks" color={colors.green} loading={save.isPending} onPress={() => save.mutate()} />
      </ScrollView>
    </SafeAreaView>
  );
}
