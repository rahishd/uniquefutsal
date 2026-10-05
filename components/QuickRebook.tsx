"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { formatHour, formatRs, parseKey, rebookStore } from "@/lib/booking";
import { useSession } from "@/lib/session";

// "Book again": the server works out the customer's usual weekday + hour from their last games and the next
// date it is open (GET /bookings/me/rebook). It returns nothing for a new customer or when the slot is taken.
export default function QuickRebook() {
  const session = useSession();
  const view = rebookStore.use().data ?? null;

  // Only offer "Book again" when the usual slot is actually open. Guests have no booking history.
  if (!session?.registered || !view || !view.target.available || !view.target.date) return null;
  const { usual, target } = view;

  const day = parseKey(target.date!);
  const weekday = day.toLocaleDateString("en-US", { weekday: "long" });
  const nextDate = day.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const href = `/book?date=${target.date}&hour=${usual.hour}`;

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
        <p className="text-xl font-semibold">{formatRs(target.price ?? 0)}</p>
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
