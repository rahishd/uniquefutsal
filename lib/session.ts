// Who is using the app: a registered (signed-in) customer or a guest.
//
// DEMO IMPLEMENTATION. There is no login yet, so the demo starts signed in as the sample customer
// and "Sign out" turns the visitor into a guest. Replace this with the real session from your
// auth system (for example a cookie plus `GET /api/auth/me`). The rule that guests must pay in full
// online MUST also be enforced on the server; the browser alone cannot be trusted.

import { useSyncExternalStore } from "react";
import { sampleProfile } from "@/lib/sample-profile";

export type Session =
  | { registered: true; id: string; name: string; phone: string }
  | { registered: false };

const KEY = "uf-session-v1"; // "guest" when signed out; absent means the demo customer is signed in
const listeners = new Set<() => void>();

const DEMO_USER: Session = { registered: true, id: sampleProfile.customerId, name: sampleProfile.name, phone: sampleProfile.phone };
const GUEST: Session = { registered: false };

function read(): Session {
  try {
    return localStorage.getItem(KEY) === "guest" ? GUEST : DEMO_USER;
  } catch {
    return DEMO_USER;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function signOut() {
  try {
    localStorage.setItem(KEY, "guest");
  } catch {
    // storage blocked: nothing persists
  }
  emit();
}

// DEMO ONLY: stands in for the real sign-in page.
export function signInDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage blocked
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

// undefined while the page is still loading on the client (avoids flashing the wrong screen).
export function useSession(): Session | undefined {
  return useSyncExternalStore<Session | undefined>(subscribe, read, () => undefined);
}
