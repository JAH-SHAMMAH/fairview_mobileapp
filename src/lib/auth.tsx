import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setSignedOutHandler, tokens, Me } from "./api";

interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const signOut = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch {}
    await tokens.clear();
    qc.clear();
    setMe(null);
  }, [qc]);

  useEffect(() => {
    setSignedOutHandler(() => { qc.clear(); setMe(null); });
    (async () => {
      const { access } = await tokens.get();
      if (access) {
        try { setMe((await api.get("/auth/me")).data); } catch {}
      }
      setLoading(false);
    })();
  }, [qc]);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email: email.trim().toLowerCase(), password });
    await tokens.set(r.data.access_token, r.data.refresh_token);
    qc.clear();
    setMe(r.data.user);
  }, [qc]);

  return <Ctx.Provider value={{ me, loading, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
