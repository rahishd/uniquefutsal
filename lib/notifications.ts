// Customer notifications: in-app centre + 1-hour game reminders.
//
// Storage is the browser's localStorage, so this works without a backend. A real
// deployment also needs the server to create challenge/payment/booking notices and to send
// Web Push for when the app is closed (the service worker already handles `push` events).

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

const KEY = "uf-notifications-v1";
const REMINDERS_KEY = "uf-reminders-v1";
const MAX_KEPT = 50;
export const REMINDER_LEAD_MS = 60 * 60 * 1000; // 1 hour before kick-off

// DEMO: sample notices so the centre isn't empty on first run. Remove once the
// backend creates real ones (challenges, payments, bookings).
const SEED_DEMO = true;

function seed(): Notice[] {
  if (!SEED_DEMO) return [];
  const now = Date.now();
  return [
    { id: "seed-payment", type: "payment", title: "Payment received", body: "Rs. 1,215 received for booking UF-20261010-00125.", at: now - 3 * 3600_000, read: false, href: "/profile" },
    { id: "seed-booking", type: "booking", title: "Booking confirmed", body: "Sat, 10 Oct · 7:00 PM – 8:00 PM · Court 1.", at: now - 3 * 3600_000 - 60_000, read: true, href: "/profile" },
  ];
}

/* ---------- external store (works with useSyncExternalStore) ---------- */

const EMPTY: Notice[] = [];
let cache: Notice[] | null = null;
const listeners = new Set<() => void>();

function load(): Notice[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as Notice[];
    } else {
      cache = seed();
      localStorage.setItem(KEY, JSON.stringify(cache));
    }
  } catch {
    cache = seed(); // storage blocked: keep in memory for this session
  }
  return cache;
}

function commit(next: Notice[]) {
  cache = next.slice(0, MAX_KEPT);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage blocked or full: state still lives in memory
  }
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // another tab changed it: reload
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getSnapshot = () => load();
export const getServerSnapshot = () => EMPTY;

/* ---------- actions ---------- */

export function addNotice(n: Omit<Notice, "id" | "at" | "read"> & { id?: string }) {
  const list = load();
  const id = n.id ?? `${n.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (list.some((x) => x.id === id)) return; // idempotent: the same event is never added twice
  commit([{ ...n, id, at: Date.now(), read: false }, ...list]);
  void showSystemNotification(n.title, n.body, n.href);
}

export function markRead(id: string) {
  commit(load().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

// Used by the Popular tiles on the home screen: opening a tile clears its unread messages.
export function markReadByTypes(types: NoticeType[]) {
  const list = load();
  if (!list.some((n) => !n.read && types.includes(n.type))) return;
  commit(list.map((n) => (!n.read && types.includes(n.type) ? { ...n, read: true } : n)));
}

export function markAllRead() {
  commit(load().map((n) => ({ ...n, read: true })));
}

export function clearAll() {
  commit([]);
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

/* ---------- 1-hour game reminders ---------- */

export interface ReminderEntry {
  id: string; // booking id
  startsAt: number; // epoch ms
  done: boolean;
  label?: string; // e.g. "Court 1", shown on the check-in screen
}

export function loadReminders(): ReminderEntry[] {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? "[]") as ReminderEntry[];
  } catch {
    return [];
  }
}

function saveReminders(list: ReminderEntry[]) {
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// Called when a booking is created. startsAt is the local kick-off time.
export function scheduleReminder(bookingId: string, startsAt: number, label?: string) {
  const list = loadReminders().filter((r) => r.id !== bookingId);
  list.push({ id: bookingId, startsAt, done: false, label });
  saveReminders(list.filter((r) => r.startsAt > Date.now() - 24 * 3600_000));
  window.dispatchEvent(new Event("uf-reminders-changed"));
}

export function markReminderDone(bookingId: string) {
  saveReminders(loadReminders().map((r) => (r.id === bookingId ? { ...r, done: true } : r)));
}

export function fireReminder(r: ReminderEntry) {
  const time = new Date(r.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  addNotice({
    id: `reminder-${r.id}`,
    type: "reminder",
    title: "Your game starts in 1 hour",
    body: `Kick-off at ${time}. Booking ${r.id}. Time to get ready!`,
    href: "/profile",
  });
  markReminderDone(r.id);
}
