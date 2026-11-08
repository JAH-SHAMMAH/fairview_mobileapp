import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { notify } from "../../src/lib/confirm";
import { uploadAvatar } from "../../src/lib/upload";
import { Field } from "../../src/components/Field";
import { Avatar, Button, Card, ErrorBox, Loading, Muted } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

interface Profile { id: string; email: string; full_name: string; phone: string | null; bio: string | null; avatar_url: string | null }

export default function MyProfile() {
  const { me, refreshMe } = useAuth();
  const router = useRouter();
  const q = useQuery<Profile>({ queryKey: ["my-profile"], queryFn: () => api.get("/me/profile").then((r) => r.data) });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<"save" | "photo" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(q.data.full_name || ""); setPhone(q.data.phone || ""); setPhoto(q.data.avatar_url);
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorBox text={errorText(q.error, "Couldn't load your profile.")} onRetry={() => q.refetch()} />;

  const save = async () => {
    setError(""); setSaved(false);
    if (!name.trim()) { setError("Enter your name."); return; }
    setBusy("save");
    try {
      await api.patch("/me/profile", { full_name: name.trim(), phone: phone.trim() || null });
      setSaved(true);
      await Promise.all([q.refetch(), refreshMe().catch(() => {})]);
    } catch (e) { setError(errorText(e, "Couldn't save your details.")); }
    setBusy(null);
  };

  const changePhoto = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { notify("Permission needed", camera ? "Allow camera access in your phone's settings." : "Allow photo access in your phone's settings."); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, allowsEditing: true, aspect: [1, 1] };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const a = r.canceled ? null : r.assets?.[0];
    if (!a) return;
    setBusy("photo"); setError("");
    try {
      const { url } = await uploadAvatar({ uri: a.uri, name: a.fileName || `photo-${Date.now()}.jpg`, mimeType: a.mimeType || "image/jpeg", size: a.fileSize, file: (a as any).file });
      setPhoto(url);
      await refreshMe().catch(() => {});
    } catch (e: any) { setError(e?.message || "Couldn't upload the photo."); }
    setBusy(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" onPress={() => router.replace("/account")} hitSlop={12}><Text style={st.back}>‹ Account</Text></Pressable>
          <Text style={st.title}>My details</Text>
          <Card style={{ alignItems: "center", gap: 10 }}>
            <Avatar name={name || me?.full_name || "?"} uri={photo} size={96} />
            <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
              {Platform.OS !== "web" ? <View style={{ flex: 1 }}><Button title="Take photo" color={colors.brandSoft} disabled={!!busy} loading={busy === "photo"} onPress={() => changePhoto(true)} /></View> : null}
              <View style={{ flex: 1 }}><Button title="Choose photo" color={colors.brandSoft} disabled={!!busy} loading={busy === "photo" && Platform.OS === "web"} onPress={() => changePhoto(false)} /></View>
            </View>
          </Card>
          <Card style={{ gap: 10 }}>
            <Field label="Full name" value={name} onChange={setName} />
            <Field label="Phone" value={phone} onChange={setPhone} keyboard="phone-pad" placeholder="+234…" hint="So the school can reach you." />
            <View style={{ gap: 2 }}><Text style={st.label}>Email</Text><Muted>{q.data.email} (ask the school office to change it)</Muted></View>
            {error ? <Text accessibilityRole="alert" style={st.error}>{error}</Text> : null}
            {saved ? <Text style={st.ok}>Saved ✓</Text> : null}
            <Button title="Save" onPress={save} loading={busy === "save"} disabled={busy === "photo"} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  title: { fontSize: 26, fontWeight: "900", color: colors.text },
  label: { fontWeight: "800", color: colors.text },
  error: { color: colors.red, fontWeight: "700" },
  ok: { color: colors.green, fontWeight: "800" },
});
