/// <reference types="jest" />
// Small rules shared by several screens: passwords, answer files, backup access, user permissions.
jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: { cache: "/cache" } }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

import { makeStartingPassword, passwordProblems } from "../src/lib/password";
import { checkAnswerFile, guessType } from "../src/lib/upload";
import { backupFileName, canBackup } from "../src/lib/backup";
import { canDeleteUsers, canManageUsers, isTeachingRole, tidy } from "../src/lib/users";
import type { Me } from "../src/lib/api";

const me = (permissions: string[]): Me => ({ id: "1", email: "a@b.c", full_name: "A", avatar_url: null, primary_role: "x", permissions });

it("password rules match the server", () => {
  expect(passwordProblems("short")).toEqual(["at least 8 characters", "one capital letter", "one number"]);
  expect(passwordProblems("Longenough1")).toEqual([]);
});

it("generated starting passwords always pass the rules", () => {
  for (let i = 0; i < 200; i++) expect(passwordProblems(makeStartingPassword())).toEqual([]);
  expect(makeStartingPassword()).not.toMatch(/[0O1lI]/);
});

it("answer files: allowed types, size limit, HEIC explained", () => {
  expect(checkAnswerFile({ uri: "x", name: "work.pdf", size: 1000 })).toBeNull();
  expect(checkAnswerFile({ uri: "x", name: "photo.jpg", mimeType: "image/jpeg" })).toBeNull();
  expect(checkAnswerFile({ uri: "x", name: "answers.docx" })).toBeNull();
  expect(checkAnswerFile({ uri: "x", name: "sheet.xlsx" })).toMatch(/PDF, Word/);
  expect(checkAnswerFile({ uri: "x", name: "big.pdf", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  expect(checkAnswerFile({ uri: "x", name: "IMG.HEIC", mimeType: "image/heic" })).toMatch(/HEIC/);
  expect(guessType({ uri: "x", name: "a.TXT", mimeType: "application/octet-stream" })).toBe("text/plain");
});

it("only the Director (*) can back up; users:write can manage users", () => {
  expect(canBackup(me(["*"]))).toBe(true);
  expect(canBackup(me(["users:write", "settings:write"]))).toBe(false);
  expect(canBackup(null)).toBe(false);
  expect(canManageUsers(me(["users:write"]))).toBe(true);
  expect(canManageUsers(me(["users:read"]))).toBe(false);
  expect(canDeleteUsers(me(["users:write"]))).toBe(false);
  expect(canDeleteUsers(me(["*"]))).toBe(true);
});

it("backup file names sort by date", () => {
  expect(backupFileName(new Date(2026, 10, 8, 9, 5))).toBe("fairview-backup-20261108-0905.jsonl.gz");
});

it("teaching roles and tidy server messages", () => {
  expect(isTeachingRole("Teacher")).toBe(true);
  expect(isTeachingRole("parent")).toBe(false);
  expect(tidy("section_ids: choose at least one section for a teacher before giving them a teaching role."))
    .toBe("Choose at least one section for a teacher before giving them a teaching role.");
});
