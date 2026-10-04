

export interface AdminNotification {
  id: string;
  type: "booking" | "membership" | "cancellation";
  title: string;
  body: string;
  link?: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "uf_admin_notifications";

export function getNotifications(): AdminNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {

  }
  return [];
}

export function addNotification(n: Omit<AdminNotification, "id" | "timestamp" | "read">): void {
  if (typeof window === "undefined") return;
  const notifications = getNotifications();
  const newN: AdminNotification = { ...n, id: `notif-${Date.now()}`, timestamp: Date.now(), read: false };
  notifications.unshift(newN);

  if (notifications.length > 30) notifications.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));

  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

export function markAllRead(): void {
  if (typeof window === "undefined") return;
  const notifications = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function clearNotifications(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
