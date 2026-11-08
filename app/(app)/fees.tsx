import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../../src/lib/api";
import { Button, Card, Empty, ErrorBox, H1, Loading, Muted, Pill } from "../../src/components/ui";
import { colors, fmtDate, naira } from "../../src/lib/theme";

interface Invoice { id: string; number: string; student_name?: string; customer_name?: string; invoice_date?: string; total: number | string }
interface Payment {
  reference: string; provider: string; status: string; amount_ngn: number;
  student_name: string | null; invoice_number: string | null; paid_by: string | null;
  started_at: string | null; paid_at: string | null; method: string | null;
}
const LABEL: Record<string, string> = { paystack: "Paystack", flutterwave: "Flutterwave", remita: "Remita" };
const STATUS: Record<string, { text: string; color: string }> = {
  paid: { text: "Paid", color: colors.green },
  pending: { text: "Pending", color: colors.amber },
  failed: { text: "Failed", color: colors.red },
  cancelled: { text: "Not completed", color: colors.muted },
  refunded: { text: "Refunded", color: colors.indigo },
};

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text style={{ width: 82, color: colors.muted, fontSize: 13 }}>{k}</Text>
      <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "600", fontFamily: mono ? (Platform.OS === "ios" ? "Menlo" : "monospace") : undefined }}>{v}</Text>
    </View>
  );
}

