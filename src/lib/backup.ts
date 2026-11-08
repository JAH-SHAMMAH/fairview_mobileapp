// Save a downloaded backup: share sheet on phones (Drive, Files, email to self...),
// a normal browser download on the web build.
import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Me } from "./api";

/** Same rule as the server: the Director account ("*" permission) only. */
export const canBackup = (me: Me | null) => !!me && !!me.permissions?.includes("*");

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `fairview-backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.jsonl.gz`;
}

export async function saveBackup(data: ArrayBuffer | Blob, name: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = data instanceof Blob ? data : new Blob([data], { type: "application/gzip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(data as ArrayBuffer));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: "application/gzip", dialogTitle: "Save the backup", UTI: "org.gnu.gnu-zip-archive" });
  } else {
    throw new Error("Sharing isn't available on this phone.");
  }
}
