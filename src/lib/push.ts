// Phone alerts (attendance, reports, fees, notices) through Expo's push service.
//
// The server sends to every Expo token registered for the signed-in person
// (POST /platform/mobile/register). On sign-out we unregister so the next
// person who signs in on this phone doesn't get the previous person's alerts.
//
// Limits worth knowing:
//  - Web: no push here (the web portal has its own browser alerts).
//  - Android inside Expo Go: Google removed remote push from Expo Go in SDK 53,
//    so Android needs the installed app (the APK built by CI) to receive alerts.
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "./api";

export type PushStatus = "on" | "denied" | "unsupported" | "no-project" | "error";

let current: string | null = null;
let lastStatus: PushStatus | null = null;
/** Result of the most recent registerForPush() call (null = not tried yet). */
export const getPushStatus = () => lastStatus;

export function pushUnsupportedReason(): string | null {
  if (Platform.OS === "web") return "Phone alerts work in the installed app, not the browser.";
  if (!Device.isDevice) return "Phone alerts need a real phone, not a simulator.";
  if (Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return "Android alerts need the installed Fairview app (Expo Go can't receive them).";
  }
  return null;
}

/** Show alerts as a banner even while the app is open. Safe to call more than once. */
export function configureForeground() {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  const c = Constants as any;
  return c.easConfig?.projectId ?? c.expoConfig?.extra?.eas?.projectId ?? undefined;
}

/** Ask for permission (once), get this phone's token and tell the server. */
let pending: Promise<PushStatus> | null = null;
export function registerForPush(): Promise<PushStatus> {
  pending = doRegister().then((st) => { lastStatus = st; return st; });
  return pending;
}
/** Resolves with the alert status once the sign-in registration has finished. */
export const whenPushSettled = (): Promise<PushStatus> | null => pending;

async function doRegister(): Promise<PushStatus> {
  if (pushUnsupportedReason()) return "unsupported";
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "School alerts",
        // eslint-disable-next-line import/namespace -- re-exported through a nested `export *`; tsc resolves it
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0E3B2C",
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";
    const pid = projectId();
    if (!pid) return "no-project";
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
    await api.post("/platform/mobile/register", {
      push_token: token,
      platform: Platform.OS,
      label: Device.modelName ?? undefined,
    });
    current = token;
    return "on";
  } catch {
    return "error";
  }
}

/** Stop this phone getting the signed-in person's alerts. Never throws. */
export async function unregisterPush(): Promise<void> {
  const token = current;
  current = null;
  lastStatus = null;
  pending = null;
  if (!token) return;
  try { await api.post("/platform/mobile/unregister", { push_token: token }); } catch {}
}

/** Where a tapped alert should open. The server sends {url, kind}. */
export function routeForAlert(data: unknown): string {
  const d = (data ?? {}) as { url?: string; kind?: string };
  const url = String(d.url || "");
  const kind = String(d.kind || "");
  if (kind === "daily_report" || url.includes("daily-report")) return "/daily";
  if (kind === "message" || url.includes("communication-book")) return "/messages";
  if (kind === "leave" || url.includes("/leave")) return "/leave";
  if (kind === "attendance" || url.includes("attendance")) return "/children";
  if (kind === "report" || url.includes("report") || url.includes("result")) return "/progress";
  if (url.includes("fee") || url.includes("payment")) return "/fees";
  if (url.includes("exam") || url.includes("cbt")) return "/exams";
  return "/notices";
}
