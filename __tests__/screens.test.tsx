/// <reference types="jest" />
// The new screens, driven like a person would: change password, add/edit users,
// backup access, and file answers in an exam.
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
const mockSignOut = jest.fn();
jest.mock("../src/lib/auth", () => ({ useAuth: () => ({ me: mockMe, refreshMe: mockRefreshMe, signOut: mockSignOut }) }));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock("../src/lib/confirm", () => ({ confirmAction: jest.fn().mockResolvedValue(true), notify: jest.fn() }));
jest.mock("../src/lib/push", () => ({
  getPushStatus: () => "on", whenPushSettled: () => null, pushUnsupportedReason: () => null, registerForPush: jest.fn(),
}));
jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: { cache: "/cache" } }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
const mockPickDoc = jest.fn();
jest.mock("expo-document-picker", () => ({ getDocumentAsync: (o: unknown) => mockPickDoc(o) }));
jest.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn() }));

import ChangePassword from "../app/change-password";
import NewUser from "../app/(app)/users/new";
import UserDetail from "../app/(app)/users/[id]";
import Account from "../app/(app)/account";
import Backup from "../app/(app)/backup";
import ExamRoom from "../app/(app)/exam/[id]";

const wrap = (el: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } } })}>{el}</QueryClientProvider>);
const person = (permissions: string[], extra: object = {}) => ({ id: "me", email: "me@x.ng", full_name: "Ada Admin", avatar_url: null, primary_role: "org_admin", permissions, ...extra });

const ROLES = { items: [{ id: "r-t", name: "Teacher", slug: "teacher" }, { id: "r-p", name: "Parent", slug: "parent" }] };
const SECTIONS = [{ id: "s-p", name: "Primary" }, { id: "s-s", name: "Secondary" }];

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockGet.mockImplementation(async (url: string) => {
    if (url === "/users/roles/available") return { data: ROLES };
    if (url === "/platform/sections") return { data: SECTIONS };
    if (url === "/users/u1") return { data: { id: "u1", email: "bola@x.ng", full_name: "Bola Ade", status: "active", roles: [{ id: "r-p", name: "Parent", slug: "parent" }] } };
    if (url === "/analytics/audit-log") return { data: [{ id: "a1", action: "data.exported", resource_type: "database", actor_email: "dir@x.ng", created_at: "2026-11-01T10:00:00Z" }] };
    throw new Error(`unexpected GET ${url}`);
  });
});

