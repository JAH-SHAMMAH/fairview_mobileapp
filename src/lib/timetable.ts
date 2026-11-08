import { Slot } from "./api";

// The server numbers days Monday = 0 ... Friday = 4 (Python's weekday()).
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** Today as Monday = 0; Saturday/Sunday give 5/6 (no school-day tab). */
export const todayIndex = (d = new Date()) => (d.getDay() + 6) % 7;

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

export function groupByDay(slots: Slot[]): Record<number, Slot[]> {
  const out: Record<number, Slot[]> = {};
  for (const s of slots) (out[s.day_of_week] ??= []).push(s);
  for (const k of Object.keys(out)) out[+k].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  return out;
}

/** The lesson happening right now, if any. */
export function nowSlot(daySlots: Slot[], now = new Date()): Slot | null {
  const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return daySlots.find((s) => hhmm(s.start_time) <= t && t < hhmm(s.end_time)) ?? null;
}
