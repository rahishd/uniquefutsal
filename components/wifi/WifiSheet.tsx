"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Lock, Settings, Smartphone, Wifi as WifiIcon, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { ANDROID_WIFI_SETTINGS, isAndroid, useOnCellular, type Wifi } from "@/lib/wifi";

type Shown = Extract<Wifi, { visible: true }>;
type Open = Extract<Wifi, { locked: false }>;

// The venue Wi-Fi. The server sends the details only to customers who are at the venue (or to everyone signed in, if staff chose that).
// A web page cannot make the phone join a network by itself, but a phone camera (or Google Lens / Photos on a screenshot) turns the
// Wi-Fi QR code into the phone's own "Join network" pop-up, so the password never has to be typed.
export default function WifiSheet({ wifi, onClose }: { wifi: Shown; onClose: () => void }) {
  return wifi.locked ? <Locked message={wifi.message} onClose={onClose} /> : <Details wifi={wifi} onClose={onClose} />;
}

function Frame({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Venue Wi-Fi" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-[#f4f6fb] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><WifiIcon size={20} className="text-brand" /> Venue Wi-Fi</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/70 p-2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Locked({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Frame onClose={onClose}>
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand"><Lock size={22} /></span>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </Frame>
  );
}

function Details({ wifi, onClose }: { wifi: Open; onClose: () => void }) {
  const cellular = useOnCellular();
  const [copied, setCopied] = useState<"" | "name" | "password">("");
  const [reveal, setReveal] = useState(false);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAndroid(isAndroid()), 0);
    return () => clearTimeout(t);
  }, []);

  async function copy(what: "name" | "password") {
    try {
      await navigator.clipboard.writeText(what === "name" ? wifi.ssid : wifi.password);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch { /* clipboard blocked: tap Show and copy by hand */ }
  }

  const copyBtn = (what: "name" | "password") => (
    <button type="button" onClick={() => copy(what)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-3 py-2 text-xs font-medium text-brand">
      {copied === what ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
    </button>
  );

  return (
    <Frame onClose={onClose}>
      {cellular && (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
          <Smartphone size={16} className="mt-0.5 shrink-0" /> You are on mobile data. Join the venue Wi-Fi below to save your data.
        </p>
      )}

      <p className="mb-3 text-sm text-slate-600">Connect to <strong>{wifi.ssid}</strong>.</p>

      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
          <div className="min-w-0 flex-1"><p className="text-xs text-slate-500">Wi-Fi name</p><p className="break-all text-base font-semibold">{wifi.ssid}</p></div>
          {copyBtn("name")}
        </div>
        {wifi.open ? (
          <p className="rounded-2xl bg-white p-3 text-sm text-slate-600">This network has no password.</p>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Password</p>
              <p className="break-all text-base font-semibold">{reveal ? wifi.password : "•".repeat(Math.min(wifi.password.length, 12))}</p>
            </div>
            <button type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? "Hide password" : "Show password"} className="shrink-0 rounded-full p-2 text-slate-500">{reveal ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            {copyBtn("password")}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 text-center">
        <div className="mx-auto w-fit rounded-xl bg-white p-2 ring-1 ring-slate-200">
          <QRCodeCanvas value={wifi.qr} size={176} level="M" fgColor="#0c0b5d" bgColor="#ffffff" marginSize={1} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Scan this QR with another phone&apos;s camera, or take a screenshot of it and open the screenshot in Photos (iPhone) or Google Lens (Android). Your phone then shows &ldquo;Join {wifi.ssid}&rdquo;.</p>
      </div>

      {android && (
        <a href={ANDROID_WIFI_SETTINGS} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-medium text-white"><Settings size={16} /> Open Wi-Fi settings</a>
      )}
      <p className="mt-4 text-xs text-slate-500">
        {android ? "Open Wi-Fi settings, pick the network, then paste the password." : "On iPhone: Settings > Wi-Fi, tap the network, then paste the password."} For venue customers only: please do not share it.
      </p>
    </Frame>
  );
}
