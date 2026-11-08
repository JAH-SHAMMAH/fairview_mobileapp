import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

interface Exam { id: string; title: string; subject_name?: string | null; duration_minutes?: number; start_time?: string | null; end_time?: string | null; status?: string; max_attempts: number; is_live?: boolean }
interface Attempt { exam_id: string; status: string; score?: number | null; max_score?: number | null }
const KINDS = [{ key: "exam", label: "Exams" }, { key: "test", label: "Tests" }, { key: "mock", label: "Mocks" }] as const;

export default function Exams() {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("exam");
  const list = useQuery<{ items: Exam[] }>({ queryKey: ["my-exams", kind], queryFn: () => api.get("/cbt/exams", { params: { for_me: true, exam_type: kind, page: 1, page_size: 100 } }).then((r) => r.data) });
  const att = useQuery<{ items: Attempt[] }>({ queryKey: ["my-attempts"], queryFn: () => api.get("/cbt/attempts").then((r) => r.data) });

  const attempts = att.data?.items ?? [];
  const now = new Date();
  const state = (e: Exam): { text: string; color: string } => {
    const done = attempts.filter((a) => a.exam_id === e.id && (a.status === "submitted" || a.status === "graded")).length;
    if (e.max_attempts > 0 && done >= e.max_attempts) return { text: "Completed", color: colors.green };
    if (e.status === "closed") return { text: "Closed", color: colors.muted };
    if (e.status === "draft") return { text: "Not ready", color: colors.muted };
    if (e.start_time && now < new Date(e.start_time)) return { text: `Opens ${fmtDate(e.start_time, { time: true })}`, color: colors.amber };
    if (e.end_time && now > new Date(e.end_time)) return { text: "Ended", color: colors.muted };
    return { text: "Open", color: colors.indigo };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { list.refetch(); att.refetch(); }} />}>
        <H1>Exam portal</H1>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {KINDS.map((k) => (
            <Text key={k.key} onPress={() => setKind(k.key)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: kind === k.key ? colors.brand : colors.border, backgroundColor: kind === k.key ? colors.brand : "#fff", color: kind === k.key ? "#fff" : colors.text }}>{k.label}</Text>
          ))}
        </View>
        <Card style={{ backgroundColor: colors.rose, borderWidth: 0, gap: 8 }}><Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>Practice for JAMB, WAEC &amp; NECO</Text><Button title="Start practising" color={colors.brand} onPress={() => router.push("/practice")} /></Card>
        {list.isLoading ? <Loading /> : list.isError ? <ErrorBox text="Couldn't load exams." onRetry={() => list.refetch()} /> : (list.data?.items ?? []).length === 0 ? <Empty title={`No ${kind}s yet`} sub="They'll show up here when your teachers publish them." /> : (list.data?.items ?? []).map((e) => {
          const s = state(e);
          return (
            <Card key={e.id} style={{ gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text }}>{e.title}</Text>
              <Muted>{[e.subject_name, e.duration_minutes ? `${e.duration_minutes} min` : null].filter(Boolean).join(" · ") || " "}</Muted>
              <Pill text={s.text} color={s.color} />
              {s.text === "Open" ? <Button title="Start" onPress={() => router.push({ pathname: "/exam/[id]", params: { id: e.id } })} /> : null}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
