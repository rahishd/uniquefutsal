// A small shared cache for data that comes from the backend (my bookings, points, notices...).
// Several components can read the same data without each fetching it. It reloads when the person signs in or
// out, when the tab becomes visible again, and (optionally) every few seconds while something is showing it.

import { useSyncExternalStore } from "react";
import { getTokens, subscribeTokens } from "@/lib/auth-token";

export interface RemoteState<T> {
  status: "idle" | "loading" | "ready" | "error";
  data?: T;
  error?: string;
}

const IDLE = { status: "idle" } as const;

export function createRemoteStore<T>(fetcher: () => Promise<T>, opts: { pollMs?: number; signedOut?: T } = {}) {
  let state: RemoteState<T> = IDLE;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;
  let again = false;

  const emit = () => listeners.forEach((l) => l());
  const set = (s: RemoteState<T>) => {
    state = s;
    emit();
  };

  async function refresh() {
    if (running) {
      again = true;
      return;
    }
    // personal data: a guest has none, so there is nothing to ask the server
    if (opts.signedOut !== undefined && !getTokens()) {
      set({ status: "ready", data: opts.signedOut });
      return;
    }
    running = true;
    // keep showing the old data while a reload runs; only the first load shows "loading"
    if (state.status === "idle") set({ status: "loading" });
    try {
      const data = await fetcher();
      set({ status: "ready", data });
    } catch (e) {
      set(state.data !== undefined ? { ...state, status: "ready" } : { status: "error", error: e instanceof Error ? e.message : "Could not load" });
    } finally {
      running = false;
      if (again) {
        again = false;
        void refresh();
      }
    }
  }

  const onVisible = () => document.visibilityState === "visible" && listeners.size > 0 && void refresh();

  function subscribe(l: () => void) {
    listeners.add(l);
    if (listeners.size === 1) {
      void refresh();
      if (opts.pollMs) timer = setInterval(() => void refresh(), opts.pollMs);
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      listeners.delete(l);
      if (listeners.size === 0) {
        if (timer) clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }

  // sign in / sign out / refreshed token: everything personal is stale
  if (typeof window !== "undefined") {
    subscribeTokens(() => {
      state = IDLE;
      emit();
      if (listeners.size > 0) void refresh();
    });
  }

  return {
    use: (): RemoteState<T> => useSyncExternalStore(subscribe, () => state, () => IDLE),
    refresh,
    // change the cached data right away (after the server confirmed an action), without waiting for a reload
    patch: (fn: (d: T) => T) => {
      if (state.data !== undefined) set({ status: "ready", data: fn(state.data) });
    },
    get: () => state,
  };
}
