/// <reference types="jest" />
// Phone alerts: registration with the server, sign-out clean-up, where a tapped alert opens.

const mockPost = jest.fn().mockResolvedValue({ data: {} });
jest.mock("../src/lib/api", () => ({ api: { post: (...a: unknown[]) => mockPost(...a) } }));

const mockPerm = { get: jest.fn(), request: jest.fn() };
const mockToken = jest.fn();
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: () => mockPerm.get(),
  requestPermissionsAsync: () => mockPerm.request(),
  getExpoPushTokenAsync: (o: unknown) => mockToken(o),
}));
jest.mock("expo-device", () => ({ isDevice: true, modelName: "Pixel 8" }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "standalone", easConfig: { projectId: "proj-1" } },
  ExecutionEnvironment: { StoreClient: "storeClient", Standalone: "standalone", Bare: "bare" },
}));

import { Platform } from "react-native";
import { registerForPush, routeForAlert, unregisterPush, getPushStatus } from "../src/lib/push";

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = "ios";
  mockPerm.get.mockResolvedValue({ status: "undetermined" });
  mockPerm.request.mockResolvedValue({ status: "granted" });
  mockToken.mockResolvedValue({ data: "ExponentPushToken[xyz]" });
});

it("asks permission, gets the token and registers this phone with the server", async () => {
  expect(await registerForPush()).toBe("on");
  expect(mockToken).toHaveBeenCalledWith({ projectId: "proj-1" });
  expect(mockPost).toHaveBeenCalledWith("/platform/mobile/register", { push_token: "ExponentPushToken[xyz]", platform: "ios", label: "Pixel 8" });
  expect(getPushStatus()).toBe("on");
});

it("signing out unregisters the same token so the next person doesn't get these alerts", async () => {
  await registerForPush();
  mockPost.mockClear();
  await unregisterPush();
  expect(mockPost).toHaveBeenCalledWith("/platform/mobile/unregister", { push_token: "ExponentPushToken[xyz]" });
  expect(getPushStatus()).toBeNull();
  mockPost.mockClear();
  await unregisterPush(); // nothing left to do
  expect(mockPost).not.toHaveBeenCalled();
});

it("respects a 'no' to notifications and never registers", async () => {
  mockPerm.request.mockResolvedValue({ status: "denied" });
  expect(await registerForPush()).toBe("denied");
  expect(mockPost).not.toHaveBeenCalled();
});

it("does nothing in the browser build", async () => {
  (Platform as any).OS = "web";
  expect(await registerForPush()).toBe("unsupported");
  expect(mockPerm.request).not.toHaveBeenCalled();
});

it("a server/network failure is reported, not thrown", async () => {
  mockPost.mockRejectedValueOnce(new Error("offline"));
  expect(await registerForPush()).toBe("error");
});

it("a tapped alert opens the matching screen", () => {
  expect(routeForAlert({ kind: "attendance" })).toBe("/children");
  expect(routeForAlert({ kind: "report", url: "/dashboard/reports/1" })).toBe("/progress");
  expect(routeForAlert({ url: "/dashboard/fees" })).toBe("/fees");
  expect(routeForAlert({ url: "/dashboard/my-exams" })).toBe("/exams");
  expect(routeForAlert({})).toBe("/notices");
  expect(routeForAlert(undefined)).toBe("/notices");
});
