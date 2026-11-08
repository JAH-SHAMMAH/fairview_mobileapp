import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { notify } from "../../src/lib/confirm";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { Avatar, Button, Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

type Status = "present" | "absent" | "late" | "excused";
const ORDER: Status[] = ["present", "absent", "late", "excused"];
const TONE: Record<Status, string> = { present: colors.green, absent: colors.red, late: colors.amber, excused: colors.indigo };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

interface Cls { id: string; name: string }
interface Stu { id: string; first_name: string; last_name: string }

export default function MarkAttendance() {
  const [classId, setClassId] = useState("");
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const date = today();

  const classes = useQuery<{ items: Cls[] }>({ queryKey: ["staff-classes"], queryFn: () => api.get("/school/classes", { params: { page_size: 200 } }).then((r) => r.data) });
  useEffect(() => { if (!classId && classes.data?.items?.length) setClassId(classes.data.items[0].id); }, [classes.data, classId]);

  const roster = useQuery<{ items: Stu[] }>({ queryKey: ["roster", classId], enabled: !!classId, queryFn: () => api.get("/school/students", { params: { class_id: classId, page_size: 200, status: "active" } }).then((r) => r.data) });
  const saved = useQuery<{ items: { student_id: string; status: Status }[] }>({ queryKey: ["att-today", classId, date], enabled: !!classId, queryFn: () => api.get("/school/attendance", { params: { class_id: classId, date } }).then((r) => r.data) });

  useEffect(() => {
    if (!roster.data || !saved.data) return;
    const m: Record<string, Status> = {};
    roster.data.items.forEach((s) => { m[s.id] = "present"; });
    saved.data.items.forEach((r) => { if (m[r.student_id] !== undefined) m[r.student_id] = r.status; });
    setMarks(m);
  }, [roster.data, saved.data]);

  const save = useMutation({
    mutationFn: () => api.post("/school/attendance", Object.entries(marks).map(([student_id, status]) => ({ student_id, class_id: classId, status })), { params: { attendance_date: date } }).then((r) => r.data),
    onSuccess: (r) => { notify("Saved", `${r.marked} pupils marked for today.`); saved.refetch(); },
    onError: (e) => notify("Couldn't save", errorText(e)),
  });

  const all = (st: Status) => setMarks((m) => Object.fromEntries(Object.keys(m).map((k) => [k, st])));
  const cycle = (id: string) => setMarks((m) => ({ ...m, [id]: ORDER[(ORDER.indexOf(m[id]) + 1) % ORDER.length] }));
  const counts = ORDER.map((o) => [o, Object.values(marks).filter((v) => v === o).length] as const);

  if (classes.isLoading) return <Loading />;
  if (classes.isError) return <ErrorBox text="Couldn't load classes." onRetry={() => classes.refetch()} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { roster.refetch(); saved.refetch(); }} />}>
        <H1>Mark attendance</H1>
        <Muted>{fmtDate(new Date(), { weekday: true })} · tap a pupil to change their status</Muted>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(classes.data?.items ?? []).map((c) => (
            <Text key={c.id} onPress={() => setClassId(c.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: classId === c.id ? colors.brand : colors.border, backgroundColor: classId === c.id ? colors.brand : "#fff", color: classId === c.id ? "#fff" : colors.text }}>{c.name}</Text>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Button title="All present" color={colors.green} onPress={() => all("present")} /></View>
          <View style={{ flex: 1 }}><Button title="All absent" color={colors.red} onPress={() => all("absent")} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {counts.map(([k, n]) => <Text key={k} style={{ color: TONE[k], fontWeight: "800" }}>{k}: {n}</Text>)}
        </View>
        {roster.isLoading || saved.isLoading ? <Loading /> : (roster.data?.items ?? []).length === 0 ? <Empty title="No pupils in this class" /> : (roster.data?.items ?? []).map((s) => {
          const st = marks[s.id] ?? "present";
          return (
            <Pressable key={s.id} onPress={() => cycle(s.id)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderLeftWidth: 6, borderLeftColor: TONE[st] }}>
                <Avatar name={`${s.first_name} ${s.last_name}`} size={42} />
                <Text style={{ flex: 1, fontWeight: "800", color: colors.text, fontSize: 16 }}>{s.first_name} {s.last_name}</Text>
                <Text style={{ fontWeight: "900", color: TONE[st] }}>{st[0].toUpperCase() + st.slice(1)}</Text>
              </Card>
            </Pressable>
          );
        })}
        <Button title="Save attendance" loading={save.isPending} disabled={!Object.keys(marks).length} onPress={() => save.mutate()} />
      </ScrollView>
    </SafeAreaView>
  );
}
