/// <reference types="jest" />
import { firstName, fmtDate, naira } from "../src/lib/theme";

describe("firstName — the home screen greeting", () => {
  it("skips titles so the greeting is the person's name", () => {
    expect(firstName("Mr Chinedu Eze")).toBe("Chinedu");
    expect(firstName("Mrs. Funmi Adeyemi")).toBe("Funmi");
    expect(firstName("Dr Ngozi Okonkwo-Iweala")).toBe("Ngozi");
    expect(firstName("Director Adaeze Okafor")).toBe("Adaeze");
    expect(firstName("Alhaji Musa Bello")).toBe("Musa");
  });
  it("leaves plain names alone and copes with nothing", () => {
    expect(firstName("Amara Eze")).toBe("Amara");
    expect(firstName("  Kelechi   Eze ")).toBe("Kelechi");
    expect(firstName("Mr")).toBe("Mr");
    expect(firstName("")).toBe("");
    expect(firstName(null)).toBe("");
  });
});

describe("fmtDate — one date style for Nigerian readers", () => {
  it("writes day month year, never US month/day", () => {
    expect(fmtDate("2026-11-08T13:05:00Z")).toMatch(/^8 Nov 2026$/);
  });
  it("adds the weekday and time when asked", () => {
    expect(fmtDate("2026-11-08T12:00:00Z", { weekday: true })).toMatch(/^Sun,? 8 Nov 2026$/);
    expect(fmtDate("2026-11-08T13:05:00Z", { time: true })).toMatch(/^8 Nov 2026,? \d{2}:\d{2}$/);
  });
  it("returns an empty string for missing or invalid dates instead of 'Invalid Date'", () => {
    expect(fmtDate(null)).toBe("");
    expect(fmtDate("")).toBe("");
    expect(fmtDate("not a date")).toBe("");
  });
});

it("formats naira", () => {
  expect(naira(475000)).toBe("₦475,000");
});
