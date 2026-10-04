// Customer preferences from Profile > Settings, saved in this browser.
//
// DEMO IMPLEMENTATION. In production these belong to the customer's account on the server so they
// follow the customer to every device.

import { useSyncExternalStore } from "react";

export interface Prefs {
  reminders: boolean; // booking reminder messages (SMS)
  promos: boolean; // offers and tournament news
  popup: boolean; // full-screen "I'm coming" slider 1 hour before a game
}

export const DEFAULT_PREFS: Prefs = { reminders: true, promos: true, popup: true };

const KEY = "uf-prefs-v1";
let cache: Prefs | null = null;
const listeners = new Set<() => void>();

function load(): Prefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    cache = DEFAULT_PREFS;
  }
  return cache;
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  cache = { ...load(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, load, () => DEFAULT_PREFS);
}
