import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorText } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { confirmAction } from "../../src/lib/confirm";
import { addDays, canApproveLeave, iso, LEAVE_LABEL, leaveApi, LeaveApp, LeaveType, spanDays } from "../../src/lib/leave";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

const TYPES = Object.keys(LEAVE_LABEL) as LeaveType[];
const tone = (s: LeaveApp["status"]) => (s === "approved" ? colors.green : s === "rejected" ? colors.red : colors.amber);
const STATUS_TEXT = { pending: "Waiting", approved: "Approved", rejected: "Declined" } as const;

export default function Leave() {
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const approver = canApproveLeave(me);
  const mine = useQuery({ queryKey: ["leave-mine"], queryFn: leaveApi.mine });
  const balances = useQuery({ queryKey: ["leave-balances"], queryFn: leaveApi.balances, retry: false });
  const pending = useQuery({ queryKey: ["leave-pending"], queryFn: leaveApi.pending, enabled: approver, retry: false });
  const [applying, setApplying] = useState(false);
  const refresh = () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("leave-") });

  if (mine.isLoading) return <Loading />;
  if (mine.isError) return <ErrorBox text={errorText(mine.error, "Couldn't load your leave.")} onRetry={() => mine.refetch()} />;
  const toDecide = (pending.data ?? []).filter((a) => a.user_id !== me?.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/")} hitSlop={12}><Text style={st.back}>‹ Home</Text></Pressable>
          <H1>Leave</H1>

          {(balances.data ?? []).length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {(balances.data ?? []).filter((b) => b.allocated > 0).map((b) => (
                <Card key={b.leave_type} style={st.bal}>
                  <Text style={st.balNum}>{b.remaining}</Text>
                  <Text style={st.balLabel}>{b.label} days left</Text>
                  <Muted>{b.used} of {b.allocated} used</Muted>
                </Card>
              ))}
            </ScrollView>
          ) : null}

          {applying ? <Apply onDone={() => { setApplying(false); refresh(); }} onCancel={() => setApplying(false)} />
            : <Button title="Apply for leave" onPress={() => setApplying(true)} />}

          {approver && toDecide.length ? (
            <>
              <Text style={st.sec}>Waiting for your decision ({toDecide.length})</Text>
              {toDecide.map((a) => <Decide key={a.id} a={a} onDone={refresh} />)}
            </>
          ) : null}

          <Text style={st.sec}>My requests</Text>
          {(mine.data ?? []).length === 0 ? <Empty title="No leave requests yet" /> : (mine.data ?? []).map((a) => (
            <Card key={a.id} style={{ gap: 4 }}>
              <View style={st.row}>
                <Text style={st.title} numberOfLines={1}>{LEAVE_LABEL[a.leave_type] ?? a.leave_type} · {a.days} {a.days === 1 ? "day" : "days"}</Text>
                <Pill text={STATUS_TEXT[a.status]} color={tone(a.status)} />
              </View>
              <Muted>{fmtDate(a.start_date)}{a.end_date !== a.start_date ? ` – ${fmtDate(a.end_date)}` : ""}</Muted>
              {a.reason ? <Text style={st.body}>{a.reason}</Text> : null}
              {a.decision_note ? <Text style={st.note}>{a.approver_name ? `${a.approver_name}: ` : ""}{a.decision_note}</Text> : null}
            </Card>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DateStep({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (v: string) => void }) {
  const back = addDays(value, -1);
  const canBack = !min || back >= min;
  return (
    <View style={{ gap: 4 }}>
      <Text style={st.label}>{label}</Text>
      <View style={st.step}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: day before`} disabled={!canBack} onPress={() => onChange(back)} style={[st.stepBtn, !canBack && { opacity: 0.35 }]}><Text style={st.stepArrow}>‹</Text></Pressable>
        <Text style={st.stepText} accessibilityLabel={`${label} ${fmtDate(value, { weekday: true })}`}>{fmtDate(value, { weekday: true })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: day after`} onPress={() => onChange(addDays(value, 1))} style={st.stepBtn}><Text style={st.stepArrow}>›</Text></Pressable>
      </View>
    </View>
  );
}

function Apply({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const today = iso(new Date());
  const [type, setType] = useState<LeaveType>("annual");
  const [start, setStart] = useState(addDays(today, 1));
  const [end, setEnd] = useState(addDays(today, 1));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const days = spanDays(start, end);

  const pickStart = (v: string) => { setStart(v); if (end < v) setEnd(v); };

  const send = async () => {
    setError("");
    if (end < start) { setError("The last day can't be before the first day."); return; }
    setBusy(true);
    try {
      await leaveApi.apply({ leave_type: type, start_date: start, end_date: end, reason: reason.trim() || undefined });
      onDone();
    } catch (e) { setError(errorText(e, "Couldn't send your request.")); }
    setBusy(false);
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={st.title}>Apply for leave</Text>
      <Text style={st.label}>Type</Text>
      <View style={st.wrap}>
        {TYPES.map((t) => (
          <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: type === t }} onPress={() => setType(t)} style={[st.chip, type === t && st.chipOn]}>
            <Text style={[st.chipText, type === t && { color: "#fff" }]}>{LEAVE_LABEL[t]}</Text>
          </Pressable>
        ))}
      </View>
      <DateStep label="First day" value={start} onChange={pickStart} />
      <DateStep label="Last day" value={end} min={start} onChange={setEnd} />
      <Text style={st.days}>{days} {days === 1 ? "day" : "days"}</Text>
      <Text style={st.label}>Reason (optional)</Text>
      <TextInput accessibilityLabel="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Family wedding in Enugu" placeholderTextColor="#9AA5A0" multiline style={st.input} />
      {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
      <Button title="Send request" loading={busy} onPress={send} />
      <Button title="Cancel" color={colors.muted} onPress={onCancel} />
    </Card>
  );
}

function Decide({ a, onDone }: { a: LeaveApp; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const act = async (kind: "approve" | "reject") => {
    if (kind === "reject" && !(await confirmAction("Decline this leave?", `${a.applicant_name || "They"} will be told it was declined.`, "Decline", true))) return;
    setBusy(kind); setError("");
    try { await (kind === "approve" ? leaveApi.approve(a.id, note) : leaveApi.reject(a.id, note)); onDone(); }
    catch (e) { setError(errorText(e, "Couldn't save the decision.")); }
    setBusy(null);
  };
  return (
    <Card style={{ gap: 6, borderColor: colors.amber, borderWidth: 2 }}>
      <Text style={st.title} numberOfLines={1}>{a.applicant_name || "Staff member"}</Text>
      <Muted>{LEAVE_LABEL[a.leave_type]} · {a.days} {a.days === 1 ? "day" : "days"} · {fmtDate(a.start_date)}{a.end_date !== a.start_date ? ` – ${fmtDate(a.end_date)}` : ""}</Muted>
      {a.reason ? <Text style={st.body}>{a.reason}</Text> : null}
      <TextInput accessibilityLabel={`Note for ${a.applicant_name || "applicant"}`} value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor="#9AA5A0" style={[st.input, { minHeight: 44 }]} />
      {error ? <Text style={st.error}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Approve" color={colors.green} loading={busy === "approve"} disabled={!!busy} onPress={() => act("approve")} /></View>
        <View style={{ flex: 1 }}><Button title="Decline" color={colors.red} loading={busy === "reject"} disabled={!!busy} onPress={() => act("reject")} /></View>
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  pad: { padding: 18, gap: 12, paddingBottom: 48 },
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  sec: { fontSize: 18, fontWeight: "900", color: colors.text, marginTop: 6 },
  bal: { minWidth: 130, gap: 2 },
  balNum: { fontSize: 26, fontWeight: "900", color: colors.brand },
  balLabel: { fontWeight: "800", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontWeight: "900", fontSize: 16.5, color: colors.text, flexShrink: 1 },
  body: { color: colors.text, fontSize: 15 },
  note: { color: colors.muted, fontStyle: "italic" },
  label: { fontWeight: "800", color: colors.text },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: "800", color: colors.text },
  step: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  stepArrow: { fontSize: 26, fontWeight: "700", color: colors.brand, marginTop: -2 },
  stepText: { flex: 1, textAlign: "center", fontWeight: "800", fontSize: 16, color: colors.text },
  days: { fontWeight: "900", color: colors.brand },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15.5, color: colors.text, backgroundColor: "#FBFAF5", minHeight: 64, textAlignVertical: "top" },
  error: { color: colors.red, fontWeight: "700" },
});
