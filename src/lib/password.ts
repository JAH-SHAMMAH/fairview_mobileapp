// Same rules the server enforces (backend app/core/security.py), checked on the
// phone first so people see what's missing before they press the button.
export function passwordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 8) out.push("at least 8 characters");
  if (!/[A-Z]/.test(pw)) out.push("one capital letter");
  if (!/[0-9]/.test(pw)) out.push("one number");
  return out;
}

/** A starting password that passes the rules and is easy to read out (no 0/O or 1/l). */
export function makeStartingPassword(rand: () => number = Math.random): string {
  const up = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const low = "abcdefghjkmnpqrstuvwxyz";
  const dig = "23456789";
  const pick = (s: string) => s[Math.floor(rand() * s.length)];
  return pick(up) + Array.from({ length: 6 }, () => pick(low)).join("") + pick(dig) + pick(dig) + pick(up);
}
