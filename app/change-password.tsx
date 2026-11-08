import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api, errorText } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { passwordProblems } from "../src/lib/password";
import { Button, Card, Muted } from "../src/components/ui";
import { colors } from "../src/lib/theme";

export default function ChangePassword() {
  const { me, refreshMe, signOut } = useAuth();
  const router = useRouter();
  const forced = !!me?.force_password_change;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const problems = next ? passwordProblems(next) : [];

  const save = async () => {
    setError("");
    if (!current || !next) { setError("Fill in both your current and new password."); return; }
    if (problems.length) { setError(`Your new password needs ${problems.join(", ")}.`); return; }
    if (next !== again) { setError("The two new passwords don't match."); return; }
    if (next === current) { setError("Choose a password that's different from the current one."); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      setDone(true);
      setCurrent(""); setNext(""); setAgain("");
      await refreshMe().catch(() => {});
      if (!forced) setTimeout(() => router.back(), 900);
    } catch (e) {
      setError(errorText(e, "Couldn't change your password. Please try again."));
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={st.title}>{forced ? "Choose a new password" : "Change password"}</Text>
          {forced ? (
            <Card style={{ backgroundColor: "#FFF7E6", borderColor: "#F2D49B" }}>
              <Text style={{ color: "#7A5300", fontWeight: "700" }}>Your password was reset by the school. Choose your own password to carry on.</Text>
            </Card>
          ) : null}
          <Card style={{ gap: 8 }}>
            <Text style={st.label}>{forced ? "Password the school gave you" : "Current password"}</Text>
            <TextInput accessibilityLabel="Current password" style={st.input} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" placeholder="Current password" placeholderTextColor="#9AA5A0" />
            <Text style={st.label}>New password</Text>
            <TextInput accessibilityLabel="New password" style={st.input} value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" placeholder="New password" placeholderTextColor="#9AA5A0" />
            <Muted>{problems.length ? `Needs ${problems.join(", ")}.` : next ? "Looks good." : "At least 8 characters, with a capital letter and a number."}</Muted>
            <Text style={st.label}>New password again</Text>
            <TextInput accessibilityLabel="Confirm new password" style={st.input} value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" placeholder="Type it again" placeholderTextColor="#9AA5A0" onSubmitEditing={save} />
            {error ? <Text style={st.error}>{error}</Text> : null}
            {done ? <Text style={st.ok}>Password changed ✓</Text> : null}
            <Button title="Save new password" onPress={save} loading={busy} />
          </Card>
          {forced
            ? <Button title="Sign out" color={colors.muted} onPress={signOut} />
            : <Button title="Back" color={colors.muted} onPress={() => router.back()} />}
          <View />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  label: { fontWeight: "800", color: colors.text, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text, backgroundColor: "#FBFAF5" },
  error: { color: colors.red, fontWeight: "700" },
  ok: { color: colors.green, fontWeight: "800" },
});
