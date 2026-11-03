import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

interface Catalog { sources: { key: string; label: string }[]; past_questions_ready: boolean }
interface Subj { id: string; name: string; question_count: number | null }
const COUNTS = [10, 20, 40];

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return <Text onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand : "#fff", color: on ? "#fff" : colors.text }}>{label}</Text>;
}

export default function Practice() {
  const router = useRouter();
  const [source, setSource] = useState("school");
  const [subject, setSubject] = useState<Subj | null>(null);
  const [count, setCount] = useState(10);
  const cat = useQuery<Catalog>({ queryKey: ["practice-catalog"], queryFn: () => api.get("/cbt/practice/catalog").then((r) => r.data) });
  const subs = useQuery<{ items: Subj[] }>({ queryKey: ["practice-subjects", source], queryFn: () => api.get("/cbt/practice/subjects", { params: { source } }).then((r) => r.data) });

  const start = useMutation({
    mutationFn: () => api.post("/cbt/practice/start", source === "school" ? { source, subject_id: subject!.id, count } : { source, subject: subject!.id, count }).then((r) => r.data as { exam_id: string }),
    onSuccess: (r) => router.push({ pathname: "/exam/[id]", params: { id: r.exam_id, practice: "1" } }),
    onError: (e) => Alert.alert("Can't start practice", errorText(e)),
  });

  if (cat.isLoading) return <Loading />;
  if (cat.isError || !cat.data) return <ErrorBox text="Couldn't load practice." onRetry={() => cat.refetch()} />;
  const sources = cat.data.sources.filter((s) => s.key === "school" || cat.data!.past_questions_ready);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        <Button title="← Back" color={colors.muted} onPress={() => router.back()} />
        <H1>Practice</H1>
        <Muted>Pick a source and subject. Your score is saved to your progress.</Muted>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {sources.map((s) => <Chip key={s.key} on={source === s.key} label={s.label} onPress={() => { setSource(s.key); setSubject(null); }} />)}
        </ScrollView>
        {subs.isLoading ? <Loading /> : (subs.data?.items ?? []).length === 0 ? <Empty title="No subjects yet" sub="Practice questions will appear here when they are added." /> : (
          <View style={{ gap: 8 }}>
            {(subs.data?.items ?? []).map((s) => (
              <Card key={s.id} style={{ paddingVertical: 12, borderColor: subject?.id === s.id ? colors.brand : colors.border, borderWidth: subject?.id === s.id ? 2 : 1 }}>
                <Text onPress={() => setSubject(s)} style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>{s.name}{s.question_count != null ? `  ·  ${s.question_count} questions` : ""}</Text>
              </Card>
            ))}
          </View>
        )}
        <Muted>Number of questions</Muted>
        <View style={{ flexDirection: "row", gap: 8 }}>{COUNTS.map((n) => <Chip key={n} on={count === n} label={String(n)} onPress={() => setCount(n)} />)}</View>
        <Button title={subject ? `Start ${subject.name}` : "Choose a subject"} disabled={!subject} loading={start.isPending} onPress={() => start.mutate()} />
      </ScrollView>
    </SafeAreaView>
  );
}
