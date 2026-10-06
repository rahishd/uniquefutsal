"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Settings, Smartphone, Wifi as WifiIcon, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { ANDROID_WIFI_SETTINGS, isAndroid, useOnCellular, type Wifi } from "@/lib/wifi";

type Shown = Extract<Wifi, { visible: true }>;

// The venue Wi-Fi: name, password (with copy buttons) and a Wi-Fi QR code. A web page cannot make the phone show its own
// "Join network" pop-up, but a phone camera (or Google Lens / Photos on a screenshot) turns this QR code into exactly that pop-up.
export default function WifiSheet({ wifi, onClose }: { wifi: Shown; onClose: () => void }) {
  const cellular = useOnCellular();
  const [copied, setCopied] = useState<"" | "name" | "password">("");
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAndroid(isAndroid()), 0);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  async function copy(what: "name" | "password") {
    try {
      await navigator.clipboard.writeText(what === "name" ? wifi.ssid : wifi.password);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch { /* clipboard blocked: the text is on screen to copy by hand */ }
  }

  const row = (label: string, value: string, what: "name" | "password") => (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="break-all text-base font-semibold select-all">{value}</p>
      </div>
      <button type="button" onClick={() => copy(what)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-3 py-2 text-xs font-medium text-brand">
        {copied === what ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Venue Wi-Fi" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-[#f4f6fb] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><WifiIcon size={20} className="text-brand" /> Venue Wi-Fi</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/70 p-2"><X size={18} /></button>
        </div>

        {cellular && (
          <p role="status" className="mb-3 flex items-start gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
            <Smartphone size={16} className="mt-0.5 shrink-0" /> You are on mobile data. Join the venue Wi-Fi below to save your data.
          </p>
        )}

        <p className="mb-3 text-sm text-slate-600">Connect to <strong>{wifi.ssid}</strong>.</p>

        <div className="space-y-2">
          {row("Wi-Fi name", wifi.ssid, "name")}
          {wifi.open ? <p className="rounded-2xl bg-white p-3 text-sm text-slate-600">This network has no password.</p> : row("Password", wifi.password, "password")}
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
          {android ? "Open Wi-Fi settings, pick the network, then paste the password." : "On iPhone: Settings > Wi-Fi, tap the network, then paste the password."} Only signed-in customers can see this.
        </p>
      </div>
    </div>
  );
}
