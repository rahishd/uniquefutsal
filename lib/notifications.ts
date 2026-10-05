// The customer's notice centre, from the server (GET /notifications). The server creates every notice (booking,
// payment, reminder, challenge, points...) so the app only shows them, marks them read, and clears them.
// While the app is open it checks every 30 seconds and shows a phone alert for new ones (if allowed).
// Reaching a closed app needs server-sent Web Push, which is not built yet.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export type NoticeType = "challenge" | "payment" | "booking" | "reminder" | "membership" | "match" | "promo" | "points" | "tournament" | "gamezone";

export interface Notice {
  id: string;
  type: NoticeType;
  title: string;
  body: string;
  at: number; // epoch ms
  read: boolean;
  href?: string;
}

interface Notices {
  items: Notice[];
  unreadByType: Partial<Record<NoticeType, number>>;
}

interface Payload {
  items: (Omit<Notice, "at" | "href"> & { at: string; href: string | null })[];
  unreadByType: Notices["unreadByType"];
}

const EMPTY: Notices = { items: [], unreadByType: {} };
let known: Set<string> | null = null; // ids already seen, so only NEW notices raise a phone alert

export const noticesStore = createRemoteStore<Notices>(
  async () => {
    const r = await api<Payload>("/notifications", { query: { limit: 50 } });
    const items: Notice[] = r.items.map((i) => ({ ...i, at: new Date(i.at).getTime(), href: i.href ?? undefined }));
    if (known) {
      for (const n of items) if (!n.read && !known.has(n.id)) void showSystemNotification(n.title, n.body, n.href);
    }
    known = new Set(items.map((n) => n.id));
    return { items, unreadByType: r.unreadByType };
  },
  { pollMs: 30000, signedOut: EMPTY },
);

export const unreadCount = (n: Notices) => n.items.filter((x) => !x.read).length;

export async function markRead(id: string) {
  noticesStore.patch((d) => ({ ...d, items: d.items.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
  try {
    await api(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
  } finally {
    void noticesStore.refresh();
  }
}

// Used by the Popular tiles on Home: opening a tile clears its unread messages.
export async function markReadByTypes(types: NoticeType[]) {
  const d = noticesStore.get().data;
  if (!d?.items.some((n) => !n.read && types.includes(n.type))) return;
  noticesStore.patch((x) => ({ ...x, items: x.items.map((n) => (!n.read && types.includes(n.type) ? { ...n, read: true } : n)), unreadByType: {} }));
  try {
    await api("/notifications/read", { method: "POST", body: { types } });
  } finally {
    void noticesStore.refresh();
  }
}

export async function markAllRead() {
  noticesStore.patch((d) => ({ items: d.items.map((n) => ({ ...n, read: true })), unreadByType: {} }));
  try {
    await api("/notifications/read", { method: "POST", body: {} });
  } finally {
    void noticesStore.refresh();
  }
}

export async function clearAll() {
  noticesStore.patch(() => EMPTY);
  try {
    await api("/notifications", { method: "DELETE" });
  } finally {
    void noticesStore.refresh();
  }
}

/* ---------- system (phone/desktop) notifications ---------- */

export function notificationSupport(): "unsupported" | NotificationPermission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export async function requestSystemPermission() {
  if (typeof Notification === "undefined") return "unsupported" as const;
  return Notification.requestPermission();
}

async function showSystemNotification(title: string, body: string, href?: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options: NotificationOptions = { body, icon: "/icons/192", badge: "/icons/192", data: { href: href ?? "/" } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // some browsers only allow notifications through the service worker: ignore
  }
}