export default function Fees() {
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ reference?: string }>();
  const [chosen, setChosen] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const inv = useQuery<Invoice[]>({ queryKey: ["fee-invoices"], queryFn: () => api.get("/payments/remita/invoices").then((r) => r.data) });
  const hist = useQuery<Payment[]>({ queryKey: ["fee-history"], queryFn: () => api.get("/payments/fees/history").then((r) => r.data) });
  const prov = useQuery<{ providers: string[] }>({ queryKey: ["fee-providers"], queryFn: () => api.get("/payments/fees/providers").then((r) => r.data) });
  const providers = prov.data?.providers ?? [];
  const provider = chosen ?? providers[0] ?? null;

  const reload = () => {
    qc.invalidateQueries({ queryKey: ["fee-invoices"] });
    qc.invalidateQueries({ queryKey: ["fee-history"] });
  };

  // Ask the gateway about my payments still awaiting confirmation, then reload.
  const refresh = useMutation({
    mutationFn: () => api.post("/payments/fees/reconcile-mine").then((r) => r.data as { pending: number; settled: number }),
    onSettled: reload,
  });
  const refreshNow = (quiet: boolean) =>
    refresh.mutate(undefined, {
      onSuccess: (r) => {
        if (r?.settled) Alert.alert("Payment confirmed", `${r.settled} payment(s) confirmed. Thank you!`);
        else if (!quiet) Alert.alert("Payments checked", r?.pending ? "Still waiting on the payment provider. Try again in a few minutes." : "Your payments are up to date.");
      },
      onError: (e) => { if (!quiet) Alert.alert("Refresh payments", errorText(e, "Couldn't check your payments.")); },
    });
  useEffect(() => { refreshNow(true); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // A card payment came back with its reference: confirm it, then show it in the history.
  const confirmReference = async (reference: string) => {
    try {
      const v = await api.get(`/payments/fees/verify/${encodeURIComponent(reference)}`).then((r) => r.data as { status: string; amount_ngn: number; paid_at?: string | null });
      reload();
      setHighlight(reference);
      if (v.status === "successful") {
        Alert.alert("Payment successful", `${naira(v.amount_ngn)} paid${v.paid_at ? ` on ${fmtDate(v.paid_at, { time: true })}` : ""}.\nRef: ${reference}\n\nIt's now in your payment history.`);
      } else if (v.status === "pending" || v.status === "processing") {
        Alert.alert("Payment pending", "If money left your account it will be confirmed shortly. Tap Refresh payments in a few minutes.");
      }
    } catch (e) {
      Alert.alert("Payment", errorText(e, "We couldn't confirm the payment yet. Tap Refresh payments in a moment."));
      reload();
    }
  };

  // Opened from the deep link (e.g. Android re-opening the app after the gateway).
  const handledRef = useRef<string | null>(null);
  useEffect(() => {
    const ref = typeof params.reference === "string" ? params.reference : null;
    if (ref && handledRef.current !== ref) { handledRef.current = ref; confirmReference(ref); }
  }, [params.reference]);   // eslint-disable-line react-hooks/exhaustive-deps

  const pay = useMutation({
    mutationFn: async ({ id, provider }: { id: string; provider: string }) => {
      setPayingId(id);
      if (provider === "remita") {
        const res = await api.post("/payments/remita/initiate", { invoice_id: id }).then((r) => r.data);
        if (!res?.payment_url) throw new Error(res?.message || "Could not start payment.");
        await WebBrowser.openBrowserAsync(res.payment_url);
        refreshNow(true);
        return;
      }
      // Card: the gateway sends the parent back INTO the app (fairview://fees, or
      // exp://.../fees in Expo Go) with the reference, instead of to the web portal
      // where they aren't signed in.
      const native = Platform.OS !== "web";
      const returnUrl = Linking.createURL("fees");
      const res = await api.post("/payments/fees/initiate", { invoice_id: id, provider, ...(native ? { app_return_url: returnUrl } : {}) }).then((r) => r.data);
      const url: string | undefined = res?.authorization_url || res?.payment_url;
      if (!url) throw new Error(res?.message || "Could not start payment.");
      const result = native ? await WebBrowser.openAuthSessionAsync(url, returnUrl) : await WebBrowser.openBrowserAsync(url);
      if (result.type === "success" && "url" in result) {
        const ref = Linking.parse(result.url).queryParams?.reference;
        handledRef.current = typeof ref === "string" ? ref : res.reference;
        await confirmReference(handledRef.current as string);
      } else if (res?.reference) {
        // Closed the browser without coming back (paid then closed, or gave up): check anyway.
        await confirmReference(res.reference);
      }
    },
    onError: (e) => Alert.alert("Payment", e instanceof Error && !("response" in e) ? e.message : errorText(e, "Could not start payment.")),
    onSettled: () => setPayingId(null),
  });

  if (inv.isLoading || prov.isLoading) return <Loading />;
  if (inv.isError) return <ErrorBox text="Couldn't load your invoices." onRetry={() => inv.refetch()} />;
  const list = inv.data ?? [];
  const payments = hist.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => refreshNow(true)} />}>
        <H1>Pay fees</H1>
        <Muted>Outstanding invoices for your children. Pay securely online.</Muted>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh payments" onPress={() => refreshNow(false)} disabled={refresh.isPending}
          style={({ pressed }) => ({ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", opacity: pressed || refresh.isPending ? 0.6 : 1 })}>
          <Ionicons name="refresh" size={17} color={colors.brand} />
          <Text style={{ fontWeight: "800", color: colors.brand, fontSize: 14 }}>{refresh.isPending ? "Checking your payments…" : "Refresh payments"}</Text>
        </Pressable>

        {providers.length > 1 && list.length > 0 && (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {providers.map((p) => (
              <Text key={p} onPress={() => setChosen(p)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, overflow: "hidden", fontWeight: "800", borderWidth: 1, borderColor: provider === p ? colors.brand : colors.border, backgroundColor: provider === p ? colors.brand : "#fff", color: provider === p ? "#fff" : colors.text }}>{LABEL[p] ?? p}</Text>
            ))}
          </View>
        )}

        {list.length === 0 ? <Card><Empty title="No outstanding fees 🎉" sub="You're all settled up." /></Card> : provider === null ? <Card><Empty title="Online payment isn't set up yet" sub="Please contact the school to pay your fees." /></Card> : list.map((i) => (
          <Card key={i.id} style={{ gap: 10 }}>
            <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text }}>{i.student_name || i.customer_name}</Text>
            <Muted>Invoice {i.number}{i.invoice_date ? ` · ${fmtDate(i.invoice_date)}` : ""}</Muted>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>{naira(Number(i.total))}</Text>
              <Pill text="Outstanding" color={colors.amber} />
            </View>
            <Button title={`Pay with ${LABEL[provider] ?? provider}`} loading={payingId === i.id && pay.isPending} disabled={pay.isPending} onPress={() => pay.mutate({ id: i.id, provider })} />
          </Card>
        ))}

        <View style={{ marginTop: 10, gap: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>Payment history</Text>
          <Muted>Each payment shows when it was confirmed and its reference. A screenshot of a card is your proof of payment.</Muted>
        </View>
        {hist.isLoading ? <Loading /> : hist.isError ? (
          <Card style={{ gap: 10 }}><Muted>Couldn’t load your payment history.</Muted><Button title="Try again" onPress={() => hist.refetch()} /></Card>
        ) : payments.length === 0 ? <Card><Muted>No payments yet.</Muted></Card> : payments.map((p) => {
          const s = STATUS[p.status] ?? { text: p.status, color: colors.muted };
          const isNew = highlight === p.reference;
          return (
            <Card key={`${p.provider}-${p.reference}`} style={{ gap: 10, ...(isNew ? { borderColor: colors.green, borderWidth: 2 } : {}) }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>{p.student_name || "—"}</Text>
                  <Muted>{p.invoice_number ? `Invoice ${p.invoice_number}` : "School fees"}</Muted>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>{naira(p.amount_ngn)}</Text>
                  <Pill text={s.text} color={s.color} />
                </View>
              </View>
              <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <Row k={p.status === "paid" ? "Paid on" : "Started"} v={(p.status === "paid" ? fmtDate(p.paid_at, { time: true }) : fmtDate(p.started_at, { time: true })) || "—"} />
                <Row k="Reference" v={p.reference} mono />
                <Row k="Paid via" v={`${LABEL[p.provider] ?? p.provider}${p.method ? ` · ${p.method}` : ""}`} />
                {p.paid_by ? <Row k="Paid by" v={p.paid_by} /> : null}
              </View>
              {p.status === "pending" ? <Text style={{ fontSize: 12, color: colors.amber }}>If money left your account, tap Refresh payments. It can take a few minutes to confirm.</Text> : null}
            </Card>
          );
        })}
        <Muted>Payments are processed securely by the school’s payment provider. After paying you’re brought back here automatically.</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}
