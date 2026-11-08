// Staff/parent/student accounts — the mobile side of the web "Users" page.
// Every call is checked again on the server (users:read / users:write, plus the
// guards that stop anyone granting roles above their own).
import { api, Me } from "./api";
import { colors } from "./theme";

export type UserStatus = "active" | "inactive" | "suspended" | "pending" | "locked";
export interface RoleRef { id: string; name: string; slug: string; color?: string | null }
export interface AppUser {
  id: string; email: string; full_name: string; phone?: string | null; department?: string | null;
  job_title?: string | null; status: UserStatus; last_login_at?: string | null; created_at?: string;
  roles: RoleRef[];
}
export interface UserPage { items: AppUser[]; total: number; page: number; page_size: number; total_pages: number }
export interface Section { id: string; name: string }

/** Mirror of TEACHING_ROLE_SLUGS in the backend: these roles must belong to a school section. */
export const TEACHING_ROLE_SLUGS = [
  "teacher", "instructor", "head_teacher", "academic_coordinator",
  "head_of_department_secondary", "head_of_early_years", "homeroom_coordinator",
  "exam_subject_head", "spa_officer", "spa_manager",
];
export const isTeachingRole = (slug?: string | null) => !!slug && TEACHING_ROLE_SLUGS.includes(slug.toLowerCase());

export const canManageUsers = (me: Me | null) => !!me && (me.permissions?.includes("*") || me.permissions?.includes("users:write"));
export const canDeleteUsers = (me: Me | null) => !!me && (me.permissions?.includes("*") || me.permissions?.includes("users:delete"));

export const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active", inactive: "Inactive", suspended: "Suspended", pending: "Invited", locked: "Locked",
};

export const statusColor = (s: UserStatus) =>
  s === "active" ? colors.green : s === "pending" ? colors.indigo : s === "locked" || s === "suspended" ? colors.red : colors.muted;

export const usersApi = {
  list: (p: { page?: number; search?: string; status?: UserStatus | "" }) =>
    api.get<UserPage>("/users", { params: { page: p.page ?? 1, page_size: 30, search: p.search || undefined, status: p.status || undefined } }).then((r) => r.data),
  get: (id: string) => api.get<AppUser>(`/users/${id}`).then((r) => r.data),
  roles: () => api.get<{ items: RoleRef[] }>("/users/roles/available").then((r) => r.data.items ?? []),
  sections: () => api.get<Section[]>("/platform/sections").then((r) => (Array.isArray(r.data) ? r.data : [])),
  /** A teacher's current sections; anyone else has none (the server answers 404). */
  sectionsOf: (id: string) => api.get(`/school/teachers/${id}`).then((r) => (r.data?.section_ids ?? []) as string[]).catch(() => [] as string[]),
  create: (body: { email: string; full_name: string; password?: string; phone?: string; job_title?: string; role_ids: string[]; section_ids: string[] }) =>
    api.post<AppUser>("/users", body).then((r) => r.data),
  update: (id: string, body: { full_name: string; phone: string | null; department: string | null; job_title: string | null }) =>
    api.patch<AppUser>(`/users/${id}`, body).then((r) => r.data),
  setStatus: (id: string, status: UserStatus) => api.patch<AppUser>(`/users/${id}/status`, { status }).then((r) => r.data),
  setRoles: (id: string, roleIds: string[]) => api.patch<AppUser>(`/users/${id}/roles`, roleIds).then((r) => r.data),
  setSections: (id: string, sectionIds: string[]) => api.put(`/users/${id}/sections`, sectionIds).then((r) => r.data),
  resetPassword: (id: string) => api.post<{ temporary_password: string; force_password_change: boolean }>(`/users/${id}/reset-password`).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

/** Server messages sometimes start with the field name ("section_ids: ..."); drop it. */
export const tidy = (t: string) => t.replace(/^[a-z_]+:\s*/i, "").replace(/^./, (c) => c.toUpperCase());
