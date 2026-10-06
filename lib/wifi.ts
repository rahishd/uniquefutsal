// The venue Wi-Fi shown to signed-in customers. Staff set the name, password and the on/off switch in the admin portal
// (Settings > Venue Wi-Fi); the server never sends it to guests (GET /wifi needs sign-in) and sends nothing while the switch is off.
import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { createRemoteStore } from "@/lib/remote-store";

// locked = the venue shares Wi-Fi only with customers who are at the venue (a game, Gamezone session or membership time around now)
export type Wifi = { visible: false } | { visible: true; locked: true; message: string } | { visible: true; locked: false; ssid: string; password: string; open: boolean; qr: string };

// refreshed every minute so a switch staff turn off hides the button soon
export const wifiStore = createRemoteStore<Wifi>(() => api<Wifi>("/wifi"), { signedOut: { visible: false }, pollMs: 60_000 });

type NetInfo = { type?: string; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };
const connection = () => (typeof navigator === "undefined" ? undefined : (navigator as Navigator & { connection?: NetInfo }).connection);

// true when the phone says it is on mobile data. Only Chrome on Android reports this: iPhone and desktop browsers never do,
// so "false" means "not on mobile data, or cannot tell".
export function useOnCellular(): boolean {
  return useSyncExternalStore(
    (l) => { const c = connection(); c?.addEventListener?.("change", l); return () => c?.removeEventListener?.("change", l); },
    () => connection()?.type === "cellular",
    () => false,
  );
}

export const isAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
// Opens the Wi-Fi list on Android Chrome. iPhones do not allow a web page to open Settings.
export const ANDROID_WIFI_SETTINGS = "intent:#Intent;action=android.settings.WIFI_SETTINGS;end";
