import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { Button, Card, ErrorBox, H1, Loading, Muted, Pill } from "../../../src/components/ui";
import { colors } from "../../../src/lib/theme";

interface Named { id: string; name: string; alias?: string; is_active?: boolean; is_current?: boolean }
interface Card_ {
  student_name?: string; class_name?: string; heading?: string; report_title?: string; class_teacher_name?: string;
  not_configured?: boolean; columns: { key: string; name: string }[];
  subjects: { subject_id: string; subject_name: string; values: Record<string, number | string | null>; grade?: string | null; remark?: string | null; comment?: string | null }[];
  total?: number | string; average?: number | string; grade?: string | null; position?: number; class_size?: number; class_average?: number | string | null;
  attendance_present?: number | null; attendance_total?: number | null; next_term_begins?: string | null;
}
const num = (v: unknown) => (v == null || v === "" ? "–" : String(Math.round(Number(v) * 100) / 100));
const ord = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function Picker({ label, items, value, onPick }: { label: string; items: Named[]; value: string; onPick: (id: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Muted>{label}</Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((x) => (
          <Text key={x.id} onPress={() => onPick(x.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: value === x.id ? colors.brand : colors.border, backgroundColor: value === x.id ? colors.brand : "#fff", color: value === x.id ? "#fff" : colors.text }}>{x.alias || x.name}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ReportCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sessions = useQuery<Named[]>({ queryKey: ["sessions"], queryFn: () => api.get("/platform/sessions").then((r) => r.data) });
  const terms = useQuery<Named[]>({ queryKey: ["terms"], queryFn: () => api.get("/platform/academic-terms").then((r) => r.data) });
  const subs = useQuery<Named[]>({ queryKey: ["sub-terms"], queryFn: () => api.get("/platform/academic-sub-terms").then((r) => r.data) });
  const [sessionId, setSession] = useState(""), [termId, setTerm] = useState(""), [subId, setSub] = useState("");

  useEffect(() => { if (!sessionId && sessions.data?.length) setSession((sessions.data.find((s) => s.is_current) ?? sessions.data[0]).id); }, [sessions.data, sessionId]);
  useEffect(() => { if (!termId && terms.data?.length) setTerm((terms.data.find((t) => t.is_active) ?? terms.data[0]).id); }, [terms.data, termId]);
  useEffect(() => {
    if (!subId && subs.data?.length) setSub((subs.data.find((s) => s.name.toLowerCase().replace(/[\s_]/g, "-") === "full-term") ?? subs.data[0]).id);
  }, [subs.data, subId]);

  const ready = !!(sessionId && termId && subId);
  const card = useQuery<Card_>({
    queryKey: ["report-card", id, termId, subId, sessionId], enabled: ready, retry: false,
    queryFn: () => api.get("/platform/report-card", { params: { student_id: id, term_id: termId, sub_term_id: subId, session_id: sessionId || undefined } }).then((r) => r.data),
  });
  const detail: string | undefined = (card.error as any)?.response?.data?.detail;
  const c = card.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        <Button title="← Back" color={colors.muted} onPress={() => router.back()} />
        <H1>Report card</H1>
        <Picker label="Session" items={sessions.data ?? []} value={sessionId} onPick={setSession} />
        <Picker label="Term" items={terms.data ?? []} value={termId} onPick={setTerm} />
        <Picker label="Report" items={subs.data ?? []} value={subId} onPick={setSub} />

        {!ready || card.isLoading ? <Loading /> : card.isError ? (
          <ErrorBox text={typeof detail === "string" ? detail : "This report card isn't available yet. It appears once the school publishes it."} onRetry={() => card.refetch()} />
        ) : !c || c.not_configured ? (
          <Card><Muted>This report isn't set up yet for the chosen term.</Muted></Card>
        ) : (
          <>
            <Card style={{ backgroundColor: colors.brand, gap: 4 }}>
              <Text style={{ color: "#CFE6DA", fontWeight: "700" }}>{c.heading || c.report_title}</Text>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>{c.student_name}</Text>
              <Text style={{ color: "#CFE6DA" }}>{c.class_name}{c.class_teacher_name ? ` · ${c.class_teacher_name}` : ""}</Text>
            </Card>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Card style={{ flex: 1 }}><Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>{num(c.average)}%</Text><Muted>Average</Muted></Card>
              <Card style={{ flex: 1 }}><Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>{c.grade || "–"}</Text><Muted>Grade</Muted></Card>
              <Card style={{ flex: 1 }}><Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>{c.position ? ord(c.position) : "–"}</Text><Muted>of {c.class_size || "–"}</Muted></Card>
            </View>
            {c.subjects.map((s) => (
              <Card key={s.subject_id} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text, flex: 1 }}>{s.subject_name}</Text>
                  {s.grade ? <Pill text={s.grade} color={colors.brandSoft} /> : null}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {c.columns.map((col) => (
                    <View key={col.key} style={{ backgroundColor: "#FBFAF5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontWeight: "900", color: colors.text }}>{num(s.values?.[col.key])}</Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>{col.name}</Text>
                    </View>
                  ))}
                </View>
                {s.remark || s.comment ? <Muted>{s.comment || s.remark}</Muted> : null}
              </Card>
            ))}
            {c.attendance_total != null && <Card><Muted>Attendance: present {c.attendance_present ?? 0} of {c.attendance_total} days</Muted></Card>}
            {c.next_term_begins ? <Card><Muted>Next term begins {new Date(c.next_term_begins).toLocaleDateString()}</Muted></Card> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