describe("change password", () => {
  it("forced after a reset: explains why, checks the rules, saves and refreshes", async () => {
    mockMe = person([], { force_password_change: true });
    mockPost.mockResolvedValue({ data: { changed: true } });
    await wrap(<ChangePassword />);
    expect(screen.getByText(/password was reset by the school/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Current password"), "TempPass9");
    await fireEvent.changeText(screen.getByLabelText("New password"), "weak");
    await fireEvent.press(screen.getByText("Save new password"));
    expect(screen.getByText(/needs at least 8 characters, one capital letter, one number/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("New password"), "MyOwnPass8");
    await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "MyOwnPass9");
    await fireEvent.press(screen.getByText("Save new password"));
    expect(screen.getByText("The two new passwords don't match.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "MyOwnPass8");
    await fireEvent.press(screen.getByText("Save new password"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/auth/change-password", { current_password: "TempPass9", new_password: "MyOwnPass8" }));
    expect(await screen.findByText("Password changed ✓")).toBeTruthy();
    expect(mockRefreshMe).toHaveBeenCalled();
    expect(screen.getByText("Sign out")).toBeTruthy(); // no way round it but signing out
  });

  it("shows the server's reason when the current password is wrong", async () => {
    mockMe = person([]);
    mockPost.mockRejectedValue({ response: { data: { detail: "Current password is incorrect." } } });
    await wrap(<ChangePassword />);
    await fireEvent.changeText(screen.getByLabelText("Current password"), "nope");
    await fireEvent.changeText(screen.getByLabelText("New password"), "MyOwnPass8");
    await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "MyOwnPass8");
    await fireEvent.press(screen.getByText("Save new password"));
    expect(await screen.findByText("Current password is incorrect.")).toBeTruthy();
  });
});

describe("account", () => {
  it("a parent sees only Change password", async () => {
    mockMe = person(["school:fees:pay"]);
    await wrap(<Account />);
    expect(screen.getByText("Change password")).toBeTruthy();
    expect(screen.queryByText("Manage users")).toBeNull();
    expect(screen.queryByText("Backup")).toBeNull();
  });
  it("an admin sees Manage users but not Backup", async () => {
    mockMe = person(["users:write"]);
    await wrap(<Account />);
    expect(screen.getByText("Manage users")).toBeTruthy();
    expect(screen.queryByText("Backup")).toBeNull();
  });
  it("the Director also sees Backup", async () => {
    mockMe = person(["*"]);
    await wrap(<Account />);
    expect(screen.getByText("Backup")).toBeTruthy();
    await fireEvent.press(screen.getByText("Manage users"));
    expect(mockRouter.push).toHaveBeenCalledWith("/users");
  });
});

describe("add a user", () => {
  it("a teacher needs a section; the account is created with it and the password is shown to share", async () => {
    mockMe = person(["users:write"]);
    mockPost.mockResolvedValue({ data: { id: "new1", email: "chi@x.ng", full_name: "Chi Obi", status: "active", roles: [] } });
    await wrap(<NewUser />);
    await screen.findByText("Add a user");
    await fireEvent.changeText(screen.getByLabelText("Full name"), "Chi Obi");
    await fireEvent.changeText(screen.getByLabelText("Email"), "Chi@X.ng ");
    await fireEvent.changeText(screen.getByLabelText("Password"), "StartHere5");
    await fireEvent.press(screen.getByLabelText("Teacher"));
    await fireEvent.press(screen.getByText("Create account"));
    expect(screen.getByText("Choose at least one section for a teacher.")).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Primary"));
    await fireEvent.press(screen.getByText("Create account"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/users", expect.objectContaining({
      full_name: "Chi Obi", email: "chi@x.ng", password: "StartHere5", role_ids: ["r-t"], section_ids: ["s-p"],
    })));
    expect(await screen.findByText("Chi Obi has been added")).toBeTruthy();
    expect(screen.getByText("StartHere5")).toBeTruthy();
  });

  it("an empty password means an email invite", async () => {
    mockMe = person(["users:write"]);
    mockPost.mockResolvedValue({ data: { id: "n2", email: "p@x.ng", full_name: "Pat", status: "pending", roles: [] } });
    await wrap(<NewUser />);
    await screen.findByText("Add a user");
    await fireEvent.changeText(screen.getByLabelText("Full name"), "Pat");
    await fireEvent.changeText(screen.getByLabelText("Email"), "p@x.ng");
    await fireEvent.press(screen.getByText("Email invite"));
    await fireEvent.press(screen.getByLabelText("Parent"));
    await fireEvent.press(screen.getByText("Create account"));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/users", expect.objectContaining({ password: undefined, section_ids: [] })));
    expect(await screen.findByText(/get an email to set their own password/)).toBeTruthy();
  });

  it("non-admins are turned away", async () => {
    mockMe = person(["users:read"]);
    await wrap(<NewUser />);
    expect(screen.getByText("Only school admins can add users.")).toBeTruthy();
  });
});

describe("edit a user", () => {
  it("making a parent a teacher saves the section BEFORE the role (server rule)", async () => {
    mockMe = person(["users:write"]);
    mockParams = { id: "u1" };
    const order: string[] = [];
    mockPatch.mockImplementation(async (url: string) => { order.push(`PATCH ${url}`); return { data: {} }; });
    mockPut.mockImplementation(async (url: string) => { order.push(`PUT ${url}`); return { data: {} }; });
    await wrap(<UserDetail />);
    await screen.findByText("bola@x.ng");
    await fireEvent.press(screen.getByLabelText("Teacher"));
    await fireEvent.press(screen.getByLabelText("Secondary"));
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(order).toEqual(["PATCH /users/u1", "PUT /users/u1/sections", "PATCH /users/u1/roles"]));
    expect(mockPut).toHaveBeenCalledWith("/users/u1/sections", ["s-s"]);
    expect(mockPatch).toHaveBeenCalledWith("/users/u1/roles", ["r-p", "r-t"]);
    expect(await screen.findByText("Saved ✓")).toBeTruthy();
  });

  it("suspend and reset password", async () => {
    mockMe = person(["users:write"]);
    mockParams = { id: "u1" };
    mockPatch.mockResolvedValue({ data: {} });
    mockPost.mockResolvedValue({ data: { temporary_password: "tmp-XYZ123", force_password_change: true } });
    await wrap(<UserDetail />);
    await screen.findByText("bola@x.ng");
    await fireEvent.press(screen.getByText("Suspend"));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith("/users/u1/status", { status: "suspended" }));
    await fireEvent.press(screen.getByText("Reset password"));
    expect(await screen.findByText("tmp-XYZ123")).toBeTruthy();
    expect(mockPost).toHaveBeenCalledWith("/users/u1/reset-password");
  });
});

describe("backup", () => {
  it("is refused for anyone but the Director", async () => {
    mockMe = person(["users:write", "settings:write"]);
    await wrap(<Backup />);
    expect(screen.getByText("Only the Director account can download a backup.")).toBeTruthy();
  });
  it("asks for the password and lists recent backups", async () => {
    mockMe = person(["*"]);
    await wrap(<Backup />);
    expect(await screen.findByText(/dir@x.ng/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Make backup"));
    expect(screen.getByText("Enter your password to confirm it's you.")).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("exam file answers", () => {
  it("a file question offers photo/file upload and attaches the uploaded file as the answer", async () => {
    mockMe = person(["school:cbt:sit"]);
    mockParams = { id: "e1" };
    mockGet.mockImplementation(async (url: string) => {
      if (url === "/cbt/exams/e1") return { data: { id: "e1", title: "Maths", duration_minutes: 30 } };
      if (url === "/cbt/exams/e1/questions") return { data: { items: [{ id: "q1", question_text: "Show your working", question_type: "long_answer", answer_type: "file", points: 5 }] } };
      throw new Error(url);
    });
    mockPost.mockImplementation(async (url: string, body?: any) => {
      if (url === "/cbt/exams/e1/attempts") return { data: { id: "at1", deadline: null } };
      if (url === "/cbt/attempts/at1/submit") return { data: { id: "at1", score: null, body } };
      throw new Error(url);
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ url: "/uploads/exam/abc.pdf", filename: "work.pdf" }) });
    (globalThis as any).fetch = fetchMock;
    mockPickDoc.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///work.pdf", name: "work.pdf", mimeType: "application/pdf", size: 2048 }] });

    await wrap(<ExamRoom />);
    await fireEvent.press(await screen.findByText("Start exam"));
    expect(await screen.findByText("Take a photo")).toBeTruthy();
    expect(screen.queryByText(/answer it in the web portal/)).toBeNull();
    await fireEvent.press(screen.getByText("Choose a file"));
    expect(await screen.findByText(/Attached: work.pdf/)).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/api/v1/upload/exam-answer");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.body).toBeInstanceOf(FormData);
  });
});
