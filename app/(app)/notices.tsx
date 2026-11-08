import { RefreshControl, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors, fmtDate } from "../../src/lib/theme";

interface N { id: string; title: string; message?: string | null; read: boolean; created_at: string }

export default function Notices() {
  const qc = useQueryClient();
  const q = useQuery<{ unread_count: number; items: N[] }>({ queryKey: ["notices"], queryFn: () => api.get("/notifications", { params: { limit: 60 } }).then((r) => r.data) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["notices"] });
  const read = useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api.patch("/notifications/read-all"), onSuccess: refresh });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorBox text="Couldn't load notices." onRetry={() => q.refetch()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        <H1>Notices</H1>
        {q.data.unread_count > 0 && <Button title={`Mark all ${q.data.unread_count} as read`} color={colors.brandSoft} loading={readAll.isPending} onPress={() => readAll.mutate()} />}
        {q.data.items.length === 0 ? <Empty title="You're all caught up" /> : q.data.items.map((n) => (
          <Card key={n.id} style={{ gap: 4, borderLeftWidth: 6, borderLeftColor: n.read ? colors.border : colors.indigo }}>
            <Text onPress={() => !n.read && read.mutate(n.id)} style={{ fontWeight: n.read ? "700" : "900", color: colors.text, fontSize: 16 }}>{n.title}</Text>
            {n.message ? <Text style={{ color: colors.text }}>{n.message}</Text> : null}
            <Muted>{fmtDate(n.created_at, { time: true })}</Muted>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
