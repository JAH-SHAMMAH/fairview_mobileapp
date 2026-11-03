import { useState } from "react";
import { Linking, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api, isSuperUser } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { Avatar, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

type Tab = "students" | "teachers" | "classes" | "audit";
const call = (n?: string | null) => n && Linking.openURL(`tel:${n}`);

function useList<T>(key: string, url: string, params: object, enabled = true) {
  return useQuery<T>({ queryKey: [key, params], enabled, retry: false, queryFn: () => api.get(url, { params }).then((r) => r.data) });
}

export default function School() {
  const { me } = useAuth();
  const sup = isSuperUser(me);
  const [tab, setTab] = useState<Tab>("students");
  const [search, setSearch] = useState("");
  const tabs: [Tab, string][] = [["students", "Students"], ["teachers", "Teachers"], ["classes", "Classes"], ...(sup ? [["audit", "Audit log"] as [Tab, string]] : [])];

  const students = useList<{ items: any[]; total: number }>("dir-students", "/school/students", { search: search || undefined, page_size: 50, status: "active" }, tab === "students");
  const teachers = useList<{ items: any[] }>("dir-teachers", "/school/teachers", { page_size: 200 }, tab === "teachers");
  const classes = useList<{ items: any[] }>("dir-classes", "/school/classes", { page_size: 200 }, tab === "classes");
  const audit = useList<any[]>("dir-audit", "/analytics/audit-log", { limit: 60 }, tab === "audit" && sup);
  const cur = tab === "students" ? students : tab === "teachers" ? teachers : tab === "classes" ? classes : audit;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { cur.refetch(); }} />} keyboardShouldPersistTaps="handled">
        <H1>School</H1>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {tabs.map(([k, l]) => <Text key={k} onPress={() => setTab(k)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: tab === k ? colors.brand : colors.border, backgroundColor: tab === k ? colors.brand : "#fff", color: tab === k ? "#fff" : colors.text }}>{l}</Text>)}
        </ScrollView>
        {tab === "students" && <TextInput value={search} onChangeText={setSearch} placeholder="Search students…" placeholderTextColor="#9AA5A0" autoCapitalize="none" style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: colors.text }} />}

        {cur.isLoading ? <Loading /> : cur.isError ? <ErrorBox text="Couldn't load this list." onRetry={() => cur.refetch()} /> : (
          <>
            {tab === "students" && (students.data?.items ?? []).length === 0 && <Empty title="No students found" />}
            {tab === "students" && (students.data?.items ?? []).map((s) => (
              <Card key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
                <Avatar name={`${s.first_name} ${s.last_name}`} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>{s.first_name} {s.last_name}</Text>
                  <Muted>{s.class_name || "No class"} · {s.student_id}</Muted>
                  {s.guardian_phone ? <Text onPress={() => call(s.guardian_phone)} style={{ color: colors.indigo, fontWeight: "700", marginTop: 2 }}>📞 {s.guardian_name ? `${s.guardian_name} · ` : ""}{s.guardian_phone}</Text> : null}
                </View>
              </Card>
            ))}
            {tab === "students" && students.data ? <Muted>{students.data.total} active students{students.data.total > 50 ? " · showing the first 50, use search" : ""}</Muted> : null}

            {tab === "teachers" && (teachers.data?.items ?? []).map((t) => (
              <Card key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
                <Avatar name={`${t.first_name} ${t.last_name}`} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>{t.first_name} {t.last_name}</Text>
                  <Muted>{t.email}</Muted>
                  {t.phone ? <Text onPress={() => call(t.phone)} style={{ color: colors.indigo, fontWeight: "700" }}>📞 {t.phone}</Text> : null}
                </View>
              </Card>
            ))}

            {tab === "classes" && (classes.data?.items ?? []).map((c) => (
              <Card key={c.id} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "900", color: colors.text, fontSize: 17 }}>{c.name}</Text>
                  <Pill text={`${c.student_count} pupils`} color={colors.brandSoft} />
                </View>
                <Muted>{c.class_teacher_name ? `Teacher: ${c.class_teacher_name}` : "No class teacher"}</Muted>
              </Card>
            ))}

            {tab === "audit" && (audit.data ?? []).map((a) => (
              <Card key={a.id} style={{ gap: 2, paddingVertical: 10 }}>
                <Text style={{ fontWeight: "800", color: colors.text }}>{String(a.action).replace(/_/g, " ")} · {a.resource_type}</Text>
                {a.resource_label ? <Text style={{ color: colors.text }}>{a.resource_label}</Text> : null}
                <Muted>{a.actor_email || "system"} · {a.created_at ? new Date(a.created_at).toLocaleString() : ""}</Muted>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
