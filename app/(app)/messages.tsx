import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { useRole } from "../../src/lib/role";
import { CATEGORIES, categoryLabel, Entry, isStaffMessenger, needsMe, parentMsgs, staffMsgs } from "../../src/lib/messages";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

interface Pupil { id: string; name: string }

export default function Messages() {
  const { role, ctx } = useRole();
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const asParent = role === "parent";
  const allowed = asParent || isStaffMessenger(me);
  const [filter, setFilter] = useState<"todo" | "all">("all");
  const [composing, setComposing] = useState(false);

  const q = useQuery({
    queryKey: ["messages", asParent ? "parent" : "staff"],
    enabled: allowed,
    retry: false,
    queryFn: () => (asParent ? parentMsgs.list() : staffMsgs.list()),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["messages"] });

  if (!allowed) return <Empty title="Messages are for parents and teachers." />;

  const items = q.data ?? [];
  const todo = items.filter((e) => needsMe(e, asParent));
  const shown = filter === "todo" ? todo : items;
  const kids: Pupil[] = (ctx?.as_parent?.children ?? []).map((k) => ({ id: k.id, name: `${k.first_name} ${k.last_name}` }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={st.pad} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} />}>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/")} hitSlop={12}><Text style={st.back}>‹ Home</Text></Pressable>
          <H1>Messages</H1>
          <Muted>{asParent ? "Notes between you and your child's teachers." : "Notes between the school and parents."}</Muted>

          {q.isLoading ? <Loading /> : q.isError ? <ErrorBox text={errorText(q.error, "Couldn't load messages.")} onRetry={() => q.refetch()} /> : (
            <>
              {composing
                ? <Compose asParent={asParent} kids={kids} onDone={() => { setComposing(false); refresh(); }} onCancel={() => setComposing(false)} />
                : <Button title={asParent ? "Write to the school" : "Write to a parent"} onPress={() => setComposing(true)} />}

              <View style={st.tabs}>
                {(["all", "todo"] as const).map((k) => (
                  <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: filter === k }} onPress={() => setFilter(k)} style={[st.tab, filter === k && st.tabOn]}>
                    <Text style={[st.tabText, filter === k && { color: "#fff" }]}>{k === "all" ? `All (${items.length})` : `${asParent ? "Unread" : "Needs reply"} (${todo.length})`}</Text>
                  </Pressable>
                ))}
              </View>

              {shown.length === 0
                ? <Empty title={filter === "todo" ? "You're all caught up" : "No messages yet"} />
                : shown.map((e) => <Thread key={e.id} e={e} asParent={asParent} onChanged={refresh} />)}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Thread({ e, asParent, onChanged }: { e: Entry; asParent: boolean; onChanged: () => void }) {
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fromSchool = e.direction === "school_to_home";
  const waiting = needsMe(e, asParent);

  const send = async (withReply: boolean) => {
    if (withReply && !reply.trim()) { setError("Write your reply first."); return; }
    if (!asParent && !reply.trim()) { setError("Write your reply first."); return; }
    setBusy(true); setError("");
    try {
      if (asParent) await parentMsgs.ack(e.id, withReply ? reply.trim() : "");
      else await staffMsgs.reply(e.id, reply.trim());
      setReply(""); setOpen(false); onChanged();
    } catch (err) { setError(errorText(err, "Couldn't send.")); }
    setBusy(false);
  };

  return (
    <Card style={[{ gap: 8 }, waiting && { borderColor: colors.amber, borderWidth: 2 }]}>
      <View style={st.metaRow}>
        <Text style={st.who} numberOfLines={1}>{e.student_id_name || "Pupil"}</Text>
        <Text style={st.cat}>{categoryLabel(e.category)}</Text>
      </View>
      <Muted>{fromSchool ? `From school${e.author ? ` · ${e.author}` : ""}` : `From ${e.author || "parent"}`} · {fmtDate(e.created_at || e.entry_date, { time: !!e.created_at })}</Muted>
      <Text style={st.body}>{e.message}</Text>
      {e.reply ? (
        <View style={st.reply}>
          <Text style={st.replyLabel}>{fromSchool ? "Parent replied" : "School replied"}</Text>
          <Text style={st.body}>{e.reply}</Text>
        </View>
      ) : null}
      {e.acknowledged && !e.reply ? <Text style={st.seen}>✓ Seen</Text> : null}

      {waiting ? (
        open ? (
          <View style={{ gap: 8 }}>
            <TextInput accessibilityLabel="Your reply" value={reply} onChangeText={setReply} placeholder="Write a reply" placeholderTextColor="#9AA5A0" multiline style={st.input} />
            {error ? <Text style={st.error}>{error}</Text> : null}
            <Button title="Send reply" loading={busy} onPress={() => send(true)} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button title="Reply" color={colors.brandSoft} onPress={() => setOpen(true)} /></View>
            {asParent ? <View style={{ flex: 1 }}><Button title="Mark as read" color={colors.muted} loading={busy} onPress={() => send(false)} /></View> : null}
          </View>
        )
      ) : null}
    </Card>
  );
}

function Compose({ asParent, kids, onDone, onCancel }: { asParent: boolean; kids: Pupil[]; onDone: () => void; onCancel: () => void }) {
  const [classId, setClassId] = useState("");
  const [pupil, setPupil] = useState(kids.length === 1 ? kids[0].id : "");
  const [category, setCategory] = useState("general");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const classes = useQuery<{ items: { id: string; name: string }[] }>({ queryKey: ["staff-classes"], enabled: !asParent, queryFn: () => api.get("/school/classes", { params: { page_size: 200 } }).then((r) => r.data) });
  const roster = useQuery<{ items: { id: string; first_name: string; last_name: string }[] }>({
    queryKey: ["roster", classId], enabled: !asParent && !!classId,
    queryFn: () => api.get("/school/students", { params: { class_id: classId, page_size: 200, status: "active" } }).then((r) => r.data),
  });
  const pupils: Pupil[] = useMemo(() => asParent ? kids : (roster.data?.items ?? []).map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` })), [asParent, kids, roster.data]);

  const send = async () => {
    if (!pupil) { setError(asParent ? "Choose which child this is about." : "Choose a pupil."); return; }
    if (!text.trim()) { setError("Write your message first."); return; }
    setBusy(true); setError("");
    try {
      await (asParent ? parentMsgs : staffMsgs).send(pupil, text.trim(), category);
      setSent(true);
      setTimeout(onDone, 700);
    } catch (e) { setError(errorText(e, "Couldn't send your message.")); }
    setBusy(false);
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={st.who}>{asParent ? "Write to the school" : "Write to a parent"}</Text>
      {!asParent ? (
        <>
          <Text style={st.label}>Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(classes.data?.items ?? []).map((c) => (
              <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: classId === c.id }} onPress={() => { setClassId(c.id); setPupil(""); }} style={[st.chip, classId === c.id && st.chipOn]}>
                <Text style={[st.chipText, classId === c.id && { color: "#fff" }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
      {pupils.length > 0 ? (
        <>
          <Text style={st.label}>{asParent ? "About" : "Pupil"}</Text>
          <View style={st.wrap}>
            {pupils.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.name} accessibilityState={{ selected: pupil === p.id }} onPress={() => setPupil(p.id)} style={[st.chip, pupil === p.id && st.chipOn]}>
                <Text style={[st.chipText, pupil === p.id && { color: "#fff" }]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : !asParent && classId && !roster.isLoading ? <Muted>No pupils in this class.</Muted> : null}
      <Text style={st.label}>Topic</Text>
      <View style={st.wrap}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.key} accessibilityRole="button" accessibilityState={{ selected: category === c.key }} onPress={() => setCategory(c.key)} style={[st.chipSm, category === c.key && st.chipOn]}>
            <Text style={[st.chipText, category === c.key && { color: "#fff" }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput accessibilityLabel="Message" value={text} onChangeText={setText} placeholder="Your message" placeholderTextColor="#9AA5A0" multiline style={[st.input, { minHeight: 100 }]} />
      {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
      {sent ? <Text style={st.ok}>Sent ✓</Text> : null}
      <Button title="Send" loading={busy} onPress={send} />
      <Button title="Cancel" color={colors.muted} onPress={onCancel} />
    </Card>
  );
}

const st = StyleSheet.create({
  pad: { padding: 18, gap: 12, paddingBottom: 48 },
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff" },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontWeight: "800", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  who: { fontWeight: "900", fontSize: 16.5, color: colors.text, flexShrink: 1 },
  cat: { fontWeight: "800", color: colors.indigo, fontSize: 13 },
  body: { color: colors.text, fontSize: 15.5, lineHeight: 22 },
  reply: { backgroundColor: "#F2F7F4", borderRadius: 12, padding: 10, gap: 2 },
  replyLabel: { fontWeight: "800", color: colors.brand, fontSize: 12.5 },
  seen: { color: colors.green, fontWeight: "800" },
  label: { fontWeight: "800", color: colors.text },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8 },
  chipSm: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: "800", color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15.5, color: colors.text, backgroundColor: "#FBFAF5", minHeight: 64, textAlignVertical: "top" },
  error: { color: colors.red, fontWeight: "700" },
  ok: { color: colors.green, fontWeight: "800" },
});
