// Upload a photo or document as an exam answer (POST /upload/exam-answer).
// Uses fetch + FormData so the phone (or browser) writes the multipart boundary
// itself; axios on React Native gets that wrong unless coaxed.
import { Platform } from "react-native";
import { api, API_URL, tokens } from "./api";

export const MAX_ANSWER_BYTES = 15 * 1024 * 1024;
export const ANSWER_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg", "image/png", "image/webp", "image/gif",
];

export interface PickedFile { uri: string; name: string; mimeType?: string | null; size?: number | null; file?: File }

const EXT: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

export function guessType(f: PickedFile): string {
  if (f.mimeType && f.mimeType !== "application/octet-stream") return f.mimeType;
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT[ext] ?? "application/octet-stream";
}

/** Plain-language reason a file can't be sent, or null if it's fine. */
export function checkAnswerFile(f: PickedFile): string | null {
  const type = guessType(f);
  if (type === "image/heic" || type === "image/heif") return "That photo is in HEIC format. Take the photo from here instead, or choose a JPG.";
  if (!ANSWER_TYPES.includes(type)) return "Use a PDF, Word document, text file or photo.";
  if (f.size && f.size > MAX_ANSWER_BYTES) return "That file is bigger than 15 MB. Choose a smaller one.";
  return null;
}

async function send(f: PickedFile, token: string | null) {
  const form = new FormData();
  if (Platform.OS === "web" && f.file) form.append("file", f.file, f.name);
  // React Native's FormData takes {uri, name, type} for a file on disk
  else form.append("file", { uri: f.uri, name: f.name, type: guessType(f) } as any);
  return fetch(`${API_URL}/api/v1/upload/exam-answer`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" },
    body: form,
  });
}

export async function uploadExamAnswer(f: PickedFile): Promise<{ url: string; filename: string }> {
  const bad = checkAnswerFile(f);
  if (bad) throw new Error(bad);
  let r = await send(f, (await tokens.get()).access);
  if (r.status === 401) {
    // let the api client refresh the session, then try once more
    try { await api.get("/auth/me"); } catch {}
    r = await send(f, (await tokens.get()).access);
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = (body as any)?.detail;
    throw new Error(typeof d === "string" ? d : "The file didn't upload. Check your connection and try again.");
  }
  return body as { url: string; filename: string };
}
