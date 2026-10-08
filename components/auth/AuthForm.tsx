"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Phone } from "lucide-react";
import { errorText } from "@/lib/api";
import { signIn, signUp, useSession } from "@/lib/session";
import { site } from "@/lib/site";
import { googleConfig, resetPasswordWithGoogle, type GoogleConfig } from "@/lib/google";
import GoogleButton from "@/components/auth/GoogleButton";

const input = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

// Only same-site paths are accepted as the page to return to.
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function AuthForm() {
  const session = useSession();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [google, setGoogle] = useState<GoogleConfig | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "reset" || google) return;
    googleConfig().then(setGoogle).catch(() => setGoogle({ configured: false, clientId: null }));
  }, [mode, google]);

  const phoneOk = /^9\d{9}$/.test(phone);
  const ok = phoneOk && password.length >= 6 && (mode === "in" || name.trim().length >= 2);

  async function reset(idToken: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await resetPasswordWithGoogle({ phoneNumber: phone, idToken, newPassword: password });
      setDone("Your password was changed. You can sign in now.");
      setMode("in");
      setPassword("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "reset" || !ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "in") await signIn(phone, password);
      else await signUp({ name: name.trim(), phone, password });
      window.location.assign(nextPath());
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (session?.registered) {
    return (
      <div className="glass space-y-4 rounded-3xl p-6 text-center">
        <p className="text-lg font-medium">You&apos;re signed in as {session.name}</p>
        <Link href="/" className="glass-btn block rounded-full py-3.5 text-sm font-semibold text-white">Go to Home</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 desk:mx-auto desk:max-w-md">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">{mode === "in" ? "Welcome back" : mode === "up" ? "Create your account" : "Reset your password"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "in" ? "Sign in with your mobile number and password." : mode === "up" ? "Book faster, earn points and play with your team." : "Confirm with the Google account you linked in Profile."}
        </p>
      </header>

      {mode !== "reset" && <div role="tablist" aria-label="Sign in or create account" className="glass grid grid-cols-2 rounded-full p-1 text-sm">
        {([["in", "Sign in"], ["up", "Create account"]] as const).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setDone(null); }} className={`rounded-full py-2 font-medium ${mode === m ? "glass-active text-white" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>}

      <form onSubmit={submit} className="glass space-y-3 rounded-3xl p-5" noValidate>
        {mode === "up" && (
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" autoComplete="name" />
        )}
        <div>
          <div className="relative">
            <Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${input} pl-10`}
              value={phone}
              inputMode="numeric"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Mobile number (98XXXXXXXX)"
              aria-label="Mobile number"
              autoComplete="tel"
            />
          </div>
          {phone.length > 0 && !phoneOk && <p className="mt-1 text-xs text-rose-500">Enter a 10-digit mobile number starting with 9.</p>}
        </div>
        <div className="relative">
          <input
            className={`${input} pr-12`}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "up" ? "Choose a password (6+ characters)" : mode === "reset" ? "New password (6+ characters)" : "Password"}
            aria-label="Password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {done && mode === "in" && <p role="status" className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">{done}</p>}
        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        {mode === "reset" ? (
          <div className="space-y-3">
            {!google ? (
              <Loader2 size={18} className="mx-auto animate-spin text-slate-400" />
            ) : !google.configured || !google.clientId ? (
              <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700">Google reset is not set up yet. Call us on {site.phone} and we will help you.</p>
            ) : ok ? (
              <GoogleButton clientId={google.clientId} onToken={reset} />
            ) : (
              <p className="text-center text-xs text-slate-500">Enter your mobile number and a new password, then continue with Google.</p>
            )}
            {busy && <p className="text-center text-sm text-slate-500">Checking…</p>}
          </div>
        ) : (
          <button type="submit" disabled={!ok || busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</> : mode === "in" ? "Sign in" : "Create account"}
          </button>
        )}
      </form>

      <p className="px-2 text-center text-xs text-slate-500">
        {mode === "reset" ? (
          <button type="button" onClick={() => { setMode("in"); setError(null); }} className="font-medium text-brand">Back to sign in</button>
        ) : (
          <>Forgot your password? <button type="button" onClick={() => { setMode("reset"); setError(null); setDone(null); setPassword(""); }} className="font-medium text-brand">Reset it with Google</button>. No Google account linked? Contact the admin on <a href={`tel:${site.phone}`} className="font-medium text-brand">{site.phone}</a> and they will set a new password for you.</>
        )}
      </p>
      <Link href="/book" className="block text-center text-sm font-medium text-brand">Continue as a guest</Link>
    </div>
  );
}
