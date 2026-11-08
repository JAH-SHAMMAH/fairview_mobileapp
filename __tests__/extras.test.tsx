/// <reference types="jest" />
// Timetable, daily reports, messages, leave and profile — driven like a person would.
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockPut = jest.fn();
jest.mock("../src/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a), put: (...a: unknown[]) => mockPut(...a), delete: jest.fn(),
  },
  API_URL: "https://example.test",
  tokens: { get: async () => ({ access: "tok", refresh: "r" }) },
  errorText: (e: any, fb = "err") => (typeof e?.response?.data?.detail === "string" ? e.response.data.detail : fb),
}));

let mockMe: any = null;
const mockRefreshMe = jest.fn().mockResolvedValue(undefined);
jest.mock("../src/lib/auth", () => ({ useAuth: () => ({ me: mockMe, refreshMe: mockRefreshMe }) }));
let mockRole: any = { role: "parent", ctx: null, isLoading: false, isError: false, refetch: jest.fn() };
jest.mock("../src/lib/role", () => ({ useRole: () => mockRole }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock("../src/lib/confirm", () => ({ confirmAction: jest.fn().mockResolvedValue(true), notify: jest.fn() }));
jest.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));

import Timetable from "../app/(app)/timetable";
import DailyReports from "../app/(app)/daily";
import Messages from "../app/(app)/messages";
import Leave from "../app/(app)/leave";
import MyProfile from "../app/(app)/profile";
import { groupByDay, nowSlot, todayIndex } from "../src/lib/timetable";
import { addDays, spanDays } from "../src/lib/leave";
import { routeForAlert } from "../src/lib/push";

jest.mock("expo-notifications", () => ({}));
jest.mock("expo-device", () => ({ isDevice: false }));

const wrap = (el: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })}>{el}</QueryClientProvider>);
const person = (permissions: string[], primary_role = "teacher") => ({ id: "me", email: "me@x.ng", full_name: "Ada Obi", avatar_url: null, primary_role, permissions });
const slot = (id: string, day: number, start: string, end: string, subject: string, extra = {}) => ({ id, day_of_week: day, start_time: start, end_time: end, subject_name: subject, room: null, ...extra });

beforeEach(() => { jest.clearAllMocks(); });

