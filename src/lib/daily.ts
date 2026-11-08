import { api, Me } from "./api";

export interface DailyReport {
  id: string; student_id: string; student_name?: string | null; author_id?: string | null;
  report_date: string; mood?: string | null; academic?: string | null; behaviour?: string | null; notes?: string | null;
  created_at?: string;
}
export interface DailyDraft { mood: string; academic: string; behaviour: string; notes: string }

/** Same moods the web portal offers. */
export const MOODS: { key: string; emoji: string; label: string }[] = [
  { key: "happy", emoji: "😊", label: "Happy" },
  { key: "excited", emoji: "🤩", label: "Excited" },
  { key: "neutral", emoji: "😐", label: "Okay" },
  { key: "tired", emoji: "😴", label: "Tired" },
  { key: "sad", emoji: "😢", label: "Sad" },
];
export const moodOf = (k?: string | null) => MOODS.find((m) => m.key === k);

export const canWriteDaily = (me: Me | null) => !!me && (me.permissions?.includes("*") || me.permissions?.includes("school:feedback:write") || me.permissions?.includes("school:*"));

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const isBlank = (d: DailyDraft) => !d.mood && !d.academic.trim() && !d.behaviour.trim() && !d.notes.trim();

export const dailyApi = {
  forChild: (studentId: string) =>
    api.get<{ items: DailyReport[] }>(`/feedback/student-daily-reports/student/${studentId}`).then((r) => r.data.items ?? []),
  forClassDay: (classId: string, date: string) =>
    api.get<{ items: DailyReport[] }>("/feedback/student-daily-reports", { params: { class_id: classId, report_date: date } }).then((r) => r.data.items ?? []),
  save: (studentId: string, date: string, d: DailyDraft, existingId?: string) => {
    const body = { mood: d.mood || null, academic: d.academic.trim() || null, behaviour: d.behaviour.trim() || null, notes: d.notes.trim() || null };
    return existingId
      ? api.patch<DailyReport>(`/feedback/student-daily-reports/${existingId}`, body).then((r) => r.data)
      : api.post<DailyReport>("/feedback/student-daily-reports", { student_id: studentId, report_date: date, ...body }).then((r) => r.data);
  },
};
