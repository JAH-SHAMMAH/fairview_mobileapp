export const colors = {
  brand: "#0E3B2C",
  brandSoft: "#14543F",
  bg: "#F6F4EC",
  card: "#FFFFFF",
  border: "#E4E1D4",
  text: "#14291F",
  muted: "#6B7A72",
  amber: "#F59E0B",
  green: "#10B981",
  red: "#E11D48",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  rose: "#F43F5E",
};
export const naira = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

// "Mr Chinedu Eze" -> "Chinedu", "Director Adaeze Okafor" -> "Adaeze". The greeting
// used the first word, so titled names said "Good afternoon, Mr".
const TITLES = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "prof", "sir", "madam", "master", "rev", "pastor",
  "chief", "engr", "barr", "hon", "alhaji", "alhaja", "director", "principal", "head", "teacher", "mallam", "mal"]);
export function firstName(full?: string | null): string {
  const words = (full || "").split(/\s+/).filter(Boolean);
  const real = words.find((w) => !TITLES.has(w.replace(/\./g, "").toLowerCase()));
  return real ?? words[0] ?? "";
}

// One date style everywhere: "8 Nov 2026" / "Sun 8 Nov 2026" / "8 Nov 2026, 14:05".
// Fixed to en-GB because the phone's own locale is often en-US (11/8/2026 reads as
// 11 August to a Nigerian parent).
export function fmtDate(v: string | number | Date | null | undefined, opts: { time?: boolean; weekday?: boolean } = {}): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    ...(opts.weekday ? { weekday: "short" as const } : {}),
    day: "numeric", month: "short", year: "numeric",
    ...(opts.time ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
  });
}
