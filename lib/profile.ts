// The customer's profile and payment history, from the server (GET/PATCH /me/profile, GET /me/payments).

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";
import { updateSessionName } from "@/lib/session";

export interface Profile {
  customerCode: string;
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  position: string | null; // GK | DEF | MID | FWD
  registeredAt: string;
  status: "Active" | "Suspended";
  mode: "player" | "captain";
}

export const POSITIONS: { value: string; label: string }[] = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
];

export const profileStore = createRemoteStore<Profile | null>(() => api<Profile>("/me/profile"), { signedOut: null });

export async function saveProfile(p: { name: string; email: string; location: string; position: string }) {
  await api("/me/profile", { method: "PATCH", body: { name: p.name, email: p.email, location: p.location, position: p.position || null } });
  updateSessionName(p.name);
  await profileStore.refresh();
}

export interface PaymentItem {
  id: string;
  kind: "game" | "gamezone";
  date: string;
  time: string;
  amount: number;
  method: string;
  status: string;
}

export const paymentsStore = createRemoteStore<PaymentItem[]>(() => api<PaymentItem[]>("/me/payments"), { signedOut: [] });
