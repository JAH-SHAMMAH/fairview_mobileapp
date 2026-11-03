import { Alert, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/lib/auth";
import { API_URL } from "../../src/lib/api";
import { Avatar, Button, Card, H1, Muted } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

export default function Account() {
  const { me, signOut } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <H1>Account</H1>
        <Card style={{ alignItems: "center", gap: 8 }}>
          <Avatar name={me?.full_name || "?"} size={76} />
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>{me?.full_name}</Text>
          <Muted>{me?.email}</Muted>
          <Muted>{me?.org?.name ?? "Fairview School"}</Muted>
        </Card>
        <Button title="Sign out" color={colors.red} onPress={() => Alert.alert("Sign out?", "You'll need to sign in again.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: signOut }])} />
        <Muted>Server: {API_URL.replace("https://", "")}</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}
