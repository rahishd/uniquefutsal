// Complaints (Popular > Complaints). The server checks everything again: category, length, booking ownership,
// the photos themselves, and how many complaints one customer may send a day (see backend docs/API.md).

import { api, API_URL } from "@/lib/api";

export interface ComplaintCategory {
  id: string;
  label: string;
}

export interface ComplaintRules {
  categories: ComplaintCategory[];
  messageMin: number;
  messageMax: number;
  maxPhotos: number;
  perDay: number;
}

export type ComplaintStatus = "open" | "in_review" | "resolved" | "closed";

export interface Complaint {
  id: string;
  code: string;
  category: string;
  categoryLabel: string;
  message: string;
  bookingCode: string | null;
  photos: string[];
  status: ComplaintStatus;
  staffReply: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// Shown while the rules load, or if the server cannot be reached; the server's list wins once it arrives.
export const FALLBACK_RULES: ComplaintRules = {
  categories: [
    { id: "booking", label: "Booking" },
    { id: "payment", label: "Payment or refund" },
    { id: "facilities", label: "Court or facilities" },
    { id: "staff", label: "Staff behaviour" },
    { id: "gamezone", label: "Gamezone" },
    { id: "membership", label: "Membership" },
    { id: "app", label: "App problem" },
    { id: "other", label: "Other" },
  ],
  messageMin: 10,
  messageMax: 1500,
  maxPhotos: 3,
  perDay: 5,
};

export const STATUS_TEXT: Record<ComplaintStatus, { label: string; tone: string }> = {
  open: { label: "Received", tone: "bg-amber-400/25 text-amber-700" },
  in_review: { label: "Being looked at", tone: "bg-sky-400/25 text-sky-700" },
  resolved: { label: "Resolved", tone: "bg-emerald-400/25 text-emerald-700" },
  closed: { label: "Closed", tone: "bg-slate-300/50 text-slate-600" },
};

export const loadRules = () => api<ComplaintRules>("/complaints/categories", { auth: "none" });
export const loadMine = () => api<Complaint[]>("/complaints/me");
export const sendComplaint = (body: { category: string; message: string; bookingCode?: string; photos: string[] }) =>
  api<Complaint>("/complaints", { method: "POST", body });

// Photos are saved by the server as /uploads/... on the same host as the API (or a full URL when stored in the cloud).
export const photoUrl = (p: string) => (/^https?:\/\//i.test(p) ? p : `${API_URL.replace(/\/api$/, "")}${p}`);

// Shrinks a photo in the browser before upload: longest side 1280px, JPEG. A phone photo is several MB; this is a few hundred KB.
// It also drops location data (a canvas keeps pixels only).
export async function shrinkPhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new Error("Please choose a photo (JPG, PNG or WebP).");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That photo could not be opened. Try a different one.");
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not prepare the photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.8);
}
