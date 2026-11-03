import { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../src/components/ui";
import { colors, naira } from "../../src/lib/theme";

interface Invoice { id: string; number: string; student_name?: string; customer_name?: string; invoice_date?: string; total: number | string }
const LABEL: Record<string, string> = { paystack: "Paystack", flutterwave: "Flutterwave", remita: "Remita" };

export default function Fees() {
  const qc = useQueryClient();
  const [chosen, setChosen] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const inv = useQuery<Invoice[]>({ queryKey: ["fee-invoices"], queryFn: () => api.get("/payments/remita/invoices").then((r) => r.data) });
  const prov = useQuery<{ providers: string[] }>({ queryKey: ["fee-providers"], queryFn: () => api.get("/payments/fees/providers").then((r) => r.data) });
  const providers = prov.data?.providers ?? [];
  const provider = chosen ?? providers[0] ?? null;

  const confirm = async () => {
    try {
      const r = await api.post("/payments/fees/reconcile-mine").then((x) => x.data as { settled: number });
      if (r?.settled) Alert.alert("Payment confirmed", `${r.settled} payment(s) confirmed. Thank you!`);
    } catch {}
    qc.invalidateQueries({ queryKey: ["fee-invoices"] });
  };

  const pay = useMutation({
    mutationFn: async ({ id, provider }: { id: string; provider: string }) => {
      setPayingId(id);
      const res = provider === "remita"
        ? await api.post("/payments/remita/initiate", { invoice_id: id }).then((r) => r.data)
        : await api.post("/payments/fees/initiate", { invoice_id: id, provider }).then((r) => r.data);
      const url: string | undefined = res?.payment_url || res?.authorization_url;
      if (!url) throw new Error(res?.message || "Could not start payment.");
      await WebBrowser.openBrowserAsync(url);
      await confirm();
    },
    onError: (e) => Alert.alert("Payment", e instanceof Error && !("response" in e) ? e.message : errorText(e, "Could not start payment.")),
    onSettled: () => setPayingId(null),
  });

  if (inv.isLoading || prov.isLoading) return <Loading />;
  if (inv.isError) return <ErrorBox text="Couldn't load your invoices." onRetry={() => inv.refetch()} />;
  const list = inv.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => { inv.refetch(); confirm(); }} />}>
        <H1>Pay fees</H1>
        <Muted>Outstanding invoices for your children. Pay securely online.</Muted>

        {providers.length > 1 && (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {providers.map((p) => (
              <Text key={p} onPress={() => setChosen(p)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: provider === p ? colors.brand : colors.border, backgroundColor: provider === p ? colors.brand : "#fff", color: provider === p ? "#fff" : colors.text }}>{LABEL[p] ?? p}</Text>
            ))}
          </View>
        )}

        {list.length === 0 ? <Empty title="No outstanding fees 🎉" sub="You're all settled up." /> : provider === null ? <Empty title="Online payment isn't set up yet" sub="Please contact the school to pay your fees." /> : list.map((i) => (
          <Card key={i.id} style={{ gap: 10 }}>
            <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text }}>{i.student_name || i.customer_name}</Text>
            <Muted>Invoice {i.number}{i.invoice_date ? ` · ${new Date(i.invoice_date).toLocaleDateString()}` : ""}</Muted>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>{naira(Number(i.total))}</Text>
              <Pill text="Outstanding" color={colors.amber} />
            </View>
            <Button title={`Pay with ${LABEL[provider] ?? provider}`} loading={payingId === i.id && pay.isPending} disabled={pay.isPending} onPress={() => pay.mutate({ id: i.id, provider })} />
          </Card>
        ))}
        <Muted>Payments are processed securely by the school's payment provider. Pull down to check for a confirmed payment.</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}
