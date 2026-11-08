import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText, ParentChild } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { useRole } from "../../src/lib/role";
import { canWriteDaily, dailyApi, DailyDraft, DailyReport, isBlank, localDate, moodOf, MOODS } from "../../src/lib/daily";
import { Avatar, Button, Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

export default function DailyReports() {
  const { role } = useRole();
  const { me } = useAuth();
  if (role === "parent") return <ParentView />;
  if (canWriteDaily(me)) return <TeacherView />;
  return <Empty title="Daily reports are for parents and teachers." />;
}

function Chips<T extends { id: string }>({ items, value, label, onPick }: { items: T[]; value: string; label: (t: T) => string; onPick: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onPick(t.id)} style={[st.chip, on && st.chipOn]}>
            <Text style={[st.chipText, on && { color: "#fff" }]}>{label(t)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Back() {
  const router = useRouter();
  return <Pressable accessibilityRole="button" onPress={() => router.replace("/")} hitSlop={12}><Text style={st.back}>‹ Home</Text></Pressable>;
}

// ── Parent: read their child's reports ──────────────────────────────────────
function ParentView() {
  const { ctx } = useRole();
  const kids: ParentChild[] = ctx?.as_parent?.children ?? [];
  const [childId, setChildId] = useState("");
  const id = childId || kids[0]?.id || "";
  const q = useQuery({ queryKey: ["daily-child", id], enabled: !!id, queryFn: () => dailyApi.forChild(id) });
  const child = kids.find((k) => k.id === id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={st.pad} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} />}>
        <Back />
        <H1>Daily reports</H1>
        <Muted>{child ? `How ${child.first_name}'s days are going, from their teachers.` : "Notes from your child's teachers."}</Muted>
        {kids.length > 1 ? <Chips items={kids} value={id} label={(k) => k.first_name} onPick={setChildId} /> : null}
        {kids.length === 0 ? <Empty title="No children linked to your account" sub="Contact the school office." />
          : q.isLoading ? <Loading />
          : q.isError ? <ErrorBox text={errorText(q.error, "Couldn't load daily reports.")} onRetry={() => q.refetch()} />
          : (q.data ?? []).length === 0 ? <Empty title="No daily reports yet" sub="When a teacher writes one, it shows here and you get an alert." />
          : (q.data ?? []).map((r) => <ReportCard key={r.id} r={r} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportCard({ r }: { r: DailyReport }) {
  const mood = moodOf(r.mood);
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={st.date}>{fmtDate(r.report_date, { weekday: true })}</Text>
        {mood ? <Text style={st.mood}>{mood.emoji} {mood.label}</Text> : null}
      </View>
      {r.academic ? <Line label="Learning" text={r.academic} /> : null}
      {r.behaviour ? <Line label="Behaviour" text={r.behaviour} /> : null}
      {r.notes ? <Line label="Notes" text={r.notes} /> : null}
    </Card>
  );
}

function Line({ label, text }: { label: string; text: string }) {
  return <View style={{ gap: 2 }}><Text style={st.lineLabel}>{label}</Text><Text style={st.lineText}>{text}</Text></View>;
}

// ── Teacher: write today's report for each pupil in a class ─────────────────
interface Cls { id: string; name: string }
interface Stu { id: string; first_name: string; last_name: string }
const EMPTY: DailyDraft = { mood: "", academic: "", behaviour: "", notes: "" };

function TeacherView() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<DailyDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const date = localDate();

  const classes = useQuery<{ items: Cls[] }>({ queryKey: ["staff-classes"], queryFn: () => api.get("/school/classes", { params: { page_size: 200 } }).then((r) => r.data) });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!classId && classes.data?.items?.length) setClassId(classes.data.items[0].id);
  }, [classes.data, classId]);
  const roster = useQuery<{ items: Stu[] }>({ queryKey: ["roster", classId], enabled: !!classId, queryFn: () => api.get("/school/students", { params: { class_id: classId, page_size: 200, status: "active" } }).then((r) => r.data) });
  const done = useQuery({ queryKey: ["daily-class", classId, date], enabled: !!classId, queryFn: () => dailyApi.forClassDay(classId, date) });
  const byStudent = useMemo(() => Object.fromEntries((done.data ?? []).map((r) => [r.student_id, r])), [done.data]);

  if (classes.isLoading) return <Loading />;
  if (classes.isError) return <ErrorBox text={errorText(classes.error, "Couldn't load classes.")} onRetry={() => classes.refetch()} />;
  const pupils = roster.data?.items ?? [];
  const doneCount = pupils.filter((p) => byStudent[p.id]).length;

  const startEdit = (sid: string) => {
    if (open === sid) { setOpen(null); return; }
    const r = byStudent[sid];
    setDraft(r ? { mood: r.mood || "", academic: r.academic || "", behaviour: r.behaviour || "", notes: r.notes || "" } : EMPTY);
    setError("");
    setOpen(sid);
  };

  const save = async (sid: string) => {
    if (isBlank(draft)) { setError("Pick a mood or write a note first."); return; }
    setBusy(true); setError("");
    try {
      await dailyApi.save(sid, date, draft, byStudent[sid]?.id);
      await qc.invalidateQueries({ queryKey: ["daily-class", classId, date] });
      // jump to the next pupil without a report, to keep the flow quick
      const next = pupils.find((p) => p.id !== sid && !byStudent[p.id]);
      if (next) { setDraft(EMPTY); setOpen(next.id); } else setOpen(null);
    } catch (e) {
      setError(errorText(e, "Couldn't save this report."));
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => { roster.refetch(); done.refetch(); }} />}>
          <Back />
          <H1>Daily reports</H1>
          <Muted>{fmtDate(new Date(), { weekday: true })} · parents get an alert when you save</Muted>
          <Chips items={classes.data?.items ?? []} value={classId} label={(c) => c.name} onPick={(id) => { setClassId(id); setOpen(null); }} />
          {pupils.length ? <Text style={st.progress}>{doneCount} of {pupils.length} done today</Text> : null}
          {roster.isLoading || done.isLoading ? <Loading />
            : pupils.length === 0 ? <Empty title="No pupils in this class" />
            : pupils.map((p) => {
              const r = byStudent[p.id];
              const isOpen = open === p.id;
              const mood = moodOf(r?.mood);
              return (
                <Card key={p.id} style={[{ gap: 10 }, isOpen && { borderColor: colors.brand, borderWidth: 2 }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${p.first_name} ${p.last_name}`} onPress={() => startEdit(p.id)} style={st.pupil}>
                    <Avatar name={`${p.first_name} ${p.last_name}`} size={40} />
                    <Text style={st.pupilName} numberOfLines={1}>{p.first_name} {p.last_name}</Text>
                    <Text style={[st.state, { color: r ? colors.green : colors.muted }]}>{r ? `${mood?.emoji ?? ""} Done ✓` : "To do"}</Text>
                  </Pressable>
                  {isOpen ? (
                    <View style={{ gap: 10 }}>
                      <View style={st.moods}>
                        {MOODS.map((m) => {
                          const on = draft.mood === m.key;
                          return (
                            <Pressable key={m.key} accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: on }} onPress={() => setDraft({ ...draft, mood: on ? "" : m.key })} style={[st.moodBtn, on && st.moodOn]}>
                              <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                              <Text style={[st.moodLabel, on && { color: colors.brand }]}>{m.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Box label="Learning" value={draft.academic} onChange={(v) => setDraft({ ...draft, academic: v })} placeholder="What they did well or found hard" />
                      <Box label="Behaviour" value={draft.behaviour} onChange={(v) => setDraft({ ...draft, behaviour: v })} placeholder="How they behaved and got on with others" />
                      <Box label="Notes for parents" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} placeholder="Anything else parents should know" />
                      {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
                      <Button title={r ? "Update report" : "Save report"} loading={busy} onPress={() => save(p.id)} />
                    </View>
                  ) : null}
                </Card>
              );
            })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Box({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={st.lineLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9AA5A0" multiline style={st.input} />
    </View>
  );
}

const st = StyleSheet.create({
  pad: { padding: 18, gap: 12, paddingBottom: 48 },
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  chip: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: "800", color: colors.text },
  date: { fontWeight: "900", fontSize: 16, color: colors.text, flexShrink: 1 },
  mood: { fontWeight: "800", color: colors.text },
  lineLabel: { fontWeight: "800", color: colors.muted, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5 },
  lineText: { color: colors.text, fontSize: 15.5, lineHeight: 22 },
  progress: { fontWeight: "800", color: colors.brand },
  pupil: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  pupilName: { flex: 1, fontWeight: "800", fontSize: 16, color: colors.text },
  state: { fontWeight: "800" },
  moods: { flexDirection: "row", gap: 6 },
  moodBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", gap: 2 },
  moodOn: { borderColor: colors.brand, backgroundColor: "#EEF6F1" },
  moodLabel: { fontSize: 11, fontWeight: "800", color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15.5, color: colors.text, backgroundColor: "#FBFAF5", minHeight: 64, textAlignVertical: "top" },
  error: { color: colors.red, fontWeight: "700" },
});
