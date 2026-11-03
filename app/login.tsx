import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/lib/auth";
import { errorText } from "../src/lib/api";
import { Button } from "../src/components/ui";
import { colors } from "../src/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true); setError("");
    try { await signIn(email, password); } catch (e) { setError(errorText(e, "Wrong email or password.")); }
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.brand }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
          <View style={st.logo}><Text style={{ fontSize: 40 }}>🎓</Text></View>
          <Text style={st.title}>Fairview Portal</Text>
          <Text style={st.sub}>Sign in to continue</Text>
          <View style={st.card}>
            <Text style={st.label}>Email</Text>
            <TextInput style={st.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#9AA5A0" />
            <Text style={st.label}>Password</Text>
            <TextInput style={st.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Your password" placeholderTextColor="#9AA5A0" onSubmitEditing={submit} />
            {error ? <Text style={st.error}>{error}</Text> : null}
            <Button title="Sign in" onPress={submit} loading={busy} />
          </View>
          <Text style={st.foot}>Forgot your password? Contact the school office.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 8 },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 8 },
  title: { color: "#fff", fontSize: 30, fontWeight: "900", textAlign: "center" },
  sub: { color: "#CFE6DA", fontSize: 16, textAlign: "center", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 22, padding: 20, gap: 8 },
  label: { fontWeight: "800", color: colors.text, marginTop: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text, backgroundColor: "#FBFAF5" },
  error: { color: colors.red, fontWeight: "700", marginVertical: 6 },
  foot: { color: "#CFE6DA", textAlign: "center", marginTop: 16 },
});
