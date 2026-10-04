"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlarmClock, Bell, BellRing, CalendarCheck, CreditCard, Swords, X } from "lucide-react";
import {
  clearAll,
  getServerSnapshot,
  getSnapshot,
  markAllRead,
  markRead,
  notificationSupport,
  requestSystemPermission,
  subscribe,
  type Notice,
  type NoticeType,
} from "@/lib/notifications";

const META: Record<NoticeType, { icon: typeof Bell; tone: string; label: string }> = {
  challenge: { icon: Swords, tone: "bg-rose-500/10 text-rose-500", label: "Challenge" },
  payment: { icon: CreditCard, tone: "bg-emerald-500/10 text-emerald-600", label: "Payment" },
  booking: { icon: CalendarCheck, tone: "bg-brand/10 text-brand", label: "Booking" },
  reminder: { icon: AlarmClock, tone: "bg-amber-400/20 text-amber-600", label: "Reminder" },
};

function ago(ms: number) {
  const diff = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export default function NotificationBell() {
  const notices = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const unread = notices.filter((n) => !n.read).length;

  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<ReturnType<typeof notificationSupport>>("unsupported");
  const [announce, setAnnounce] = useState("");
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);

  // Tell screen-reader users when a new notification arrives (not on first load).
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(notices.map((n) => n.id));
      return;
    }
    const fresh = notices.filter((n) => !seen.current!.has(n.id));
    fresh.forEach((n) => seen.current!.add(n.id));
    if (fresh.length) setAnnounce(`New notification: ${fresh[0].title}. ${fresh[0].body}`);
  }, [notices]);

  // Open/close behaviour: focus the panel, close on Escape, return focus to the bell.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openNotice(n: Notice) {
    markRead(n.id);
    setOpen(false);
  }

  async function enableAlerts() {
    setPerm(await requestSystemPermission());
  }

  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setPerm(notificationSupport()); // read the browser's current permission each time it opens
          setOpen((o) => !o);
        }}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="glass relative flex h-12 w-12 items-center justify-center rounded-2xl text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Bell size={22} />
        {unread > 0 && (
          <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white">
            {badge}
          </span>
        )}
      </button>

      {/* Screen-reader announcements for new notifications */}
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Notifications"
            tabIndex={-1}
            className="absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2.5rem))] rounded-3xl p-4 outline-none shadow-[0_20px_50px_rgba(12,11,93,0.25)] ring-1 ring-white/80"
            style={{ background: "#ffffff" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Notifications</h2>
              <button type="button" onClick={() => { setOpen(false); btnRef.current?.focus(); }} aria-label="Close notifications" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {perm === "default" && (
              <button type="button" onClick={enableAlerts} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-brand/5 p-3 text-left text-sm">
                <BellRing size={20} className="shrink-0 text-brand" />
                <span>
                  <b className="block font-medium">Turn on alerts</b>
                  <span className="text-xs text-slate-500">Get a phone alert for challenges, payments and 1 hour before your game.</span>
                </span>
              </button>
            )}
            {perm === "denied" && (
              <p className="mt-3 rounded-2xl bg-amber-400/15 p-3 text-xs text-amber-700">
                Alerts are blocked in your browser settings. You&apos;ll still see notifications here.
              </p>
            )}

            {notices.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
            ) : (
              <>
                <ul className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {notices.map((n) => {
                    const { icon: Icon, tone, label } = META[n.type];
                    const inner = (
                      <>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`text-sm ${n.read ? "font-medium" : "font-semibold"}`}>
                              <span className="sr-only">{n.read ? "" : "Unread. "}{label}: </span>
                              {n.title}
                            </span>
                            {!n.read && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>
                          <span className="mt-1 block text-[11px] text-slate-400">{ago(n.at)}</span>
                        </span>
                      </>
                    );
                    const cls = `flex w-full gap-3 rounded-2xl p-3 text-left transition ${n.read ? "bg-white" : "bg-brand/5"} hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand`;
                    return (
                      <li key={n.id}>
                        {n.href ? (
                          <Link href={n.href} onClick={() => openNotice(n)} className={cls}>{inner}</Link>
                        ) : (
                          <button type="button" onClick={() => openNotice(n)} className={cls}>{inner}</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex justify-between text-xs font-medium">
                  <button type="button" onClick={markAllRead} disabled={unread === 0} className="text-brand disabled:text-slate-300">Mark all as read</button>
                  <button type="button" onClick={clearAll} className="text-slate-400 hover:text-rose-500">Clear all</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
