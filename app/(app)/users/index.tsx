import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { errorText } from "../../../src/lib/api";
import { useAuth } from "../../../src/lib/auth";
import { canManageUsers, STATUS_LABEL, statusColor, UserStatus, usersApi } from "../../../src/lib/users";
import { Avatar, Button, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../../src/components/ui";
import { colors } from "../../../src/lib/theme";

const FILTERS: { key: UserStatus | ""; label: string }[] = [
  { key: "", label: "Everyone" }, { key: "active", label: "Active" }, { key: "pending", label: "Invited" },
  { key: "suspended", label: "Suspended" }, { key: "inactive", label: "Inactive" }, { key: "locked", label: "Locked" },
];

export default function Users() {
  const { me } = useAuth();
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");

  // wait for the person to stop typing before asking the server
  useEffect(() => { const t = setTimeout(() => setSearch(typed.trim()), 350); return () => clearTimeout(t); }, [typed]);

  const q = useInfiniteQuery({
    queryKey: ["users", search, status],
    queryFn: ({ pageParam }) => usersApi.list({ page: pageParam, search, status }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    enabled: canManageUsers(me),
  });

  if (!canManageUsers(me)) return <Empty title="Only school admins can manage users." />;

  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={{ padding: 18, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/account")} hitSlop={12}><Text style={st.back}>‹ Account</Text></Pressable>
          <View style={{ flexShrink: 0 }}><Button title="+ Add user" onPress={() => router.push("/users/new")} /></View>
        </View>
        <H1>Users</H1>
        <TextInput accessibilityLabel="Search users" value={typed} onChangeText={setTyped} placeholder="Search name or email" placeholderTextColor="#9AA5A0" style={st.search} autoCapitalize="none" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <Pressable key={f.key || "all"} accessibilityRole="button" accessibilityState={{ selected: status === f.key }} onPress={() => setStatus(f.key)} style={[st.chip, status === f.key && st.chipOn]}>
              <Text style={[st.chipText, status === f.key && { color: "#fff" }]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {q.isSuccess ? <Muted>{total} {total === 1 ? "person" : "people"}</Muted> : null}
      </View>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorBox text={errorText(q.error, "Couldn't load users.")} onRetry={() => q.refetch()} /> : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 18, paddingTop: 4, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} />}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Empty title="No one matches" sub={search ? "Try a different name or email." : undefined} />}
          ListFooterComponent={q.isFetchingNextPage ? <Muted>Loading more…</Muted> : undefined}
          renderItem={({ item: u }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${u.full_name}`} onPress={() => router.push(`/users/${u.id}`)} style={({ pressed }) => [st.row, pressed && { opacity: 0.8 }]}>
              <Avatar name={u.full_name || u.email} size={44} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={st.name} numberOfLines={1}>{u.full_name}</Text>
                <Text style={st.email} numberOfLines={1}>{u.email}</Text>
                <Text style={st.roles} numberOfLines={1}>{u.roles?.map((r) => r.name).join(", ") || "No role yet"}</Text>
              </View>
              <Pill text={STATUS_LABEL[u.status] ?? u.status} color={statusColor(u.status)} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  back: { color: colors.brand, fontWeight: "800", fontSize: 16 },
  search: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text, backgroundColor: "#fff" },
  chip: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: "800", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 },
  name: { fontWeight: "900", fontSize: 16, color: colors.text },
  email: { color: colors.muted, fontSize: 13 },
  roles: { color: colors.text, fontSize: 13 },
});
