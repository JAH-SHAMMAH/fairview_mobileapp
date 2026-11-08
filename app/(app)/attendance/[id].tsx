import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../../src/components/ui";
import { colors, fmtDate } from "../../../src/lib/theme";

interface Hist { records: { id: string; date: string; status: string; notes?: string | null }[]; summary: { present: number; absent: number; late: number; excused: number; total: number; attendance_rate: number } }
const tone: Record<string, string> = { present: colors.green, absent: colors.red, late: colors.amber, excused: colors.indigo };

export default function AttendanceHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery<Hist>({ queryKey: ["att-hist", id], queryFn: () => api.get(`/school/attendance/student/${id}`).then((r) => r.data) });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorBox text="Couldn't load attendance." onRetry={() => q.refetch()} />;
  const { summary: s, records } = q.data;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { q.refetch(); }} />}>
        <Button title="← Back" color={colors.muted} onPress={() => router.back()} />
        <H1>Attendance</H1>
        <Card><Text style={{ fontSize: 34, fontWeight: "900", color: s.attendance_rate >= 90 ? colors.green : s.attendance_rate >= 75 ? colors.amber : colors.red }}>{Math.round(s.attendance_rate)}%</Text><Muted>{s.present} present · {s.absent} absent · {s.late} late · {s.excused} excused</Muted></Card>
        {records.length === 0 ? <Empty title="No records yet" /> : records.map((r) => (
          <Card key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", color: colors.text }}>{fmtDate(r.date, { weekday: true })}</Text>
              {r.notes ? <Muted>{r.notes}</Muted> : null}
            </View>
            <Pill text={r.status[0].toUpperCase() + r.status.slice(1)} color={tone[r.status] ?? colors.muted} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
