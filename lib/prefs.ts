// Customer preferences from Profile > Settings, saved on the customer's account (GET/PUT /me/preferences),
// so they follow the customer to every device.

import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

export interface Prefs {
  reminders: boolean; // booking reminder messages (SMS)
  promos: boolean; // offers and tournament news
  popup: boolean; // full-screen "I'm coming" slider 1 hour before a game
  language: string; // en | ne
}

export const DEFAULT_PREFS: Prefs = { reminders: true, promos: true, popup: true, language: "en" };

interface ApiPrefs {
  smsReminders: boolean;
  promoNotifications: boolean;
  popupReminder: boolean;
  language: string;
}

const fromApi = (p: ApiPrefs): Prefs => ({ reminders: p.smsReminders, promos: p.promoNotifications, popup: p.popupReminder, language: p.language });
const toApi = (k: keyof Prefs, v: boolean | string) =>
  ({ reminders: { smsReminders: v }, promos: { promoNotifications: v }, popup: { popupReminder: v }, language: { language: v } })[k];

export const prefsStore = createRemoteStore<Prefs>(async () => fromApi(await api<ApiPrefs>("/me/preferences")), { signedOut: DEFAULT_PREFS });

export function usePrefs(): Prefs {
  return prefsStore.use().data ?? DEFAULT_PREFS;
}

export async function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefsStore.patch((p) => ({ ...p, [key]: value }));
  try {
    await api("/me/preferences", { method: "PUT", body: toApi(key, value) });
  } catch {
    void prefsStore.refresh(); // the save failed: show what the server really has
  }
}
