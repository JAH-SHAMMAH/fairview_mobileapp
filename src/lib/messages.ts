// Communication Book: short notes between home and school about one pupil.
// Parents use /office/commbook/mine (only their own children); staff use the
// school-wide /office/commbook/entries.
import { api, Me } from "./api";

export interface Entry {
  id: string; student_id: string; student_id_name?: string | null; entry_date: string;
  category: string; message: string; direction: "school_to_home" | "home_to_school";
  author?: string | null; acknowledged: boolean; reply?: string | null; created_at?: string | null;
}

export const CATEGORIES: { key: string; label: string }[] = [
  { key: "general", label: "General" }, { key: "homework", label: "Homework" },
  { key: "behaviour", label: "Behaviour" }, { key: "health", label: "Health" },
  { key: "achievement", label: "Well done" }, { key: "reminder", label: "Reminder" },
];
export const categoryLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? "General";

export const isStaffMessenger = (me: Me | null) =>
  !!me && (me.permissions?.includes("*") || me.permissions?.includes("school:*") || me.permissions?.includes("school:reports:write"));

/** An entry still waiting on the person looking at it. */
export const needsMe = (e: Entry, asParent: boolean) =>
  !e.acknowledged && (asParent ? e.direction === "school_to_home" : e.direction === "home_to_school");

export const parentMsgs = {
  list: () => api.get<{ items: Entry[] }>("/office/commbook/mine").then((r) => r.data.items ?? []),
  send: (student_id: string, message: string, category: string) =>
    api.post<Entry>("/office/commbook/mine", { student_id, message, category }).then((r) => r.data),
  /** Mark as read, with an optional reply. */
  ack: (id: string, reply: string) => api.put<Entry>(`/office/commbook/mine/${id}/ack`, { reply }).then((r) => r.data),
};

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export const staffMsgs = {
  list: () => api.get<{ items: Entry[] }>("/office/commbook/entries").then((r) => r.data.items ?? []),
  send: (student_id: string, message: string, category: string) =>
    api.post<Entry>("/office/commbook/entries", { student_id, message, category, entry_date: today() }).then((r) => r.data),
  reply: (id: string, reply: string) =>
    api.put<Entry>(`/office/commbook/entries/${id}`, { reply, acknowledged: true }).then((r) => r.data),
};
