// Children's Academy (Popular > Children's Academy), ages 10 to 14. Staff publish the class times in the admin portal;
// a guardian enrols a child. The server checks everything again: age, phone numbers, seats left, terms version.

import { api } from "@/lib/api";

export interface AcademyClass {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  coach: string | null;
  capacity: number;
  seatsLeft: number;
}

export interface AcademyTerms {
  version: number;
  text: string;
  updatedAt: string | null;
}

export interface AcademyInfo {
  minAge: number;
  maxAge: number;
  perDay: number;
  terms: AcademyTerms;
  sessions: AcademyClass[];
}

export type EnrollmentStatus = "confirmed" | "cancelled" | "attended" | "no_show";

export interface Enrollment {
  id: string;
  code: string;
  status: EnrollmentStatus;
  childName: string;
  childAge: number;
  healthStatus: "healthy" | "condition";
  healthNotes: string | null;
  guardianName: string;
  guardianPhone: string;
  emergencyPhone: string;
  address: string;
  session: { id: string; title: string; date: string; startTime: string; endTime: string; coach: string | null; status: string };
  canCancel: boolean;
}

export interface EnrollForm {
  guardianName: string;
  guardianPhone: string;
  emergencyPhone: string;
  address: string;
  childName: string;
  childAge: number;
  healthStatus: "healthy" | "condition";
  healthNotes: string;
  sessionId: string;
  acceptTerms: boolean;
  termsVersion: number;
}

export const STATUS_TEXT: Record<EnrollmentStatus, { label: string; tone: string }> = {
  confirmed: { label: "Confirmed", tone: "bg-emerald-400/25 text-emerald-700" },
  attended: { label: "Attended", tone: "bg-sky-400/25 text-sky-700" },
  no_show: { label: "Missed", tone: "bg-amber-400/25 text-amber-700" },
  cancelled: { label: "Cancelled", tone: "bg-slate-300/50 text-slate-600" },
};

export const loadInfo = () => api<AcademyInfo>("/academy/info", { auth: "none" });
export const loadMine = () => api<Enrollment[]>("/academy/mine");
export const enroll = (body: EnrollForm) => api<Enrollment>("/academy/enroll", { method: "POST", body });
export const cancelEnrollment = (id: string) => api<Enrollment>(`/academy/enrollments/${id}/cancel`, { method: "POST" });

export function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
