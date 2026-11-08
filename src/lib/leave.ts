import { api, Me } from "./api";

export type LeaveType = "annual" | "casual" | "sick" | "maternity" | "paternity" | "bereavement" | "unpaid" | "other";
export interface LeaveApp {
  id: string; user_id: string; applicant_name?: string | null; leave_type: LeaveType;
  start_date: string; end_date: string; days: number; reason?: string | null;
  status: "pending" | "approved" | "rejected"; approver_name?: string | null; decision_note?: string | null; created_at?: string | null;
}
export interface Entitlement { leave_type: LeaveType; label: string; allocated: number; used: number; remaining: number }

export const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "Annual", casual: "Casual", sick: "Sick", maternity: "Maternity", paternity: "Paternity",
  bereavement: "Bereavement", unpaid: "Unpaid", other: "Other",
};

export const canApproveLeave = (me: Me | null) => !!me && (me.permissions?.includes("*") || me.permissions?.includes("hr:write") || me.permissions?.includes("hr:*") || me.permissions?.includes("users:write"));

// Dates travel as YYYY-MM-DD in local time (no time zone shifts).
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
/** Calendar days, counting both ends — the same way the server counts. */
export const spanDays = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000) + 1;

export const leaveApi = {
  mine: () => api.get<LeaveApp[]>("/leave/applications", { params: { mine: true, limit: 100 } }).then((r) => r.data ?? []),
  pending: () => api.get<LeaveApp[]>("/leave/applications", { params: { status: "pending", limit: 100 } }).then((r) => r.data ?? []),
  balances: () => api.get<Entitlement[]>("/leave/entitlements").then((r) => r.data ?? []),
  apply: (b: { leave_type: LeaveType; start_date: string; end_date: string; reason?: string }) =>
    api.post<LeaveApp>("/leave/applications", b).then((r) => r.data),
  approve: (id: string, note?: string) => api.patch(`/leave/applications/${id}/approve`, { decision_note: note || undefined }).then((r) => r.data),
  reject: (id: string, note?: string) => api.patch(`/leave/applications/${id}/reject`, { decision_note: note || undefined }).then((r) => r.data),
};
