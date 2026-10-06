// Gallery photos and ads shown in the app. Staff manage them in the admin portal; the SERVER decides which ads are live right now
// (date range, hours of the day, days of the week, Nepal time), so the app only shows what it is given and asks again every minute.

import { useSyncExternalStore } from "react";
import { API_URL, api } from "@/lib/api";

export interface AdItem {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  displaySeconds: number;
  popupDelaySeconds?: number;
  popupFrequency?: "session" | "day" | "always";
}

export interface GalleryPhoto {
  id: string;
  title: string;
  caption: string | null;
  orientation: "landscape" | "portrait" | "square";
  imageUrl: string;
}

export interface SiteContent {
  gallery: GalleryPhoto[];
  ads: { header: AdItem[]; footer: AdItem[]; popup: AdItem[]; inline: AdItem[] };
}

const EMPTY: SiteContent = { gallery: [], ads: { header: [], footer: [], popup: [], inline: [] } };
const REFRESH_MS = 60_000;

// One shared copy for every component, fetched once and refreshed every minute while the app is open.
let current: SiteContent = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
  try {
    const next = await api<SiteContent & { serverTime: string }>("/content/active", { auth: "none" });
    // only replace when something changed, so a rotating ad is not restarted every minute
    if (JSON.stringify(next.ads) !== JSON.stringify(current.ads) || JSON.stringify(next.gallery) !== JSON.stringify(current.gallery)) {
      current = { gallery: next.gallery, ads: next.ads };
      listeners.forEach((l) => l());
    }
  } catch {
    /* offline or server down: keep showing what we have */
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) {
    load();
    timer = setInterval(load, REFRESH_MS);
  }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export const useContent = (): SiteContent => useSyncExternalStore(subscribe, () => current, () => EMPTY);

// Pictures are served by the API; the path the server gives is relative to its host.
export const mediaUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${API_URL.replace(/\/api$/, "")}${path}`);

// Counters for the venue's reports; never blocks or breaks the page.
export function trackAd(id: string, kind: "view" | "click") {
  try {
    fetch(`${API_URL}/content/ads/${encodeURIComponent(id)}/${kind}`, { method: "POST", keepalive: true }).catch(() => {});
  } catch {
    /* ignore */
  }
}
