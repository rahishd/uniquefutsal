"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { formatHour, formatRs, parseKey } from "@/lib/booking";
import { detectUsualSlot, findRebookTarget } from "@/lib/rebook";
import { sampleBookingHistory } from "@/lib/sample-profile";
import { useSession } from "@/lib/session";

const noop = () => () => {};
const minuteKey = () => String(Math.floor(Date.now() / 60000));

export default function QuickRebook() {
  const tick = useSyncExternalStore(noop, minuteKey, () => "");
  const session = useSession();

  const view = useMemo(() => {
    if (!tick) return null;
    const usual = detectUsualSlot(sampleBookingHistory); // TODO: real booking history from the API
    if (!usual) return null; // new customer: no habit yet, so no card
    const now = new Date();
    return { usual, target: findRebookTarget(usual, now) };
  }, [tick]);

  // Only offer "Book again" when the usual slot is actually open.
  // Guests have no booking history, so there is no usual slot to offer.
  if (!session?.registered || !view || !view.target.available) return null;
  const { usual, target } = view;

  const day = parseKey(target.dateKey);
  const weekday = day.toLocaleDateString("en-US", { weekday: "long" });
  const nextDate = day.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const href = `/book?date=${target.dateKey}&hour=${usual.hour}`;

  return (
    <section aria-label="Quick rebook" className="glass mt-6 rounded-3xl p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
        <Zap size={14} className="fill-current" /> Book again
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-semibold leading-tight">{weekday}</p>
          <p className="text-sm text-slate-500">
            {formatHour(usual.hour)} – {formatHour(usual.hour + 1)}
          </p>
        </div>
        <p className="text-xl font-semibold">{formatRs(target.price)}</p>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Your usual slot · next {nextDate} · played {usual.count} of your last {usual.total}
      </p>

      <Link
        href={href}
        className="glass-btn mt-4 flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold tracking-wide text-white"
      >
        BOOK AGAIN <ArrowRight size={16} />
      </Link>
    </section>
  );
}
