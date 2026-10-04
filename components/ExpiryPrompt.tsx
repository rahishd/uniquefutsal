"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, X } from "lucide-react";
import { dateKey } from "@/lib/booking";
import { addNotice } from "@/lib/notifications";
import {
  BILLING_LABEL,
  PLANS,
  daysLeft,
  fmtDate,
  needsExpiryNotice,
  sampleCurrent, // TODO: the signed-in customer's real membership from the API
} from "@/lib/membership";

const KEY = "uf-expiry-dismissed-v1"; // { [membershipId]: "YYYY-MM-DD" it was last dismissed }
const SHOW_DELAY_MS = 2500;

function dismissedToday(id: string, today: string) {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>)[id] === today;
  } catch {
    return false;
  }
}

function dismiss(id: string, today: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
    all[id] = today;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage blocked: it may show again on the next page load
  }
}

// Pop-up for 3 and 6 month members, from 15 days before their plan ends.
// It returns once a day until they renew or the plan ends; monthly plans never see it.
export default function ExpiryPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<{ left: number; plan: string; length: string; end: string } | null>(null);
  const m = sampleCurrent;

  useEffect(() => {
    const today = dateKey(new Date());
    if (!needsExpiryNotice(m, today) || dismissedToday(m.id, today)) return;

    const left = daysLeft(m.endKey, today);
    const plan = PLANS.find((p) => p.id === m.planId)?.name ?? "membership";
    const details = { left, plan, length: BILLING_LABEL[m.billing], end: fmtDate(m.endKey) };

    // One bell notice (and phone alert, if allowed) per membership; the pop-up repeats daily.
    addNotice({
      id: `membership-expiring-${m.id}-${m.endKey}`,
      type: "membership",
      title: "Your membership ends soon",
      body: `Your ${plan} ${details.length} plan ends in ${left} day${left === 1 ? "" : "s"} (${details.end}). Renew to keep your member pricing.`,
      href: "/member",
    });

    const t = setTimeout(() => {
      setInfo(details);
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [m]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") later();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function later() {
    dismiss(m.id, dateKey(new Date()));
    setOpen(false);
  }

  // No need to nag on the membership page itself.
  if (!open || !info || pathname.startsWith("/member")) return null;

  return (
    <div role="dialog" aria-labelledby="expiry-title" aria-describedby="expiry-body" className="fixed inset-x-0 top-4 z-[70] px-5">
      <div className="relative mx-auto max-w-sm rounded-3xl bg-white p-5 shadow-[0_20px_50px_rgba(12,11,93,0.3)] ring-1 ring-white/80">
        <button type="button" onClick={later} aria-label="Dismiss" className="absolute right-4 top-4 text-slate-400">
          <X size={18} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-600">
            <Crown size={22} />
          </span>
          <div>
            <p id="expiry-title" className="font-semibold">
              Your membership ends in {info.left} day{info.left === 1 ? "" : "s"}
            </p>
            <p id="expiry-body" className="mt-1 text-sm text-slate-500">
              Your {info.plan} {info.length} plan ends on {info.end}. Renew now to keep your member pricing and rewards.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={later} className="flex-1 rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600">
            Remind me tomorrow
          </button>
          <Link href="/member" onClick={later} className="glass-btn flex-1 rounded-full py-3 text-center text-sm font-medium text-white">
            Renew now
          </Link>
        </div>
      </div>
    </div>
  );
}
