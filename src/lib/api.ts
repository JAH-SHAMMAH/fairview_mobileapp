import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// On phones tokens live in the device keychain. expo-secure-store has no web
// implementation (it throws), so `npm run web` crashed before the login screen.
// The browser build keeps them in sessionStorage instead: gone when the tab closes.
const store = Platform.OS === "web"
  ? {
      getItemAsync: async (k: string) => { try { return globalThis.sessionStorage?.getItem(k) ?? null; } catch { return null; } },
      setItemAsync: async (k: string, v: string) => { try { globalThis.sessionStorage?.setItem(k, v); } catch {} },
      deleteItemAsync: async (k: string) => { try { globalThis.sessionStorage?.removeItem(k); } catch {} },
    }
  : SecureStore;

// Public base URL only. Tokens live in the device keychain, never in code.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://fairview-portal.onrender.com").replace(/\/$/, "");

const ACCESS = "fv_access";
const REFRESH = "fv_refresh";

export const tokens = {
  async get() {
    return { access: await store.getItemAsync(ACCESS), refresh: await store.getItemAsync(REFRESH) };
  },
  async set(access: string, refresh: string) {
    await store.setItemAsync(ACCESS, access);
    await store.setItemAsync(REFRESH, refresh);
  },
  async clear() {
    await store.deleteItemAsync(ACCESS);
    await store.deleteItemAsync(REFRESH);
  },
};

export const api = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 45_000, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const { access } = await tokens.get();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

let onSignedOut: () => void = () => {};
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

let refreshing: Promise<string | null> | null = null;
async function refreshAccess(): Promise<string | null> {
  const { refresh } = await tokens.get();
  if (!refresh) return null;
  try {
    const r = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refresh_token: refresh }, { timeout: 45_000 });
    await tokens.set(r.data.access_token, r.data.refresh_token);
    return r.data.access_token as string;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh");
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccess().finally(() => { refreshing = null; });
      const fresh = await refreshing;
      if (fresh) {
        original.headers.Authorization = `Bearer ${fresh}`;
        return api(original);
      }
      await tokens.clear();
      onSignedOut();
    }
    return Promise.reject(error);
  },
);

export function errorText(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const err = e as AxiosError<{ detail?: unknown }>;
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg);
  if (err?.code === "ECONNABORTED") return "The server took too long. It may be waking up, try again in a moment.";
  if (!err?.response) return "Can't reach the server. Check your internet connection.";
  return fallback;
}

export type Role = "admin" | "teacher" | "parent" | "student";

export interface Me {
  id: string; email: string; full_name: string; avatar_url: string | null;
  primary_role: string; permissions: string[];
  force_password_change?: boolean;
  org?: { name?: string } | null;
}

export interface ParentChild {
  id: string; student_id: string; first_name: string; last_name: string;
  photo_url: string | null; class_id: string | null; class_name: string | null;
  relationship: string; is_primary: boolean;
  stats: { attendance_pct: number | null; pending_assignments: number; latest_grade_letter: string | null; latest_grade_score: number | null };
}
export interface Slot { id: string; subject_name: string | null; start_time: string; end_time: string; room: string | null; day_of_week: number }
export interface MyContexts {
  roles: string[]; available_roles: Role[]; default_role: Role;
  as_admin: { is_admin: true } | null;
  as_teacher: { classes: { id: string; name: string }[]; today_slots: Slot[]; stats: { classes_count: number; subjects_count: number; today_lessons: number; pending_grades: number } } | null;
  as_parent: { children: ParentChild[] } | null;
  as_student: {
    student: { id: string; first_name: string; last_name: string; photo_url: string | null };
    class: { name: string } | null;
    today_slots: Slot[];
    stats: { attendance_pct: number | null; attendance_days: number; pending_assignments: number };
  } | null;
}

export const isSuperUser = (me: Me | null) => !!me && (me.primary_role === "super_user" || me.permissions?.includes("*"));
