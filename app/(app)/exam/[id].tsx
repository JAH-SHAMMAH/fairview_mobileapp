import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../../../src/lib/api";
import { Button, Card, ErrorBox, Loading, Muted } from "../../../src/components/ui";
import { colors } from "../../../src/lib/theme";

type Opt = { key: string; text: string } | string;
interface Q { id: string; question_text: string; question_type: string; options?: Opt[] | null; points: number; answer_type?: string }
interface Attempt { id: string; deadline?: string | null; score?: number | null; max_score?: number | null; status?: string }
interface Exam { id: string; title: string; duration_minutes?: number; instructions?: string | null }

const strip = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const ok = (o: Opt) => (typeof o === "string" ? { key: o, text: o } : o);
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function ExamRoom() {
  const { id, practice } = useLocalSearchParams<{ id: string; practice?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [stage, setStage] = useState<"loading" | "intro" | "sitting" | "done" | "review" | "error">("loading");
  const [review, setReview] = useState<{ question_text: string; question_type: string; options?: Opt[] | null; your_answer: string | null; correct_answer: string | null; is_correct: boolean }[]>([]);
  const [msg, setMsg] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const deadline = useRef<number | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const e = (await api.get(`/cbt/exams/${id}`)).data as Exam;
        setExam(e);
        setStage("intro");
      } catch (err) { setMsg(errorText(err, "Couldn't open this exam.")); setStage("error"); }
    })();
  }, [id]);

  const begin = async () => {
    setBusy(true);
    try {
      const a = (await api.post(`/cbt/exams/${id}/attempts`)).data as Attempt;
      const q = ((await api.get(`/cbt/exams/${id}/questions`)).data.items ?? []) as Q[];
      if (!q.length) { Alert.alert("No questions", "This exam has no questions yet."); setBusy(false); return; }
      setAttempt(a); setQs(q);
      deadline.current = a.deadline ? new Date(a.deadline).getTime() : null;
      setStage("sitting");
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      Alert.alert("Can't start", typeof d === "object" && d?.message ? d.message : errorText(err, "Can't start this exam."));
    }
    setBusy(false);
  };

  const submit = async (auto = false) => {
    if (!attempt || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      const body = { answers: qs.filter((q) => (answers[q.id] ?? "").length).map((q) => ({ question_id: q.id, answer_text: answers[q.id] })) };
      const r = (await api.post(`/cbt/attempts/${attempt.id}/submit`, body)).data as Attempt;
      setResult(r); setStage("done");
      qc.invalidateQueries({ queryKey: ["my-exams"] }); qc.invalidateQueries({ queryKey: ["my-attempts"] }); qc.invalidateQueries({ queryKey: ["my-progress"] });
      if (auto) Alert.alert("Time is up", "Your answers were submitted.");
    } catch (err) {
      submitted.current = false;
      Alert.alert("Couldn't submit", errorText(err, "Check your connection and try again. Your answers are still here."));
    }
    setBusy(false);
  };

  const openReview = async () => {
    if (!result) return;
    setBusy(true);
    try { setReview((await api.get(`/cbt/practice/attempts/${result.id}/review`)).data.items); setStage("review"); }
    catch (err) { Alert.alert("Review unavailable", errorText(err)); }
    setBusy(false);
  };

  // countdown against the server deadline
  useEffect(() => {
    if (stage !== "sitting" || deadline.current == null) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline.current! - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) { clearInterval(t); submit(true); }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // block the Android back button while sitting
  useEffect(() => {
    if (stage !== "sitting") return;
    const h = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => h.remove();
  }, [stage]);

  const q = qs[i];
  const answered = useMemo(() => qs.filter((x) => (answers[x.id] ?? "").length).length, [qs, answers]);
  const type = String(q?.question_type || "").toLowerCase();

  if (stage === "loading") return <Loading />;
  if (stage === "error") return <ErrorBox text={msg} onRetry={() => router.back()} />;

  if (stage === "intro") return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={st.title}>{exam?.title}</Text>
        <Card style={{ gap: 6 }}>
          <Muted>{exam?.duration_minutes ? `Time allowed: ${exam.duration_minutes} minutes` : "No time limit"}</Muted>
          {exam?.instructions ? <Text style={{ color: colors.text, fontSize: 15 }}>{strip(exam.instructions)}</Text> : null}
          <Muted>Once you start, the timer runs and you can’t leave until you submit.</Muted>
        </Card>
        <Button title="Start exam" onPress={begin} loading={busy} />
        <Button title="Back" color={colors.muted} onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );

  if (stage === "done") return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
        <Text style={{ fontSize: 56 }}>✅</Text>
        <Text style={st.title}>Submitted!</Text>
        <Muted>{result && result.score != null && result.max_score ? `Your score: ${result.score}/${result.max_score}` : "Your answers were received. Your teacher will release the result."}</Muted>
        {practice === "1" && result ? <Button title="Review answers" color={colors.indigo} loading={busy} onPress={openReview} /> : null}
        <Button title="Back to exams" onPress={() => router.replace("/exams")} />
      </View>
    </SafeAreaView>
  );

  if (stage === "review") {
    const label = (it: (typeof review)[number], key: string | null) => {
      if (!key) return "No answer";
      const o = (it.options ?? []).map(ok).find((x) => x.key === key);
      return o ? `${key.toUpperCase()}. ${strip(o.text)}` : key;
    };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }}>
          <Text style={st.title}>Review</Text>
          {review.map((it, n) => (
            <Card key={n} style={{ gap: 6, borderLeftWidth: 6, borderLeftColor: it.is_correct ? colors.green : colors.red }}>
              <Text style={st.q}>{n + 1}. {strip(it.question_text)}</Text>
              <Text style={{ color: it.is_correct ? colors.green : colors.red, fontWeight: "800" }}>Your answer: {label(it, it.your_answer)}</Text>
              {!it.is_correct ? <Text style={{ color: colors.text, fontWeight: "800" }}>Correct: {label(it, it.correct_answer)}</Text> : null}
            </Card>
          ))}
          <Button title="Done" onPress={() => router.replace("/exams")} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={st.bar}>
        <Text style={st.barText}>Question {i + 1}/{qs.length}</Text>
        <Text style={[st.barText, left != null && left < 60 && { color: "#FCA5A5" }]}>{left == null ? "" : `⏱ ${mmss(left)}`}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 12 }}>
          <Text style={st.q}>{strip(q.question_text)}</Text>
          <Muted>{q.points} mark{q.points === 1 ? "" : "s"}</Muted>
        </Card>
        {type === "mcq" && (q.options ?? []).map((raw) => {
          const o = ok(raw); const on = answers[q.id] === o.key;
          return (
            <Pressable key={o.key} onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))} style={[st.opt, on && st.optOn]}>
              <Text style={[st.optKey, on && { color: "#fff" }]}>{o.key.toUpperCase()}</Text>
              <Text style={[st.optText, on && { color: "#fff" }]}>{strip(o.text)}</Text>
            </Pressable>
          );
        })}
        {type === "true_false" && ["true", "false"].map((v) => {
          const on = answers[q.id]?.toLowerCase() === v;
          return (
            <Pressable key={v} onPress={() => setAnswers((a) => ({ ...a, [q.id]: v }))} style={[st.opt, on && st.optOn]}>
              <Text style={[st.optText, on && { color: "#fff" }]}>{v === "true" ? "True" : "False"}</Text>
            </Pressable>
          );
        })}
        {(type === "short_answer" || type === "long_answer") && (
          q.answer_type === "file"
            ? <Card><Muted>This question needs a file upload. Please answer it in the web portal.</Muted></Card>
            : <TextInput multiline value={answers[q.id] ?? ""} onChangeText={(t) => setAnswers((a) => ({ ...a, [q.id]: t }))} placeholder="Type your answer" placeholderTextColor="#9AA5A0" style={st.input} textAlignVertical="top" />
        )}
      </ScrollView>
      <View style={st.nav}>
        <View style={{ flex: 1 }}><Button title="Previous" color={colors.muted} disabled={i === 0} onPress={() => setI(i - 1)} /></View>
        <View style={{ flex: 1 }}>
          {i < qs.length - 1
            ? <Button title="Next" onPress={() => setI(i + 1)} />
            : <Button title="Submit" color={colors.green} loading={busy} onPress={() => Alert.alert("Submit exam?", `You answered ${answered} of ${qs.length} questions.`, [{ text: "Keep going", style: "cancel" }, { text: "Submit", onPress: () => submit() }])} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  bar: { backgroundColor: colors.brand, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 },
  barText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  q: { fontSize: 18, fontWeight: "700", color: colors.text, lineHeight: 26 },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 14 },
  optOn: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  optKey: { fontWeight: "900", color: colors.indigo, width: 22 },
  optText: { flex: 1, fontSize: 16, color: colors.text },
  input: { minHeight: 140, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, fontSize: 16, color: colors.text },
  nav: { flexDirection: "row", gap: 10, padding: 14, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border },
});
