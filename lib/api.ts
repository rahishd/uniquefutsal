// The one place the app talks to the backend (see uniquefutsal-backend/docs/API.md).
//
// Prices, promo discounts, availability, payment status, points and every rule are decided by the server.
// This file only sends requests, attaches the sign-in token, and turns errors into readable messages.

import { getTokens, setTokens } from "@/lib/auth-token";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  // "none" never sends the token (public data); default sends it when signed in
  auth?: "none" | "auto";
}

let refreshing: Promise<boolean> | null = null;

// One refresh at a time: a 401 means the access token expired, so swap it for a new one using the refresh token.
async function refresh(): Promise<boolean> {
  const t = getTokens();
  if (!t?.refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: t.refreshToken }) });
      if (!res.ok) return false;
      const j = (await res.json()) as { data?: { token: string; refreshToken: string } };
      if (!j.data) return false;
      setTokens({ token: j.data.token, refreshToken: j.data.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const qs = opts.query
    ? "?" + Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
    : "";
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const tokens = opts.auth === "none" ? null : getTokens();
  if (tokens) headers.Authorization = `Bearer ${tokens.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, { method: opts.method ?? "GET", headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, cache: "no-store" });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && tokens && !retried) {
    if (await refresh()) return api<T>(path, opts, true);
    setTokens(null); // the sign-in is no longer valid
  }

  let json: { data?: T; message?: string } = {};
  try {
    json = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) throw new ApiError(res.status, json.message || "Something went wrong. Please try again.");
  return json.data as T;
}

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
