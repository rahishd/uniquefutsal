// Web Push: alerts that reach the phone when the app is closed (booking, payment, challenge, 1-hour reminder).
// The server keeps this device's subscription and sends the pushes (see backend docs/API.md, /me/push-subscriptions).
// iPhone only supports Web Push for the app added to the Home Screen (iOS 16.4+).

import { api } from "@/lib/api";

export type PushState = "unsupported" | "denied" | "off" | "on";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

async function send(sub: PushSubscription) {
  await api("/me/push-subscriptions", { method: "POST", body: sub.toJSON() });
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pushSupported()) return { ok: false, error: "This browser cannot receive alerts when the app is closed. On iPhone, add the app to your Home Screen first." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Alerts are blocked. Allow notifications for this site in your browser settings." };
  const key = await api<{ enabled: boolean; publicKey: string }>("/push/public-key", { auth: "none" });
  if (!key.enabled) return { ok: false, error: "Alerts when the app is closed are not available yet." };
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key.publicKey) }));
  await send(sub);
  return { ok: true };
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api("/me/push-subscriptions", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

// After sign-in: if this device already allowed alerts, make sure the server has its subscription for this account.
export async function syncPush() {
  try {
    if ((await pushState()) !== "on") return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await send(sub);
  } catch {
    // best effort
  }
}
