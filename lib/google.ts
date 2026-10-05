// Google sign-in, used as the second factor for password reset: the customer links their Google account in Profile,
// and a forgotten password can then only be reset by signing in with that same Google account.
// The browser only obtains Google's signed token; the server verifies it (never trust the browser).

import { api } from "@/lib/api";

export interface GoogleConfig {
  configured: boolean;
  clientId: string | null;
}

export const googleConfig = () => api<GoogleConfig>("/auth/google/config", { auth: "none" });

export interface GoogleStatus extends GoogleConfig {
  linked: boolean;
  email: string | null;
}
export const googleStatus = () => api<GoogleStatus>("/auth/google/status");
export const linkGoogle = (idToken: string) => api<{ email: string }>("/auth/google/link", { method: "POST", body: { idToken } });
export const unlinkGoogle = () => api("/auth/google/unlink", { method: "POST" });
export const resetPasswordWithGoogle = (p: { phoneNumber: string; idToken: string; newPassword: string }) =>
  api("/auth/reset-password/google", { method: "POST", body: p, auth: "none" });

interface GisApi {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
}

let loading: Promise<GisApi> | null = null;
// Loads Google's own sign-in script once.
export function loadGoogle(): Promise<GisApi> {
  const w = window as unknown as { google?: GisApi };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  loading ??= new Promise<GisApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error("Google did not load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not reach Google. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return loading;
}
