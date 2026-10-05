"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Phone } from "lucide-react";
import { errorText } from "@/lib/api";
import { signIn, signUp, useSession } from "@/lib/session";
import { site } from "@/lib/site";

const input = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

// Only same-site paths are accepted as the page to return to.
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function AuthForm() {
  const session = useSession();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneOk = /^9\d{9}$/.test(phone);
  const ok = phoneOk && password.length >= 6 && (mode === "in" || name.trim().length >= 2);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || busy) return;
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
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "in" ? "Sign in with your mobile number and password." : "Book faster, earn points and play with your team."}
        </p>
      </header>

      <div role="tablist" aria-label="Sign in or create account" className="glass grid grid-cols-2 rounded-full p-1 text-sm">
        {([["in", "Sign in"], ["up", "Create account"]] as const).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }} className={`rounded-full py-2 font-medium ${mode === m ? "glass-active text-white" : "text-slate-500"}`}>
            {label}
          </button>
        ))}
      </div>

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
            placeholder={mode === "up" ? "Choose a password (6+ characters)" : "Password"}
            aria-label="Password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="submit" disabled={!ok || busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</> : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="px-2 text-center text-xs text-slate-500">
        Forgot your password? Call us on <a href={`tel:${site.phone}`} className="font-medium text-brand">{site.phone}</a> and we&apos;ll help you.
      </p>
      <Link href="/book" className="block text-center text-sm font-medium text-brand">Continue as a guest</Link>
    </div>
  );
}
