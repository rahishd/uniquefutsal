"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { mediaUrl, trackAd, useContent, type AdItem } from "@/lib/content";

// A pop-up ad. It opens after the delay the venue chose and may close itself after its display time (0 = stays until closed).
// How often one person sees the same pop-up is the venue's choice: once per visit (session), once a day, or every time the app opens.
const KEY = "uf-popup-seen";

function alreadySeen(ad: AdItem): boolean {
  try {
    if (ad.popupFrequency === "always") return false;
    const store = ad.popupFrequency === "session" ? sessionStorage : localStorage;
    const raw = JSON.parse(store.getItem(KEY) ?? "{}") as Record<string, string>;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
    return ad.popupFrequency === "session" ? !!raw[ad.id] : raw[ad.id] === today;
  } catch {
    return false;
  }
}

function markSeen(ad: AdItem) {
  try {
    if (ad.popupFrequency === "always") return;
    const store = ad.popupFrequency === "session" ? sessionStorage : localStorage;
    const raw = JSON.parse(store.getItem(KEY) ?? "{}") as Record<string, string>;
    raw[ad.id] = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
    store.setItem(KEY, JSON.stringify(raw));
  } catch {
    /* private mode: the pop-up may show again, which is fine */
  }
}

export default function AdPopup() {
  const popups = useContent().ads.popup;
  const [shownId, setShownId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // the first pop-up this person has not seen yet (per its frequency rule)
  const next = popups.find((a) => !dismissed.includes(a.id) && !alreadySeen(a));
  const nextId = next?.id;
  const delay = next?.popupDelaySeconds ?? 3;

  useEffect(() => {
    if (!nextId || shownId) return;
    const t = setTimeout(() => setShownId(nextId), delay * 1000);
    return () => clearTimeout(t);
  }, [nextId, delay, shownId]);

  const ad = popups.find((a) => a.id === shownId) ?? null;
  const adId = ad?.id;
  const seconds = ad?.displaySeconds ?? 0;

  useEffect(() => {
    if (!ad) return;
    markSeen(ad);
    trackAd(ad.id, "view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId]);

  const close = () => {
    if (adId) setDismissed((d) => [...d, adId]);
    setShownId(null);
  };

  useEffect(() => {
    if (!adId || seconds <= 0) return;
    const t = setTimeout(() => {
      setDismissed((d) => [...d, adId]);
      setShownId(null);
    }, seconds * 1000);
    return () => clearTimeout(t);
  }, [adId, seconds]);

  useEffect(() => {
    if (!adId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId]);

  if (!ad) return null;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(ad.imageUrl)} alt={ad.title} className="max-h-[70vh] w-full rounded-3xl object-contain shadow-2xl" />
  );
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-5" role="dialog" aria-modal="true" aria-label="Advertisement" onClick={close}>
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={close} aria-label="Close advertisement" className="absolute -right-2 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg">
          <X size={20} />
        </button>
        {ad.linkUrl ? (
          ad.linkUrl.startsWith("/") ? (
            <Link href={ad.linkUrl} onClick={() => { trackAd(ad.id, "click"); close(); }}>{img}</Link>
          ) : (
            <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => { trackAd(ad.id, "click"); close(); }}>{img}</a>
          )
        ) : img}
        <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-white/70">Advertisement</p>
      </div>
    </div>
  );
}
