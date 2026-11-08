/// <reference types="jest" />
import React from "react";
import { Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockGet = jest.fn();
const mockTokens = { get: jest.fn(), set: jest.fn(), clear: jest.fn() };
jest.mock("../src/lib/api", () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn().mockResolvedValue({ data: {} }) },
  tokens: { get: () => mockTokens.get(), set: (a: string, b: string) => mockTokens.set(a, b), clear: () => mockTokens.clear() },
  setSignedOutHandler: jest.fn(),
  errorText: (e: any) => (e?.response ? "Server error" : "Can't reach the server. Check your internet connection."),
}));

import { AuthProvider, useAuth } from "../src/lib/auth";

function Probe() {
  const { me, loading, bootError } = useAuth();
  return <Text>{loading ? "loading" : me ? `signed in as ${me.full_name}` : bootError ? `error: ${bootError}` : "signed out"}</Text>;
}
const renderAuth = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } })}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockTokens.get.mockResolvedValue({ access: "a", refresh: "r" });
});

it("restores a saved session", async () => {
  mockGet.mockResolvedValue({ data: { id: "1", full_name: "Mr Chinedu Eze" } });
  await renderAuth();
  expect(await screen.findByText("signed in as Mr Chinedu Eze")).toBeTruthy();
});

it("keeps the session when the server is asleep or there is no signal (does NOT sign out)", async () => {
  mockGet.mockRejectedValue({ code: "ECONNABORTED" });   // no response: timeout / offline
  await renderAuth();
  expect(await screen.findByText(/^error: Can't reach the server/)).toBeTruthy();
  expect(mockTokens.clear).not.toHaveBeenCalled();
});

it("signs out only when the server says the session is no longer valid", async () => {
  mockGet.mockRejectedValue({ response: { status: 401 } });
  await renderAuth();
  expect(await screen.findByText("signed out")).toBeTruthy();
  expect(mockTokens.clear).toHaveBeenCalled();
});

it("shows the login screen straight away when nothing is saved", async () => {
  mockTokens.get.mockResolvedValue({ access: null, refresh: null });
  await renderAuth();
  expect(await screen.findByText("signed out")).toBeTruthy();
  expect(mockGet).not.toHaveBeenCalled();
});

it("a retry after the server wakes up signs the user in", async () => {
  mockGet.mockRejectedValueOnce({ code: "ECONNABORTED" }).mockResolvedValueOnce({ data: { id: "1", full_name: "Amara Eze" } });
  let retry: () => void = () => {};
  function Grab() { retry = useAuth().retry; return null; }
  await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } })}><AuthProvider><Probe /><Grab /></AuthProvider></QueryClientProvider>);
  await screen.findByText(/^error:/);
  await act(async () => { retry(); });
  await waitFor(() => expect(screen.getByText("signed in as Amara Eze")).toBeTruthy());
});
