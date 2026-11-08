import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { Button, ErrorBox, Loading } from "../src/components/ui";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Guard() {
  const { me, loading, bootError, retry, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading || bootError) return;
    const onLogin = segments[0] === "login";
    if (!me && !onLogin) router.replace("/login");
    else if (me && onLogin) router.replace("/");
  }, [me, loading, bootError, segments, router]);
  if (loading) return <Loading />;
  if (bootError && !me) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F6F4EC", paddingBottom: 48, paddingHorizontal: 24 }}>
        <ErrorBox text={bootError} onRetry={retry} />
        <Button title="Sign in with a different account" color="#6B7A72" onPress={signOut} />
      </View>
    );
  }
  return <Slot />;
}

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Guard />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
