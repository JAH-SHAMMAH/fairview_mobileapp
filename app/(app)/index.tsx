import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/lib/auth";
import { api, isSuperUser } from "../../src/lib/api";
import { useRole } from "../../src/lib/role";
import { Avatar, Card, ErrorBox, Loading, Muted, StatLabel } from "../../src/components/ui";
import { colors, firstName } from "../../src/lib/theme";

const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

function Tile({ icon, label, color, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.tile, { backgroundColor: color, opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name={icon} size={30} color="#fff" />
      <Text style={st.tileText}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { me } = useAuth();
  const { ctx, role, setRole, isLoading, isError, refetch } = useRole();
  const router = useRouter();
  const staffAdmin = role === "admin";
  const overview = useQuery<{ students: { total: number; male: number; female: number }; classes: number; teachers: number; attendance_today: number }>({
    queryKey: ["overview"], enabled: staffAdmin, retry: false,
    queryFn: () => api.get("/dashboard/overview").then((r) => r.data),
  });
  if (isLoading) return <Loading />;
  if (isError || !ctx) return <ErrorBox text="Couldn't load your dashboard." onRetry={refetch} />;

  const first = firstName(me?.full_name);
  const kids = ctx.as_parent?.children ?? [];
  const stu = ctx.as_student;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={st.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
        <View style={st.head}>
          <View style={{ flex: 1 }}>
            <Muted>{greet()}</Muted>
            <Text style={st.name}>{first || "Welcome"} 👋</Text>
          </View>
          <Avatar name={me?.full_name || "?"} />
        </View>

        {ctx.available_roles.length > 1 && (
          <View style={st.roles}>
            {ctx.available_roles.map((r) => (
              <Text key={r} onPress={() => setRole(r)} style={[st.role, r === role && st.roleOn]}>{r[0].toUpperCase() + r.slice(1)}</Text>
            ))}
          </View>
        )}

        {role === "parent" && (
          <>
            <Text style={st.sec}>Your children</Text>
            {kids.length === 0 ? <Card><Muted>No children are linked to your account yet. Contact the school office.</Muted></Card> : kids.map((c) => (
              <Card key={c.id} style={st.row}>
                <Avatar name={`${c.first_name} ${c.last_name}`} />
                <View style={{ flex: 1 }}>
                  <Text style={st.cn}>{c.first_name} {c.last_name}</Text>
                  <Muted>{c.class_name || "No class yet"}</Muted>
                </View>
                {c.stats.attendance_pct != null && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[st.big, { color: c.stats.attendance_pct >= 90 ? colors.green : c.stats.attendance_pct >= 75 ? colors.amber : colors.red }]}>{`${Math.round(c.stats.attendance_pct)}%`}</Text>
                    <StatLabel>attendance</StatLabel>
                  </View>
                )}
              </Card>
            ))}
            <View style={st.grid}>
              <Tile icon="people" label="All children" color={colors.brandSoft} onPress={() => router.push("/children")} />
              <Tile icon="card" label="Pay fees" color={colors.amber} onPress={() => router.push("/fees")} />
            </View>
          </>
        )}

        {role === "student" && stu && (
          <>
            <Card style={{ backgroundColor: colors.brand, gap: 4 }}>
              <Text style={{ color: "#CFE6DA", fontWeight: "700" }}>{stu.class?.name || "No class yet"}</Text>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>{stu.student.first_name} {stu.student.last_name}</Text>
            </Card>
            <View style={st.grid}>
              <Card style={st.stat}><Text style={st.big}>{stu.stats.attendance_pct == null ? "–" : `${Math.round(stu.stats.attendance_pct)}%`}</Text><StatLabel>Attendance</StatLabel></Card>
              <Card style={st.stat}><Text style={st.big}>{stu.stats.pending_assignments}</Text><StatLabel>Assignments due</StatLabel></Card>
            </View>
            <View style={st.grid}>
              <Tile icon="document-text" label="Exam portal" color={colors.indigo} onPress={() => router.push("/exams")} />
              <Tile icon="trending-up" label="My progress" color={colors.violet} onPress={() => router.push("/progress")} />
            </View>
            <Text style={st.sec}>Today’s lessons</Text>
            {stu.today_slots.length === 0 ? <Card><Muted>No lessons scheduled today.</Muted></Card> : stu.today_slots.map((s) => (
              <Card key={s.id} style={st.row}>
                <View style={{ flex: 1 }}>
                  <Text style={st.cn}>{s.subject_name || "Lesson"}</Text>
                  <Muted>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}{s.room ? ` · ${s.room}` : ""}</Muted>
                </View>
              </Card>
            ))}
          </>
        )}

        {role === "admin" && (
          <>
            {isSuperUser(me) && <Card style={{ backgroundColor: "#EDE9FE", borderColor: "#C4B5FD" }}><Text style={{ fontWeight: "900", color: "#5B21B6" }}>Super User</Text><Muted>You have full access. Use the web portal for settings, users and backups.</Muted></Card>}
            {overview.isLoading ? <Loading /> : overview.data ? (
              <>
                <View style={st.grid}>
                  <Card style={st.stat}><Text style={st.big}>{overview.data.students.total}</Text><StatLabel>Students</StatLabel></Card>
                  <Card style={st.stat}><Text style={st.big}>{overview.data.teachers}</Text><StatLabel>Teachers</StatLabel></Card>
                </View>
                <View style={st.grid}>
                  <Card style={st.stat}><Text style={st.big}>{overview.data.classes}</Text><StatLabel>{overview.data.classes === 1 ? "Class" : "Classes"}</StatLabel></Card>
                  <Card style={st.stat}><Text style={st.big}>{overview.data.attendance_today}</Text><StatLabel>Marked today</StatLabel></Card>
                </View>
              </>
            ) : <Card><Muted>The school overview isn’t available for your account.</Muted></Card>}
            <View style={st.grid}>
              <Tile icon="checkbox" label="Mark attendance" color={colors.green} onPress={() => router.push("/mark")} />
              <Tile icon="newspaper" label="News feed" color={colors.indigo} onPress={() => router.push("/feed")} />
            </View>
          </>
        )}

        {role === "teacher" && ctx.as_teacher && (
          <>
            <View style={st.grid}>
              <Card style={st.stat}><Text style={st.big}>{ctx.as_teacher.stats.classes_count}</Text><StatLabel>{ctx.as_teacher.stats.classes_count === 1 ? "Class" : "Classes"}</StatLabel></Card>
              <Card style={st.stat}><Text style={st.big}>{ctx.as_teacher.stats.today_lessons}</Text><StatLabel>{ctx.as_teacher.stats.today_lessons === 1 ? "Lesson today" : "Lessons today"}</StatLabel></Card>
            </View>
            <View style={st.grid}>
              <Tile icon="checkbox" label="Mark attendance" color={colors.green} onPress={() => router.push("/mark")} />
              <Tile icon="newspaper" label="News feed" color={colors.indigo} onPress={() => router.push("/feed")} />
            </View>
            <View style={st.grid}>
              <Tile icon="create" label="Enter scores" color={colors.violet} onPress={() => router.push("/entry")} />
              <Tile icon="podium" label="CBT results" color={colors.amber} onPress={() => router.push("/cbt")} />
            </View>
            <Text style={st.sec}>Today’s lessons</Text>
            {ctx.as_teacher.today_slots.length === 0 ? <Card><Muted>No lessons scheduled today.</Muted></Card> : ctx.as_teacher.today_slots.map((s) => (
              <Card key={s.id}><Text style={st.cn}>{s.subject_name || "Lesson"}</Text><Muted>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}{s.room ? ` · ${s.room}` : ""}</Muted></Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  pad: { padding: 18, gap: 14, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 28, fontWeight: "900", color: colors.text },
  sec: { fontSize: 18, fontWeight: "900", color: colors.text, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  cn: { fontSize: 17, fontWeight: "800", color: colors.text },
  big: { fontSize: 24, fontWeight: "900", color: colors.text },
  grid: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, minHeight: 110, borderRadius: 18, padding: 16, justifyContent: "space-between" },
  tileText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  stat: { flex: 1, alignItems: "flex-start", gap: 2 },
  roles: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  role: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, color: colors.text, fontWeight: "800", overflow: "hidden" },
  roleOn: { backgroundColor: colors.brand, color: "#fff", borderColor: colors.brand },
});
