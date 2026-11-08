import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorText } from "../../../src/lib/api";
import { useAuth } from "../../../src/lib/auth";
import { confirmAction } from "../../../src/lib/confirm";
import {
  canDeleteUsers, canManageUsers, isTeachingRole, STATUS_LABEL, statusColor, tidy, UserStatus, usersApi,
} from "../../../src/lib/users";
import { CheckList, toggleIn } from "../../../src/components/CheckList";
import { Field } from "../../../src/components/Field";
import { Avatar, Button, Card, Empty, ErrorBox, Loading, Muted, Pill } from "../../../src/components/ui";
import { colors, fmtDate } from "../../../src/lib/theme";

export default function UserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const allowed = canManageUsers(me);

  const user = useQuery({ queryKey: ["user", id], queryFn: () => usersApi.get(id), enabled: allowed && !!id });
  const roles = useQuery({ queryKey: ["roles-available"], queryFn: usersApi.roles, enabled: allowed, staleTime: 5 * 60_000 });
  const sections = useQuery({ queryKey: ["sections"], queryFn: usersApi.sections, enabled: allowed, staleTime: 5 * 60_000 });
  const hadTeaching = useMemo(() => (user.data?.roles ?? []).some((r) => isTeachingRole(r.slug)), [user.data]);
  const mySections = useQuery({ queryKey: ["user-sections", id], queryFn: () => usersApi.sectionsOf(id), enabled: allowed && !!id && hadTeaching });

  const [form, setForm] = useState({ full_name: "", phone: "", department: "", job_title: "" });
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [temp, setTemp] = useState<{ password: string; forced: boolean } | null>(null);

  // load the record into the form once it arrives (and again after a save refetch)
  useEffect(() => {
    const u = user.data;
    if (!u) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ full_name: u.full_name || "", phone: u.phone || "", department: u.department || "", job_title: u.job_title || "" });
    setRoleIds((u.roles ?? []).map((r) => r.id));
  }, [user.data]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mySections.data) setSectionIds(mySections.data);
  }, [mySections.data]);

  if (!allowed) return <Empty title="Only school admins can manage users." />;
  if (user.isLoading || roles.isLoading) return <Loading />;
  if (user.isError || !user.data) return <ErrorBox text={errorText(user.error, "Couldn't open this user.")} onRetry={() => user.refetch()} />;

  const u = user.data;
  const isSelf = u.id === me?.id;
  const roleList = roles.data ?? [];
  const needsSection = roleList.some((r) => roleIds.includes(r.id) && isTeachingRole(r.slug));
  const originalRoles = (u.roles ?? []).map((r) => r.id).sort().join();
  const rolesChanged = roleIds.slice().sort().join() !== originalRoles;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["user", id] });
    qc.invalidateQueries({ queryKey: ["user-sections", id] });
  };

  const save = async () => {
    setError(""); setSaved(false);
    if (!form.full_name.trim()) { setError("Enter the person's full name."); return; }
    if (roleIds.length === 0) { setError("Choose at least one role."); return; }
    if (needsSection && sectionIds.length === 0) { setError("Choose at least one section for a teacher."); return; }
    setBusy("save");
    try {
      await usersApi.update(u.id, {
        full_name: form.full_name.trim(), phone: form.phone.trim() || null,
        department: form.department.trim() || null, job_title: form.job_title.trim() || null,
      });
      // the server refuses a teaching role until a section is on file, so sections go first
      if (needsSection) await usersApi.setSections(u.id, sectionIds);
      if (rolesChanged) await usersApi.setRoles(u.id, roleIds);
      setSaved(true);
      refresh();
    } catch (e) {
      setError(tidy(errorText(e, "Couldn't save the changes.")));
    }
    setBusy(null);
  };

  const changeStatus = async (status: UserStatus, verb: string) => {
    const ok = await confirmAction(`${verb} ${u.full_name}?`,
      status === "active" ? "They'll be able to sign in again." : "They won't be able to sign in until you activate them again.", verb, status !== "active");
    if (!ok) return;
    setBusy(status); setError("");
    try { await usersApi.setStatus(u.id, status); refresh(); }
    catch (e) { setError(tidy(errorText(e, "Couldn't change their status."))); }
    setBusy(null);
  };

  const reset = async () => {
    const ok = await confirmAction(`Reset ${u.full_name}'s password?`, "You'll get a one-time password to give them. Their old password stops working.", "Reset");
    if (!ok) return;
    setBusy("reset"); setError("");
    try { const r = await usersApi.resetPassword(u.id); setTemp({ password: r.temporary_password, forced: r.force_password_change }); }
    catch (e) { setError(tidy(errorText(e, "Couldn't reset the password."))); }
    setBusy(null);
  };

  const remove = async () => {
    const ok = await confirmAction(`Remove ${u.full_name}?`, "Their account is switched off and hidden. It can be restored from the web portal.", "Remove", true);
    if (!ok) return;
    setBusy("delete"); setError("");
    try { await usersApi.remove(u.id); qc.invalidateQueries({ queryKey: ["users"] }); router.replace("/users"); }
    catch (e) { setError(tidy(errorText(e, "Couldn't remove this user."))); setBusy(null); }
  };

  const sharePassword = () => {
    if (!temp) return;
    Share.share({ message: `Your Fairview Portal sign-in\nEmail: ${u.email}\nOne-time password: ${temp.password}${temp.forced ? "\nYou'll be asked to choose your own password when you sign in." : ""}` }).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={() => router.replace("/users")} hitSlop={12}><Text style={st.back}>‹ Users</Text></Pressable>

          <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar name={u.full_name || u.email} size={56} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={st.name} numberOfLines={2}>{u.full_name}</Text>
              <Text style={st.email} numberOfLines={1}>{u.email}</Text>
              <Pill text={STATUS_LABEL[u.status] ?? u.status} color={statusColor(u.status)} />
            </View>
          </Card>
          <Muted>{u.last_login_at ? `Last signed in ${fmtDate(u.last_login_at, { time: true })}` : "Hasn't signed in yet"}</Muted>

          {temp ? (
            <Card style={{ gap: 8, backgroundColor: "#EEF6F1", borderColor: colors.brand }}>
              <Text style={st.section}>One-time password</Text>
              <Text selectable style={st.temp}>{temp.password}</Text>
              <Muted>Give this to {u.full_name.split(" ")[0]} privately. {temp.forced ? "They'll choose their own password when they sign in." : ""} It won’t be shown again.</Muted>
              <Button title="Share with them" onPress={sharePassword} />
              <Button title="Done" color={colors.muted} onPress={() => setTemp(null)} />
            </Card>
          ) : null}

          <Card style={{ gap: 8 }}>
            <Text style={st.section}>Details</Text>
            <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} keyboard="phone-pad" />
            <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
            <Field label="Job title" value={form.job_title} onChange={(v) => setForm({ ...form, job_title: v })} />
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={st.section}>Roles</Text>
            {roles.isError ? <Muted>Couldn’t load the list of roles.</Muted> : (
              <CheckList items={roleList.map((r) => ({ id: r.id, label: r.name }))} selected={roleIds} onToggle={(rid) => setRoleIds((l) => toggleIn(l, rid))} disabled={!!busy} />
            )}
          </Card>

          {needsSection ? (
            <Card style={{ gap: 10 }}>
              <Text style={st.section}>Section</Text>
              <Muted>Teachers must belong to at least one section.</Muted>
              {(sections.data ?? []).length === 0
                ? <Muted>No sections set up yet. Add them in the web portal under School Setup.</Muted>
                : <CheckList items={(sections.data ?? []).map((s) => ({ id: s.id, label: s.name }))} selected={sectionIds} onToggle={(sid) => setSectionIds((l) => toggleIn(l, sid))} disabled={!!busy} />}
            </Card>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
          {saved ? <Text style={st.ok}>Saved ✓</Text> : null}
          <Button title="Save changes" onPress={save} loading={busy === "save"} disabled={!!busy && busy !== "save"} />

          {!isSelf ? (
            <Card style={{ gap: 10 }}>
              <Text style={st.section}>Account</Text>
              {u.status === "active"
                ? <Button title="Suspend" color={colors.amber} loading={busy === "suspended"} disabled={!!busy} onPress={() => changeStatus("suspended", "Suspend")} />
                : <Button title="Activate" color={colors.green} loading={busy === "active"} disabled={!!busy} onPress={() => changeStatus("active", "Activate")} />}
              <Button title="Reset password" color={colors.indigo} loading={busy === "reset"} disabled={!!busy} onPress={reset} />
              {canDeleteUsers(me) ? <Button title="Remove user" color={colors.red} loading={busy === "delete"} disabled={!!busy} onPress={remove} /> : null}
            </Card>
          ) : <Muted>This is your own account. Change your password from Account.</Muted>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  name: { fontWeight: "900", fontSize: 20, color: colors.text },
  email: { color: colors.muted, fontSize: 14 },
  section: { fontWeight: "900", fontSize: 17, color: colors.text },
  temp: { fontSize: 24, fontWeight: "900", letterSpacing: 1, color: colors.brand, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  error: { color: colors.red, fontWeight: "700" },
  ok: { color: colors.green, fontWeight: "800" },
});
