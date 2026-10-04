"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsRight, Loader2, MapPin } from "lucide-react";
import { ARRIVAL_GRACE_MS, ARRIVAL_LEAD_MS, confirmComing, loadArrival, snoozeArrival } from "@/lib/arrival";
import { loadReminders, type ReminderEntry } from "@/lib/notifications";

const HANDLE = 64; // px, slider thumb size
const THRESHOLD = 0.88; // fraction of the track that counts as "slid all the way"

function pickDue(): ReminderEntry | null {
  const now = Date.now();
  const arrival = loadArrival();
  const due = loadReminders()
    .filter((r) => {
      if (arrival[r.id]?.coming) return false;
      if ((arrival[r.id]?.snoozeUntil ?? 0) > now) return false;
      return now >= r.startsAt - ARRIVAL_LEAD_MS && now < r.startsAt + ARRIVAL_GRACE_MS;
    })
    .sort((a, b) => a.startsAt - b.startsAt);
  return due[0] ?? null;
}

function countdown(startsAt: number, now: number) {
  const diff = startsAt - now;
  if (diff <= 0) return "Your game has started";
  const min = Math.ceil(diff / 60000);
  return min >= 60 ? `Your game starts in ${Math.floor(min / 60)}h ${min % 60}m` : `Your game starts in ${min} min`;
}

export default function ArrivalPrompt() {
  const [entry, setEntry] = useState<ReminderEntry | null>(null);
  const [now, setNow] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drag, setDrag] = useState(0); // px the thumb has moved
  const [isDragging, setIsDragging] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Check every 15s and when the tab becomes visible or a booking is added.
  useEffect(() => {
    const check = () => {
      setNow(Date.now());
      // Never swap out a prompt that is on screen; only the customer's own actions close it.
      setEntry((cur) => cur ?? pickDue());
    };
    const first = setTimeout(check, 0);
    const timer = setInterval(check, 15000);
    window.addEventListener("uf-reminders-changed", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("uf-reminders-changed", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  // Modal behaviour: lock page scroll, move focus in, keep Tab inside.
  useEffect(() => {
    if (!entry) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [entry]);

  // Track width drives how far the thumb can travel.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [entry, sent]);

  const confirm = useCallback(async () => {
    if (!entry || sending || sent) return;
    setSending(true);
    setError(null);
    try {
      await confirmComing(entry.id);
      navigator.vibrate?.(60);
      setSent(true);
    } catch {
      setError("We couldn't alert the venue. Please try again.");
      setDrag(0);
    } finally {
      setSending(false);
    }
  }, [entry, sending, sent]);

  function maxDrag() {
    return Math.max(0, trackW - HANDLE - 8);
  }

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (sending || sent) return;
    dragging.current = true;
    setIsDragging(true);
    startX.current = e.clientX - drag;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  }

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    setDrag(Math.min(maxDrag(), Math.max(0, e.clientX - startX.current)));
  }

  function onUp() {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (maxDrag() > 0 && drag / maxDrag() >= THRESHOLD) {
      setDrag(maxDrag());
      void confirm();
    } else {
      setDrag(0); // not far enough: spring back
    }
  }

  function onHandleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      setDrag(maxDrag());
      void confirm();
    }
  }

  function done() {
    setSent(false);
    setDrag(0);
    setEntry(null);
  }

  function later() {
    if (!entry) return;
    snoozeArrival(entry.id);
    setDrag(0);
    setEntry(null);
  }

  if (!entry) return null;

  const when = new Date(entry.startsAt).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  const progress = maxDrag() > 0 ? drag / maxDrag() : 0;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrival-title"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] px-6 pb-10 pt-16 text-white outline-none"
    >
      <p role="status" aria-live="assertive" className="sr-only">{sent ? "Confirmed. The venue has been notified that you are coming." : ""}</p>

      {sent ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
            <Check size={52} />
          </span>
          <h1 id="arrival-title" className="mt-6 text-3xl font-semibold">You&apos;re confirmed!</h1>
          <p className="mt-2 max-w-xs text-white/70">The venue knows you&apos;re on your way. See you on the pitch.</p>
          <p className="mt-6 rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-200">
            Demo mode: no real alert was sent yet. The venue alert needs the backend and admin panel.
          </p>
          <button type="button" onClick={done} className="glass-btn mt-8 rounded-full px-10 py-4 text-base font-semibold text-white">Done</button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-orange-200" aria-live="off">{countdown(entry.startsAt, now)}</span>
            <h1 id="arrival-title" className="mt-6 text-4xl font-semibold leading-tight">Are you on your way?</h1>
            <p className="mt-3 max-w-xs text-white/70">Let the venue know you&apos;re coming so your court is ready.</p>
            <div className="mt-8 rounded-3xl bg-white/10 px-6 py-4 text-sm backdrop-blur">
              <p className="text-lg font-medium">{when}</p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-white/70">
                <MapPin size={14} /> Unique Futsal{entry.label ? ` · ${entry.label}` : ""}
              </p>
              <p className="mt-1 font-mono text-xs text-white/50">{entry.id}</p>
            </div>
          </div>

          {error && <p role="alert" className="mb-4 rounded-2xl bg-rose-500/20 px-4 py-3 text-center text-sm text-rose-100">{error}</p>}

          {/* Slide to confirm */}
          <div
            ref={trackRef}
            className="relative h-[72px] select-none overflow-hidden rounded-full bg-white/15 p-1 ring-1 ring-white/30"
          >
            <div className="absolute inset-y-1 left-1 rounded-full bg-orange-400/40" style={{ width: drag + HANDLE }} aria-hidden />
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-base font-medium"
              style={{ opacity: 1 - progress }}
              aria-hidden
            >
              {sending ? "Alerting the venue…" : "Slide to say “I’m coming”"}
            </span>
            <button
              type="button"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={onHandleKey}
              disabled={sending}
              aria-label="I'm coming. Slide right, or press Enter, to confirm."
              style={{ transform: `translateX(${drag}px)`, width: HANDLE, height: HANDLE, touchAction: "none", transition: isDragging ? "none" : "transform 0.25s" }}
              className="glass-btn relative z-10 flex items-center justify-center rounded-full text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {sending ? <Loader2 size={26} className="animate-spin" /> : <ChevronsRight size={28} />}
            </button>
          </div>

          <button type="button" onClick={later} className="mt-5 py-2 text-center text-sm text-white/60 underline-offset-4 hover:underline">
            Remind me in 10 minutes
          </button>
        </>
      )}
    </div>
  );
}
