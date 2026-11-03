import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText, isSuperUser } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { Avatar, Button, Card, Empty, ErrorBox, H1, Loading, Muted } from "../../src/components/ui";
import { colors } from "../../src/lib/theme";

interface Post { id: string; user_id: string; author_name?: string | null; content?: string | null; like_count: number; comment_count: number; liked_by_me: boolean; created_at: string }
const ago = (iso: string) => { const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

export default function Feed() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const q = useQuery<Post[]>({ queryKey: ["feed"], queryFn: () => api.get("/feed/posts", { params: { limit: 30 } }).then((r) => r.data) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["feed"] });
  const post = useMutation({ mutationFn: () => api.post("/feed/posts", { content: text.trim() }), onSuccess: () => { setText(""); refresh(); }, onError: (e) => Alert.alert("Couldn't post", errorText(e)) });
  const like = useMutation({ mutationFn: (p: Post) => (p.liked_by_me ? api.delete(`/feed/posts/${p.id}/like`) : api.post(`/feed/posts/${p.id}/like`)), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/feed/posts/${id}`), onSuccess: refresh, onError: (e) => Alert.alert("Couldn't delete", errorText(e)) });
  const canDelete = (p: Post) => isSuperUser(me) || p.user_id === me?.id;

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorBox text="Couldn't load the news feed." onRetry={() => q.refetch()} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        <H1>News feed</H1>
        <Card style={{ gap: 10 }}>
          <TextInput value={text} onChangeText={setText} multiline placeholder="Share something with the school…" placeholderTextColor="#9AA5A0" style={{ minHeight: 60, fontSize: 16, color: colors.text }} textAlignVertical="top" />
          <Button title="Post" loading={post.isPending} disabled={!text.trim()} onPress={() => post.mutate()} />
        </Card>
        {(q.data ?? []).length === 0 ? <Empty title="No posts yet" /> : (q.data ?? []).map((p) => (
          <Card key={p.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Avatar name={p.author_name || "?"} size={40} />
              <View style={{ flex: 1 }}><Text style={{ fontWeight: "900", color: colors.text }}>{p.author_name || "School"}</Text><Muted>{ago(p.created_at)} ago</Muted></View>
              {canDelete(p) ? <Text onPress={() => Alert.alert("Delete post?", "This removes it for everyone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => del.mutate(p.id) }])} style={{ color: colors.red, fontWeight: "800" }}>Delete</Text> : null}
            </View>
            {p.content ? <Text style={{ fontSize: 16, color: colors.text, lineHeight: 23 }}>{p.content}</Text> : null}
            <View style={{ flexDirection: "row", gap: 18 }}>
              <Text onPress={() => like.mutate(p)} style={{ fontWeight: "800", color: p.liked_by_me ? colors.rose : colors.muted }}>{p.liked_by_me ? "♥" : "♡"} {p.like_count}</Text>
              <Muted>💬 {p.comment_count}</Muted>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
