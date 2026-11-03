import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

interface Asg { class_id: string; class_name?: string | null; subject_id: string; subject_name?: string | null }
interface Named { id: string; name: string; alias?: string; is_active?: boolean }
interface Grid {
  assessments: { id: string; name: string; max_score: number | string; sub_term_name?: string | null }[];
  students: { id: string; name: string }[];
  scores: Record<string, Record<string, number | string | null>>;
}

function Chips<T extends { id: string }>({ items, value, label, onPick }: { items: T[]; value: string; label: (x: T) => string; onPick: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map((x) => <Text key={x.id} onPress={() => onPick(x.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: value === x.id ? colors.brand : colors.border, backgroundColor: value === x.id ? colors.brand : "#fff", color: value === x.id ? "#fff" : colors.text }}>{label(x)}</Text>)}
    </ScrollView>
  );
}

export default function ReportEntry() {
  const router = useRouter();
  const asg = useQuery<Asg[]>({ queryKey: ["my-assignments"], queryFn: () => api.get("/platform/my-teaching-assignments").then((r) => r.data) });
  const terms = useQuery<Named[]>({ queryKey: ["terms"], queryFn: () => api.get("/platform/academic-terms").then((r) => r.data) });
  const subs = useQuery<Named[]>({ queryKey: ["sub-terms"], queryFn: () => api.get("/platform/academic-sub-terms").then((r) => r.data) });
  const [classId, setClass] = useState(""), [subjectId, setSubject] = useState(""), [termId, setTerm] = useState(""), [subId, setSub] = useState("");
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});

  const classes = Array.from(new Map((asg.data ?? []).map((a) => [a.class_id, { id: a.class_id, name: a.class_name || "Class" }])).values());
  const subjects = (asg.data ?? []).filter((a) => a.class_id === classId).map((a) => ({ id: a.subject_id, name: a.subject_name || "Subject" }));

  useEffect(() => { if (!classId && classes.length) setClass(classes[0].id); }, [classes.length]); // eslint-disable-line
  useEffect(() => { if (classId && !subjects.find((s) => s.id === subjectId)) setSubject(subjects[0]?.id ?? ""); }, [classId, asg.data]); // eslint-disable-line
  useEffect(() => { if (!termId && terms.data?.length) setTerm((terms.data.find((t) => t.is_active) ?? terms.data[0]).id); }, [terms.data, termId]);
  useEffect(() => { if (!subId && subs.data?.length) setSub((subs.data.find((s) => s.name.toLowerCase().replace(/[\s_]/g, "-") === "full-term") ?? subs.data[0]).id); }, [subs.data, subId]);

  const ready = !!(classId && subjectId && termId);
  const grid = useQuery<Grid>({
    queryKey: ["entry-grid", classId, subjectId, termId, subId], enabled: ready, retry: false,
    queryFn: () => api.get("/platform/report-entry", { params: { class_id: classId, subject_id: subjectId, term_id: termId, sub_term_id: subId || undefined } }).then((r) => r.data),
  });
  const detail = (grid.error as any)?.response?.data?.detail;

  useEffect(() => {
    if (!grid.data) return;
    const m: Record<string, Record<string, string>> = {};
    grid.data.students.forEach((s) => { m[s.id] = {}; grid.data!.assessments.forEach((a) => { const v = grid.data!.scores?.[s.id]?.[a.id]; m[s.id][a.id] = v == null ? "" : String(v); }); });
    setVals(m);
  }, [grid.data]);

  const save = useMutation({
    mutationFn: () => {
      const items: { student_id: string; assessment_id: string; score: number | null }[] = [];
      const max: Record<string, number> = Object.fromEntries((grid.data?.assessments ?? []).map((a) => [a.id, Number(a.max_score)]));
      for (const [sid, row] of Object.entries(vals)) for (const [aid, v] of Object.entries(row)) {
        if (v === "") { if (grid.data?.scores?.[sid]?.[aid] != null) items.push({ student_id: sid, assessment_id: aid, score: null }); continue; }
        const n = Number(v);
        if (isNaN(n) || n < 0 || n > max[aid]) throw new Error(`A score must be between 0 and ${max[aid]}.`);
        items.push({ student_id: sid, assessment_id: aid, score: n });
      }
      return api.post("/platform/report-entry", { class_id: classId, subject_id: subjectId, items }).then((r) => r.data);
    },
    onSuccess: () => { Alert.alert("Saved", "Scores saved."); grid.refetch(); },
    onError: (e) => Alert.alert("Couldn't save", e instanceof Error && !("response" in e) ? e.message : errorText(e)),
  });

  if (asg.isLoading) return <Loading />;
  if (asg.isError) return <ErrorBox text="Couldn't load your classes." onRetry={() => asg.refetch()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Button title="← Back" color={colors.muted} onPress={() => router.back()} />
        <H1>Enter scores</H1>
        {classes.length === 0 ? <Empty title="No classes assigned" sub="You're not on the timetable for any class and subject yet." /> : (
          <>
            <Muted>Class</Muted><Chips items={classes} value={classId} label={(x) => x.name} onPick={setClass} />
            <Muted>Subject</Muted><Chips items={subjects} value={subjectId} label={(x) => x.name} onPick={setSubject} />
            <Muted>Term</Muted><Chips items={terms.data ?? []} value={termId} label={(x) => x.name} onPick={setTerm} />
            <Muted>Report</Muted><Chips items={subs.data ?? []} value={subId} label={(x) => x.alias || x.name} onPick={setSub} />
            {!ready || grid.isLoading ? <Loading /> : grid.isError ? <ErrorBox text={typeof detail === "string" ? detail : "Couldn't open this grid."} onRetry={() => grid.refetch()} /> : (grid.data?.students ?? []).length === 0 ? <Empty title="No pupils in this class" /> : (
              <>
                {(grid.data?.students ?? []).map((s) => (
                  <Card key={s.id} style={{ gap: 8 }}>
                    <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>{s.name}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {(grid.data?.assessments ?? []).map((a) => (
                        <View key={a.id} style={{ width: 92 }}>
                          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "700" }} numberOfLines={1}>{a.name} /{Number(a.max_score)}</Text>
                          <TextInput value={vals[s.id]?.[a.id] ?? ""} onChangeText={(t) => setVals((v) => ({ ...v, [s.id]: { ...v[s.id], [a.id]: t.replace(/[^0-9.]/g, "") } }))} keyboardType="decimal-pad" placeholder="–" placeholderTextColor="#9AA5A0" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 16, color: colors.text, backgroundColor: "#fff" }} />
                        </View>
                      ))}
                    </View>
                  </Card>
                ))}
                <Button title="Save scores" color={colors.green} loading={save.isPending} onPress={() => save.mutate()} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
