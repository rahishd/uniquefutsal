// The customer's sign-in tokens, kept in this browser. Both lib/api.ts (to attach the token) and
// lib/session.ts (to know who is signed in) use it. Tokens are never put in URLs.

const KEY = "uf-auth-v1";

export interface Tokens {
  token: string;
  refreshToken: string;
}

const listeners = new Set<() => void>();
let cache: Tokens | null | undefined; // undefined = not read yet

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function setTokens(t: Tokens | null) {
  cache = t;
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the sign-in lasts for this visit only
  }
  listeners.forEach((l) => l());
}

export function subscribeTokens(l: () => void) {
  listeners.add(l);
  if (typeof window === "undefined") return () => listeners.delete(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = undefined;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}
