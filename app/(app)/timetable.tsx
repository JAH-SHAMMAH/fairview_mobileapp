import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useRole } from "../../src/lib/role";
import { Slot } from "../../src/lib/api";
import { Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";
import { DAYS, groupByDay, hhmm, nowSlot, todayIndex } from "../../src/lib/timetable";

export default function Timetable() {
  const { ctx, role, isLoading, isError, refetch } = useRole();
  const router = useRouter();
  const kids = ctx?.as_parent?.children ?? [];
  const [childId, setChildId] = useState<string | null>(null);
  const [day, setDay] = useState(() => (todayIndex() > 4 ? 0 : todayIndex())); // weekend: show Monday

  const classNames = useMemo(() => Object.fromEntries((ctx?.as_teacher?.classes ?? []).map((c) => [c.id, c.name])), [ctx]);

  if (isLoading) return <Loading />;
  if (isError || !ctx) return <ErrorBox text="Couldn't load the timetable." onRetry={refetch} />;

  let slots: Slot[] = [];
  let heading = "Timetable";
  let showClass = false;
  if (role === "parent") {
    const child = kids.find((k) => k.id === childId) ?? kids[0];
    slots = child?.timetable ?? [];
    heading = child ? `${child.first_name}'s timetable` : "Timetable";
  } else if (role === "student") {
    slots = ctx.as_student?.timetable ?? [];
    heading = ctx.as_student?.class?.name ? `${ctx.as_student.class.name} timetable` : "My timetable";
  } else {
    slots = ctx.as_teacher?.timetable ?? [];
    heading = "My lessons";
    showClass = true;
  }
  const byDay = groupByDay(slots);
  const today = todayIndex();
  const list = byDay[day] ?? [];
  const current = day === today ? nowSlot(list) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")} hitSlop={12}><Text style={st.back}>‹ Home</Text></Pressable>
        <H1>{heading}</H1>

        {role === "parent" && kids.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {kids.map((k) => {
              const on = (childId ?? kids[0].id) === k.id;
              return (
                <Pressable key={k.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setChildId(k.id)} style={[st.chip, on && st.chipOn]}>
                  <Text style={[st.chipText, on && { color: "#fff" }]}>{k.first_name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={st.days}>
          {DAYS.map((d, i) => {
            const on = i === day;
            return (
              <Pressable key={d} accessibilityRole="button" accessibilityLabel={d} accessibilityState={{ selected: on }} onPress={() => setDay(i)} style={[st.day, on && st.dayOn]}>
                <Text style={[st.dayText, on && { color: "#fff" }]}>{d.slice(0, 3)}</Text>
                {i === today ? <View style={[st.dot, on && { backgroundColor: "#fff" }]} /> : null}
              </Pressable>
            );
          })}
        </View>

        {slots.length === 0 ? (
          <Empty title="No timetable yet" sub="The school hasn't set up lessons for this class. Check back later." />
        ) : list.length === 0 ? (
          <Card><Muted>No lessons on {DAYS[day]}.</Muted></Card>
        ) : list.map((s) => {
          const live = current?.id === s.id;
          return (
            <Card key={s.id} style={[st.slot, live && st.slotLive]}>
              <View style={st.time}>
                <Text style={st.timeText}>{hhmm(s.start_time)}</Text>
                <Text style={st.timeEnd}>{hhmm(s.end_time)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={st.subject} numberOfLines={2}>{s.subject_name || "Lesson"}</Text>
                <Muted>{[showClass && s.class_id ? classNames[s.class_id] : null, s.room].filter(Boolean).join(" · ") || " "}</Muted>
              </View>
              {live ? <Text style={st.now}>NOW</Text> : null}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  chip: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: "800", color: colors.text },
  days: { flexDirection: "row", gap: 6 },
  day: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, minHeight: 48, justifyContent: "center" },
  dayOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayText: { fontWeight: "900", color: colors.text, fontSize: 14 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand, marginTop: 3 },
  slot: { flexDirection: "row", alignItems: "center", gap: 14 },
  slotLive: { borderColor: colors.green, borderWidth: 2 },
  time: { width: 58, alignItems: "flex-start" },
  timeText: { fontWeight: "900", fontSize: 16, color: colors.text },
  timeEnd: { color: colors.muted, fontSize: 13 },
  subject: { fontSize: 17, fontWeight: "800", color: colors.text },
  now: { color: colors.green, fontWeight: "900", fontSize: 12 },
});
