import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorText } from "../../../src/lib/api";
import { useAuth } from "../../../src/lib/auth";
import { makeStartingPassword, passwordProblems } from "../../../src/lib/password";
import { AppUser, canManageUsers, isTeachingRole, tidy, usersApi } from "../../../src/lib/users";
import { CheckList, toggleIn } from "../../../src/components/CheckList";
import { Field } from "../../../src/components/Field";
import { Button, Card, Empty, Loading, Muted } from "../../../src/components/ui";
import { colors } from "../../../src/lib/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewUser() {
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const allowed = canManageUsers(me);
  const roles = useQuery({ queryKey: ["roles-available"], queryFn: usersApi.roles, enabled: allowed, staleTime: 5 * 60_000 });
  const sections = useQuery({ queryKey: ["sections"], queryFn: usersApi.sections, enabled: allowed, staleTime: 5 * 60_000 });

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", job_title: "" });
  const [password, setPassword] = useState(() => makeStartingPassword());
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ user: AppUser; password: string } | null>(null);

  if (!allowed) return <Empty title="Only school admins can add users." />;
  if (roles.isLoading) return <Loading />;

  const roleList = roles.data ?? [];
  const needsSection = roleList.some((r) => roleIds.includes(r.id) && isTeachingRole(r.slug));
  const pwProblems = password ? passwordProblems(password) : [];

  const create = async () => {
    setError("");
    if (!form.full_name.trim()) { setError("Enter the person's full name."); return; }
    if (!EMAIL.test(form.email.trim())) { setError("Enter a valid email address."); return; }
    if (roleIds.length === 0) { setError("Choose at least one role."); return; }
    if (needsSection && sectionIds.length === 0) { setError("Choose at least one section for a teacher."); return; }
    if (password && pwProblems.length) { setError(`The starting password needs ${pwProblems.join(", ")}.`); return; }
    setBusy(true);
    try {
      const user = await usersApi.create({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        job_title: form.job_title.trim() || undefined,
        password: password || undefined,
        role_ids: roleIds,
        section_ids: needsSection ? sectionIds : [],
      });
      qc.invalidateQueries({ queryKey: ["users"] });
      setCreated({ user, password });
    } catch (e) {
      setError(tidy(errorText(e, "Couldn't create this account.")));
    }
    setBusy(false);
  };

  if (created) {
    const { user, password: pw } = created;
    const share = () => Share.share({ message: `Your Fairview Portal account is ready.\nEmail: ${user.email}${pw ? `\nPassword: ${pw}\nPlease change it after you sign in (Account → Change password).` : "\nCheck your email to set your password."}` }).catch(() => {});
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <Text style={{ fontSize: 48, textAlign: "center" }}>✅</Text>
          <Text style={st.title}>{user.full_name} has been added</Text>
          <Card style={{ gap: 6 }}>
            <Muted>Email</Muted>
            <Text selectable style={st.value}>{user.email}</Text>
            {pw ? (<><Muted>Starting password</Muted><Text selectable style={[st.value, st.mono]}>{pw}</Text></>) : <Muted>They’ll get an email to set their own password.</Muted>}
          </Card>
          {pw ? <Button title="Share sign-in details" onPress={share} /> : null}
          <Button title="Open their account" color={colors.brandSoft} onPress={() => router.replace(`/users/${user.id}`)} />
          <Button title="Add another" color={colors.muted} onPress={() => { setCreated(null); setForm({ full_name: "", email: "", phone: "", job_title: "" }); setRoleIds([]); setSectionIds([]); setPassword(makeStartingPassword()); }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={() => router.replace("/users")} hitSlop={12}><Text style={st.back}>‹ Users</Text></Pressable>
          <Text style={st.title}>Add a user</Text>

          <Card style={{ gap: 10 }}>
            <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} placeholder="e.g. Ada Okafor" />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} keyboard="email-address" placeholder="name@example.com" />
            <Field label="Phone (optional)" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} keyboard="phone-pad" />
            <Field label="Job title (optional)" value={form.job_title} onChange={(v) => setForm({ ...form, job_title: v })} />
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={st.section}>Starting password</Text>
            <Field label="Password" value={password} onChange={setPassword}
              hint={password ? (pwProblems.length ? `Needs ${pwProblems.join(", ")}.` : "You'll see it again after saving so you can share it.") : "Left empty: they'll get an email to set their own password."} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Button title="New password" color={colors.brandSoft} onPress={() => setPassword(makeStartingPassword())} /></View>
              <View style={{ flex: 1 }}><Button title="Email invite" color={colors.muted} onPress={() => setPassword("")} /></View>
            </View>
          </Card>

          <Card style={{ gap: 10 }}>
            <Text style={st.section}>Role</Text>
            {roles.isError ? <Muted>Couldn’t load the list of roles.</Muted> : (
              <CheckList items={roleList.map((r) => ({ id: r.id, label: r.name }))} selected={roleIds} onToggle={(id) => setRoleIds((l) => toggleIn(l, id))} disabled={busy} />
            )}
          </Card>

          {needsSection ? (
            <Card style={{ gap: 10 }}>
              <Text style={st.section}>Section</Text>
              <Muted>Teachers must belong to at least one section.</Muted>
              {(sections.data ?? []).length === 0
                ? <Muted>No sections set up yet. Add them in the web portal under School Setup.</Muted>
                : <CheckList items={(sections.data ?? []).map((s) => ({ id: s.id, label: s.name }))} selected={sectionIds} onToggle={(id) => setSectionIds((l) => toggleIn(l, id))} disabled={busy} />}
            </Card>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
          <Button title="Create account" onPress={create} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  section: { fontWeight: "900", fontSize: 17, color: colors.text },
  value: { fontSize: 17, fontWeight: "800", color: colors.text },
  mono: { fontSize: 22, letterSpacing: 1, color: colors.brand, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) },
  error: { color: colors.red, fontWeight: "700" },
});
