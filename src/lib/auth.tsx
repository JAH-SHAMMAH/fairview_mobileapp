import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api, errorText, setSignedOutHandler, tokens, Me } from "./api";

interface AuthState {
  me: Me | null;
  loading: boolean;
  /** Set when the saved session could not be checked (server asleep, no signal). */
  bootError: string | null;
  retry: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const qc = useQueryClient();

  const signOut = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch {}
    await tokens.clear();
    qc.clear();
    setBootError(null);
    setMe(null);
  }, [qc]);

  // Restore the saved session. Only a real "not signed in" answer (401/403, after
  // the interceptor has already tried the refresh token) signs the user out. A
  // timeout or network error used to do the same, so a parent opening the app while
  // the free-tier server was waking up was dropped on the login screen with a
  // perfectly valid session. Now they get "Can't reach the server" and a retry.
  const restore = useCallback(async () => {
    const { access, refresh } = await tokens.get();
    if (access || refresh) {
      try {
        setMe((await api.get("/auth/me")).data);
      } catch (e) {
        const status = (e as AxiosError)?.response?.status;
        if (status === 401 || status === 403) await tokens.clear();
        else setBootError(errorText(e));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => { qc.clear(); setMe(null); });
    restore();   // `loading` starts true, so the first run needs no reset
  }, [qc, restore]);

  const retry = useCallback(() => {
    setLoading(true);
    setBootError(null);
    restore();
  }, [restore]);

  const signIn = useCallback(async (email: string, password: string) => {
    setBootError(null);
    const r = await api.post("/auth/login", { email: email.trim().toLowerCase(), password });
    await tokens.set(r.data.access_token, r.data.refresh_token);
    qc.clear();
    setMe(r.data.user);
  }, [qc]);

  return <Ctx.Provider value={{ me, loading, bootError, retry, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
