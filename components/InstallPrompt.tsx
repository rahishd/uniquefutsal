"use client";

import { useEffect, useRef, useState } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";

// Chrome/Android fires this event when the app is installable.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "uf-install-dismissed";
const SHOW_DELAY_MS = 1500;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// iPhone/iPad Safari (iPadOS reports as a Mac with touch). Other iOS browsers are excluded.
function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);
  return ios && safari;
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (isIosSafari()) {
      timers.push(setTimeout(() => setMode("ios"), SHOW_DELAY_MS));
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep the event so we can show our own popup
      deferred.current = e as BeforeInstallPromptEvent;
      timers.push(setTimeout(() => setMode("android"), SHOW_DELAY_MS));
    };
    const onInstalled = () => setMode(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage blocked: popup may reappear next visit
    }
    setMode(null);
  }

  async function install() {
    const evt = deferred.current;
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferred.current = null;
    if (outcome === "dismissed") dismiss();
    else setMode(null);
  }

  if (!mode) return null;

  return (
    <div role="dialog" aria-label="Install Unique Futsal" className="fixed inset-x-0 bottom-32 z-[60] px-5">
      <div className="glass relative mx-auto max-w-sm rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.97)" }}>
        <button type="button" onClick={dismiss} aria-label="Close" className="absolute right-4 top-4 text-slate-400">
          <X size={18} />
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-base font-bold text-white shadow-md">UF</span>
          <div>
            <p className="font-medium">Get the Unique Futsal app</p>
            <p className="text-xs text-slate-500">Add it to your home screen for faster booking.</p>
          </div>
        </div>

        {mode === "android" ? (
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={dismiss} className="flex-1 rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600">Not now</button>
            <button type="button" onClick={install} className="glass-btn flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white">
              <Download size={16} /> Install
            </button>
          </div>
        ) : (
          <>
            <ol className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">1</span>
                Tap the <Share size={16} className="text-brand" aria-label="Share" /> Share button in Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">2</span>
                Choose <PlaceHolder /> <b>Add to Home Screen</b>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">3</span>
                Tap <b>Add</b>, and &ldquo;Unique Futsal&rdquo; appears on your home screen
              </li>
            </ol>
            <button type="button" onClick={dismiss} className="mt-4 w-full rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600">Got it</button>
          </>
        )}
      </div>
    </div>
  );
}

function PlaceHolder() {
  return <PlusSquare size={16} className="text-brand" aria-hidden />;
}
