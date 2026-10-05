"use client";

import { useEffect, useState } from "react";
import { errorText } from "@/lib/api";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { googleStatus, linkGoogle, unlinkGoogle, type GoogleStatus } from "@/lib/google";
import GoogleButton from "@/components/auth/GoogleButton";

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-brand" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// Two settings rows: alerts when the app is closed (Web Push) and the Google account used to reset a forgotten password.
export default function AccountSecurity() {
  const [push, setPush] = useState<PushState | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let alive = true;
    pushState().then((s) => alive && setPush(s));
    googleStatus().then((s) => alive && setGoogle(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function togglePush(on: boolean) {
    setBusy(true);
    setPushError(null);
    try {
      if (on) {
        const r = await enablePush();
        if (!r.ok) setPushError(r.error);
      } else {
        await disablePush();
      }
    } catch (e) {
      setPushError(errorText(e));
    } finally {
      setPush(await pushState());
      setBusy(false);
    }
  }

  async function link(idToken: string) {
    setGoogleError(null);
    try {
      await linkGoogle(idToken);
      setGoogle(await googleStatus());
      setLinking(false);
    } catch (e) {
      setGoogleError(errorText(e));
    }
  }

  async function unlink() {
    setGoogleError(null);
    try {
      await unlinkGoogle();
      setGoogle(await googleStatus());
    } catch (e) {
      setGoogleError(errorText(e));
    }
  }

  return (
    <>
      <li>
        <div className="flex items-center justify-between gap-4">
          <span>
            Alerts when the app is closed
            <span className="block text-xs text-slate-400">Booking, payment and game reminders on this phone. On iPhone, add the app to your Home Screen first.</span>
          </span>
          <Switch checked={push === "on"} disabled={busy || push === null || push === "unsupported"} onChange={togglePush} label="Alerts when the app is closed" />
        </div>
        {push === "unsupported" && <p className="mt-1 text-xs text-slate-400">This browser cannot receive them.</p>}
        {push === "denied" && <p className="mt-1 text-xs text-amber-600">Blocked. Allow notifications for this site in your browser settings.</p>}
        {pushError && <p role="alert" className="mt-1 text-xs text-rose-600">{pushError}</p>}
      </li>
      <li>
        <div className="flex items-center justify-between gap-4">
          <span>
            Google account for password reset
            <span className="block text-xs text-slate-400">
              {google?.linked ? `Linked: ${google.email}` : "Link one so you can reset a forgotten password yourself."}
            </span>
          </span>
          {google?.configured &&
            (google.linked ? (
              <button type="button" onClick={unlink} className="shrink-0 text-xs font-medium text-rose-500">Unlink</button>
            ) : (
              <button type="button" onClick={() => setLinking((v) => !v)} className="shrink-0 text-xs font-medium text-brand">{linking ? "Close" : "Link"}</button>
            ))}
        </div>
        {google && !google.configured && <p className="mt-1 text-xs text-slate-400">Not available yet.</p>}
        {linking && google?.clientId && <div className="mt-3"><GoogleButton clientId={google.clientId} onToken={link} /></div>}
        {googleError && <p role="alert" className="mt-1 text-xs text-rose-600">{googleError}</p>}
      </li>
    </>
  );
}
