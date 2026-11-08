import { Alert, Platform } from "react-native";

// Alert.alert with buttons does nothing in the browser build, so a "Are you sure?"
// there would silently never run its action. Use the browser's own dialogs on web.
export function confirmAction(title: string, message: string, okText = "OK", destructive = false): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof globalThis.confirm === "function" ? globalThis.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: okText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") { if (typeof globalThis.alert === "function") globalThis.alert(message ? `${title}\n\n${message}` : title); return; }
  Alert.alert(title, message);
}
