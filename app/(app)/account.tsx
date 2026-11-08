import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/lib/auth";
import { API_URL } from "../../src/lib/api";
import { canBackup } from "../../src/lib/backup";
import { confirmAction } from "../../src/lib/confirm";
import { getPushStatus, pushUnsupportedReason, PushStatus, registerForPush, whenPushSettled } from "../../src/lib/push";
import { canManageUsers } from "../../src/lib/users";
import { Avatar, Button, Card, H1, Muted } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

const PUSH_TEXT: Record<PushStatus, string> = {
  on: "On. You'll get alerts for attendance, reports, fees and notices.",
  denied: "Off. Alerts are blocked in your phone's settings.",
  unsupported: "Not available here.",
  "no-project": "Not set up in this build of the app yet.",
  error: "Couldn't turn on alerts. Check your connection and try again.",
};

function Row({ title, sub, onPress }: { title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [st.row, pressed && { opacity: 0.75 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.rowTitle}>{title}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
      <Text style={st.chev}>›</Text>
    </Pressable>
  );
}

export default function Account() {
  const { me, signOut } = useAuth();
  const router = useRouter();
  const [push, setPush] = useState<PushStatus | null>(getPushStatus());
  const [pushBusy, setPushBusy] = useState(false);
  const unsupported = pushUnsupportedReason();

  useEffect(() => {
    let live = true;
    whenPushSettled()?.then((st) => { if (live) setPush(st); });
    return () => { live = false; };
  }, []);

  const retryPush = async () => {
    if (push === "denied") { Linking.openSettings().catch(() => {}); return; }
    setPushBusy(true);
    setPush(await registerForPush());
    setPushBusy(false);
  };

  const askSignOut = async () => {
    if (await confirmAction("Sign out?", "You'll need to sign in again.", "Sign out", true)) await signOut();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
        <H1>Account</H1>
        <Card style={{ alignItems: "center", gap: 8 }}>
          <Avatar name={me?.full_name || "?"} size={76} />
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, textAlign: "center" }}>{me?.full_name}</Text>
          <Muted>{me?.email}</Muted>
          <Muted>{me?.org?.name ?? "Fairview School"}</Muted>
        </Card>

        <View style={{ gap: 10 }}>
          <Row title="Change password" onPress={() => router.push("/change-password")} />
          {canManageUsers(me) ? <Row title="Manage users" sub="Add staff and parents, change roles, reset passwords" onPress={() => router.push("/users")} /> : null}
          {canBackup(me) ? <Row title="Backup" sub="Download a copy of all the school's records" onPress={() => router.push("/backup")} /> : null}
        </View>

        <Card style={{ gap: 8 }}>
          <Text style={st.section}>Phone alerts</Text>
          <Muted>{unsupported ?? (push ? PUSH_TEXT[push] : whenPushSettled() ? "Checking…" : "Off.")}</Muted>
          {!unsupported && push !== "on" && push !== "unsupported" && !(push === null && whenPushSettled()) ? (
            <Button title={push === "denied" ? "Open phone settings" : push ? "Try again" : "Turn on alerts"} color={colors.brandSoft} loading={pushBusy} onPress={retryPush} />
          ) : null}
        </Card>

        <Button title="Sign out" color={colors.red} onPress={askSignOut} />
        <Muted>Server: {API_URL.replace("https://", "")}{Platform.OS === "web" ? " · web" : ""}</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  rowTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted },
  chev: { fontSize: 26, color: colors.muted, fontWeight: "300" },
  section: { fontWeight: "900", fontSize: 17, color: colors.text },
});