describe("helpers", () => {
  it("timetable days run Monday=0 and lessons sort by time; finds the current lesson", () => {
    expect(todayIndex(new Date(2026, 10, 9))).toBe(0); // Monday 9 Nov 2026
    expect(todayIndex(new Date(2026, 10, 8))).toBe(6); // Sunday
    const g = groupByDay([slot("b", 0, "10:00", "10:40", "B"), slot("a", 0, "08:00", "08:40", "A")]);
    expect(g[0].map((s) => s.id)).toEqual(["a", "b"]);
    expect(nowSlot(g[0], new Date(2026, 10, 9, 8, 15))?.id).toBe("a");
    expect(nowSlot(g[0], new Date(2026, 10, 9, 9, 0))).toBeNull();
  });
  it("leave days count both ends, across months", () => {
    expect(spanDays("2026-11-10", "2026-11-10")).toBe(1);
    expect(spanDays("2026-11-30", "2026-12-02")).toBe(3);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("alerts for daily reports, messages and leave open the right screen", () => {
    expect(routeForAlert({ kind: "daily_report", url: "/dashboard/my-children/daily-reports" })).toBe("/daily");
    expect(routeForAlert({ kind: "message", url: "/dashboard/communication-book" })).toBe("/messages");
    expect(routeForAlert({ kind: "leave", url: "/dashboard/hrm/leave" })).toBe("/leave");
  });
});

describe("timetable", () => {
  it("a parent switches between children and days", async () => {
    mockRole = {
      role: "parent", isLoading: false, isError: false, refetch: jest.fn(),
      ctx: { as_parent: { children: [
        { id: "k1", first_name: "Tobi", last_name: "A", timetable: [slot("s1", 0, "08:00", "08:40", "Mathematics", { room: "Lab 2" }), slot("s2", 1, "09:00", "09:40", "English")] },
        { id: "k2", first_name: "Zara", last_name: "A", timetable: [slot("s3", 0, "08:00", "08:40", "Basic Science")] },
      ] } },
    };
    await wrap(<Timetable />);
    await fireEvent.press(screen.getByLabelText("Monday"));
    expect(screen.getByText("Tobi's timetable")).toBeTruthy();
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.getByText("Lab 2")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Tuesday"));
    expect(screen.getByText("English")).toBeTruthy();
    await fireEvent.press(screen.getByText("Zara"));
    await fireEvent.press(screen.getByLabelText("Monday"));
    expect(screen.getByText("Basic Science")).toBeTruthy();
  });
  it("a teacher sees which class each lesson is with", async () => {
    mockRole = { role: "teacher", isLoading: false, isError: false, refetch: jest.fn(), ctx: { as_teacher: { classes: [{ id: "c1", name: "JSS2 B" }], timetable: [slot("s1", 2, "11:00", "11:40", "Physics", { class_id: "c1" })], today_slots: [] } } };
    await wrap(<Timetable />);
    await fireEvent.press(screen.getByLabelText("Wednesday"));
    expect(screen.getByText("Physics")).toBeTruthy();
    expect(screen.getByText("JSS2 B")).toBeTruthy();
  });
  it("explains when no timetable is set up", async () => {
    mockRole = { role: "student", isLoading: false, isError: false, refetch: jest.fn(), ctx: { as_student: { class: { name: "SS1" }, timetable: [], today_slots: [] } } };
    await wrap(<Timetable />);
    expect(screen.getByText("No timetable yet")).toBeTruthy();
  });
});

describe("daily reports", () => {
  it("a parent reads their child's reports", async () => {
    mockMe = person([], "parent");
    mockRole = { role: "parent", isLoading: false, isError: false, refetch: jest.fn(), ctx: { as_parent: { children: [{ id: "k1", first_name: "Tobi", last_name: "A" }] } } };
    mockGet.mockResolvedValue({ data: { items: [{ id: "r1", student_id: "k1", report_date: "2026-11-06", mood: "happy", academic: "Great at fractions", notes: "Bring PE kit" }] } });
    await wrap(<DailyReports />);
    expect(await screen.findByText("Great at fractions")).toBeTruthy();
    expect(screen.getByText("😊 Happy")).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith("/feedback/student-daily-reports/student/k1");
  });
  it("a teacher writes today's report and moves on to the next pupil", async () => {
    mockMe = person(["school:feedback:write"]);
    mockRole = { role: "teacher", isLoading: false, isError: false, refetch: jest.fn(), ctx: {} };
    mockGet.mockImplementation(async (url: string) => {
      if (url === "/school/classes") return { data: { items: [{ id: "c1", name: "Primary 3" }] } };
      if (url === "/school/students") return { data: { items: [{ id: "p1", first_name: "Ade", last_name: "B" }, { id: "p2", first_name: "Bisi", last_name: "C" }] } };
      if (url === "/feedback/student-daily-reports") return { data: { items: [] } };
      throw new Error(url);
    });
    mockPost.mockResolvedValue({ data: { id: "new" } });
    await wrap(<DailyReports />);
    expect(await screen.findByText("0 of 2 done today")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Ade B"));
    await fireEvent.press(screen.getByText("Save report"));
    expect(screen.getByText("Pick a mood or write a note first.")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Happy"));
    await fireEvent.changeText(screen.getByLabelText("Notes for parents"), "Lovely reading today");
    await fireEvent.press(screen.getByText("Save report"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/feedback/student-daily-reports", expect.objectContaining({ student_id: "p1", mood: "happy", notes: "Lovely reading today", academic: null })));
    // next pupil opens, blank
    expect(await screen.findByLabelText("Learning")).toBeTruthy();
    expect(screen.getByLabelText("Notes for parents").props.value).toBe("");
  });
});

describe("messages", () => {
  it("a parent reads a school note, replies, and writes a new one", async () => {
    mockMe = person([], "parent");
    mockRole = { role: "parent", isLoading: false, isError: false, refetch: jest.fn(), ctx: { as_parent: { children: [{ id: "k1", first_name: "Tobi", last_name: "A" }] } } };
    mockGet.mockResolvedValue({ data: { items: [{ id: "e1", student_id: "k1", student_id_name: "Tobi A", entry_date: "2026-11-07", category: "reminder", message: "Bring a recorder", direction: "school_to_home", author: "Mrs Ade", acknowledged: false }] } });
    mockPut.mockResolvedValue({ data: {} });
    mockPost.mockResolvedValue({ data: {} });
    await wrap(<Messages />);
    expect(await screen.findByText("Bring a recorder")).toBeTruthy();
    expect(screen.getByText("Unread (1)")).toBeTruthy();
    await fireEvent.press(screen.getByText("Reply"));
    await fireEvent.changeText(screen.getByLabelText("Your reply"), "Will do, thanks");
    await fireEvent.press(screen.getByText("Send reply"));
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith("/office/commbook/mine/e1/ack", { reply: "Will do, thanks" }));

    await fireEvent.press(screen.getByText("Write to the school"));
    await fireEvent.press(screen.getByText("Health"));
    await fireEvent.changeText(screen.getByLabelText("Message"), "Dentist on Friday");
    await fireEvent.press(screen.getByText("Send"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/office/commbook/mine", { student_id: "k1", message: "Dentist on Friday", category: "health" }));
  });
  it("shows the school's reason when the Communication Book is switched off", async () => {
    mockMe = person([], "parent");
    mockRole = { role: "parent", isLoading: false, isError: false, refetch: jest.fn(), ctx: { as_parent: { children: [] } } };
    mockGet.mockRejectedValue({ response: { data: { detail: "'Communication Book' has not been switched on by the Super User." } } });
    await wrap(<Messages />);
    expect(await screen.findByText(/has not been switched on/)).toBeTruthy();
  });
  it("a teacher replies to a parent's note", async () => {
    mockMe = person(["school:reports:write"]);
    mockRole = { role: "teacher", isLoading: false, isError: false, refetch: jest.fn(), ctx: {} };
    mockGet.mockResolvedValue({ data: { items: [{ id: "e2", student_id: "k1", student_id_name: "Tobi A", entry_date: "2026-11-07", category: "health", message: "Dentist Friday", direction: "home_to_school", author: "Mrs A", acknowledged: false }] } });
    mockPut.mockResolvedValue({ data: {} });
    await wrap(<Messages />);
    expect(await screen.findByText("Needs reply (1)")).toBeTruthy();
    await fireEvent.press(screen.getByText("Reply"));
    await fireEvent.changeText(screen.getByLabelText("Your reply"), "Noted, thank you");
    await fireEvent.press(screen.getByText("Send reply"));
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith("/office/commbook/entries/e2", { reply: "Noted, thank you", acknowledged: true }));
  });
});

describe("leave", () => {
  it("staff apply for leave; balances and history show", async () => {
    mockMe = person(["hr:read"]);
    mockGet.mockImplementation(async (url: string) => {
      if (url === "/leave/applications") return { data: [{ id: "l0", user_id: "me", leave_type: "sick", start_date: "2026-10-01", end_date: "2026-10-02", days: 2, status: "approved" }] };
      if (url === "/leave/entitlements") return { data: [{ leave_type: "annual", label: "Annual", allocated: 20, used: 2, remaining: 18 }] };
      throw new Error(url);
    });
    mockPost.mockResolvedValue({ data: {} });
    await wrap(<Leave />);
    expect(await screen.findByText("18")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    await fireEvent.press(screen.getByText("Apply for leave"));
    await fireEvent.press(screen.getByLabelText("Last day: day after"));
    await fireEvent.press(screen.getByLabelText("Last day: day after"));
    expect(screen.getByText("3 days")).toBeTruthy();
    await fireEvent.press(screen.getByText("Casual"));
    await fireEvent.changeText(screen.getByLabelText("Reason"), "Family event");
    await fireEvent.press(screen.getByText("Send request"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/leave/applications", expect.objectContaining({ leave_type: "casual", reason: "Family event" })));
    const body = mockPost.mock.calls[0][1];
    expect(spanDays(body.start_date, body.end_date)).toBe(3);
  });
  it("an approver sees other people's requests and approves", async () => {
    mockMe = person(["hr:write"]);
    mockGet.mockImplementation(async (url: string, cfg?: any) => {
      if (url === "/leave/applications" && cfg?.params?.status === "pending") return { data: [{ id: "l9", user_id: "u2", applicant_name: "Kemi O", leave_type: "annual", start_date: "2026-11-20", end_date: "2026-11-21", days: 2, status: "pending" }] };
      if (url === "/leave/applications") return { data: [] };
      if (url === "/leave/entitlements") return { data: [] };
      throw new Error(url);
    });
    mockPatch.mockResolvedValue({ data: {} });
    await wrap(<Leave />);
    expect(await screen.findByText("Kemi O")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Note for Kemi O"), "Enjoy");
    await fireEvent.press(screen.getByText("Approve"));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("/leave/applications/l9/approve", { decision_note: "Enjoy" }));
  });
});

describe("profile", () => {
  it("anyone can update their name and phone", async () => {
    mockMe = person([], "parent");
    mockGet.mockResolvedValue({ data: { id: "me", email: "me@x.ng", full_name: "Ada Obi", phone: null, bio: null, avatar_url: null } });
    mockPatch.mockResolvedValue({ data: {} });
    await wrap(<MyProfile />);
    expect(await screen.findByText(/me@x.ng/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Phone"), "+234 803 111 2222");
    await fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("/me/profile", { full_name: "Ada Obi", phone: "+234 803 111 2222" }));
    expect(await screen.findByText("Saved ✓")).toBeTruthy();
    expect(mockRefreshMe).toHaveBeenCalled();
  });
});
