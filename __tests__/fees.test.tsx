/// <reference types="jest" />
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── server ───────────────────────────────────────────────────────────────────
const INVOICES = [{ id: "inv-1", number: "INV-AFF123DC", student_name: "Amara Eze", invoice_date: "2026-11-08", total: 475000 }];
const HISTORY = [
  { reference: "PSK-7Q2M9X41TB", provider: "paystack", status: "paid", amount_ngn: 475000, student_name: "Kelechi Eze",
    invoice_number: "INV-8AC4B92E", paid_by: "Mr Chinedu Eze", started_at: "2026-11-08T12:50:00Z",
    paid_at: "2026-11-08T13:06:00Z", method: "card ending 4081" },
  { reference: "PSK-3HV81ZC0QD", provider: "paystack", status: "pending", amount_ngn: 475000, student_name: "Amara Eze",
    invoice_number: "INV-AFF123DC", paid_by: "Mr Chinedu Eze", started_at: "2026-11-08T13:18:00Z", paid_at: null, method: null },
];
const mockGet = jest.fn((url: string) => {
  if (url === "/payments/remita/invoices") return Promise.resolve({ data: INVOICES });
  if (url === "/payments/fees/history") return Promise.resolve({ data: HISTORY });
  if (url === "/payments/fees/providers") return Promise.resolve({ data: { providers: ["paystack"] } });
  if (url.startsWith("/payments/fees/verify/")) return Promise.resolve({ data: { status: "successful", amount_ngn: 475000, paid_at: "2026-11-08T14:02:00Z" } });
  return Promise.reject(new Error("unexpected GET " + url));
});
const mockPost = jest.fn((url: string, _body?: unknown) => {
  if (url === "/payments/fees/reconcile-mine") return Promise.resolve({ data: { pending: 1, settled: 0 } });
  if (url === "/payments/fees/initiate") return Promise.resolve({ data: { reference: "REF-NEW1", authorization_url: "https://checkout.paystack.test/abc" } });
  return Promise.reject(new Error("unexpected POST " + url));
});
jest.mock("../src/lib/api", () => ({
  api: { get: (u: string) => mockGet(u), post: (u: string, b?: unknown) => mockPost(u, b) },
  errorText: (_e: unknown, f = "error") => f,
}));

// ── device ───────────────────────────────────────────────────────────────────
const mockAuthSession = jest.fn();
jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: (...a: unknown[]) => mockAuthSession(...a),
  openBrowserAsync: jest.fn().mockResolvedValue({ type: "dismiss" }),
}));
jest.mock("expo-linking", () => ({
  createURL: (path: string) => `exp://192.168.1.5:8081/--/${path}`,
  parse: (url: string) => ({ queryParams: Object.fromEntries(new URL(url.replace(/^exp:/, "http:")).searchParams) }),
}));
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

import Fees from "../app/(app)/fees";

const renderFees = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } })}><Fees /></QueryClientProvider>);

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

it("shows outstanding invoices and a dated payment history a parent can screenshot", async () => {
  await renderFees();
  expect(await screen.findByText("Invoice INV-AFF123DC · 8 Nov 2026")).toBeTruthy();   // outstanding card
  expect(await screen.findByText("Payment history")).toBeTruthy();
  expect(screen.getByText("PSK-7Q2M9X41TB")).toBeTruthy();
  expect(screen.getByText("Paystack · card ending 4081")).toBeTruthy();
  expect(screen.getByText("Paid")).toBeTruthy();
  expect(screen.getByText("Pending")).toBeTruthy();
  // "Paid on" for the paid one, "Started" for the pending one, both with date and time.
  expect(screen.getAllByText(/^8 Nov 2026,? \d{2}:\d{2}$/)).toHaveLength(2);
  expect(screen.getByText("Paid on")).toBeTruthy();
  expect(screen.getByText("Started")).toBeTruthy();
});

it("checks pending payments when opened, and again on 'Refresh payments'", async () => {
  await renderFees();
  await screen.findByText("Payment history");
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/payments/fees/reconcile-mine", undefined));
  mockPost.mockClear();
  await fireEvent.press(screen.getByLabelText("Refresh payments"));
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/payments/fees/reconcile-mine", undefined));
  await waitFor(() => expect(alert).toHaveBeenCalledWith("Payments checked", expect.stringContaining("Still waiting")));
});

it("pays by card and comes straight back into the app with the payment confirmed", async () => {
  mockAuthSession.mockResolvedValue({ type: "success", url: "exp://192.168.1.5:8081/--/fees?provider=paystack&reference=REF-NEW1" });
  await renderFees();
  await fireEvent.press(await screen.findByText("Pay with Paystack"));

  // The gateway is told to return to the APP, not the web portal (where the parent isn't signed in).
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith("/payments/fees/initiate",
    { invoice_id: "inv-1", provider: "paystack", app_return_url: "exp://192.168.1.5:8081/--/fees" }));
  expect(mockAuthSession).toHaveBeenCalledWith("https://checkout.paystack.test/abc", "exp://192.168.1.5:8081/--/fees");
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/payments/fees/verify/REF-NEW1"));
  await waitFor(() => expect(alert).toHaveBeenCalledWith("Payment successful", expect.stringContaining("₦475,000 paid on 8 Nov 2026")));
});

it("still checks the payment if the parent closes the browser instead of returning", async () => {
  mockAuthSession.mockResolvedValue({ type: "cancel" });
  await renderFees();
  await fireEvent.press(await screen.findByText("Pay with Paystack"));
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/payments/fees/verify/REF-NEW1"));
});

it("confirms a payment when the app is opened from the gateway's return link", async () => {
  mockParams = { reference: "REF-DEEPLINK" };
  await renderFees();
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/payments/fees/verify/REF-DEEPLINK"));
  await waitFor(() => expect(alert).toHaveBeenCalledWith("Payment successful", expect.any(String)));
});
