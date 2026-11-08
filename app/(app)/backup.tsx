import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { backupFileName, canBackup, saveBackup } from "../../src/lib/backup";
import { Field } from "../../src/components/Field";
import { Button, Card, Empty, Muted } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

interface AuditRow { id: string; action: string; resource_type?: string | null; actor_email?: string | null; created_at: string | null }

export default function Backup() {
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const allowed = canBackup(me);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  // Past backups come from the audit trail (each download is logged as a data export).
  const history = useQuery({
    queryKey: ["backup-history"],
    enabled: allowed,
    retry: false,
    queryFn: () => api.get<AuditRow[]>("/analytics/audit-log", { params: { action: "data.exported", limit: 20 } })
      .then((r) => (r.data ?? []).filter((x) => x.resource_type === "database").slice(0, 5)),
  });

  if (!allowed) return <Empty title="Only the Director account can download a backup." />;

  const run = async () => {
    setError(""); setDone(null);
    if (!password) { setError("Enter your password to confirm it's you."); return; }
    setBusy(true);
    try {
      const name = backupFileName();
      const r = await api.post("/admin/backup/download", { password }, {
        responseType: Platform.OS === "web" ? "blob" : "arraybuffer",
        timeout: 5 * 60_000, // a whole school's records can take a while
      });
      await saveBackup(r.data, name);
      setPassword("");
      setDone(name);
      qc.invalidateQueries({ queryKey: ["backup-history"] });
    } catch (e: any) {
      // a blob/arraybuffer error body has to be read before we can show its message
      let msg = errorText(e, "The backup couldn't be made. Please try again.");
      const raw = e?.response?.data;
      try {
        const text = raw instanceof ArrayBuffer ? new TextDecoder().decode(raw) : typeof raw?.text === "function" ? await raw.text() : null;
        const d = text ? JSON.parse(text)?.detail : null;
        if (typeof d === "string") msg = d;
      } catch {}
      setError(msg);
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={() => router.replace("/account")} hitSlop={12}><Text style={st.back}>‹ Account</Text></Pressable>
          <Text style={st.title}>Backup</Text>
          <Card style={{ gap: 8 }}>
            <Text style={st.section}>Download a full backup</Text>
            <Muted>One file with every student, staff, result and payment record. Keep it somewhere safe and private, like your own Google Drive or a USB stick, never in a shared chat.</Muted>
          </Card>
          <Card style={{ gap: 10 }}>
            <Field label="Your password" value={password} onChange={setPassword} secure placeholder="Confirm it's you" />
            {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
            {done ? <Text style={st.ok}>Backup ready ✓ {Platform.OS === "web" ? `Saved as ${done}` : "Choose where to save it."}</Text> : null}
            <Button title={busy ? "Making backup…" : "Make backup"} onPress={run} loading={busy} />
            {busy ? <Muted>This can take a minute. Keep the app open.</Muted> : null}
          </Card>
          <Card style={{ gap: 8 }}>
            <Text style={st.section}>Recent backups</Text>
            {history.isLoading ? <Muted>Loading…</Muted>
              : history.isError ? <Muted>Couldn’t load the history.</Muted>
              : (history.data ?? []).length === 0 ? <Muted>No backups downloaded yet.</Muted>
              : (history.data ?? []).map((h) => (
                <View key={h.id} style={{ gap: 1 }}>
                  <Text style={st.row}>{h.created_at ? fmtDate(h.created_at, { time: true }) : "—"}</Text>
                  {h.actor_email ? <Text style={st.by} numberOfLines={1}>by {h.actor_email}</Text> : null}
                </View>
              ))}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  section: { fontWeight: "900", fontSize: 17, color: colors.text },
  row: { color: colors.text, fontSize: 15, fontWeight: "700" },
  by: { color: colors.muted, fontSize: 13 },
  error: { color: colors.red, fontWeight: "700" },
  ok: { color: colors.green, fontWeight: "800" },
});
