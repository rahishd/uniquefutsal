"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Crown, Gamepad2 } from "lucide-react";
import { fmtDay, promosStore, type Promo } from "@/lib/promos";

type Tab = "active" | "expired";
const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "expired", label: "Expired" },
];

function when(p: Promo) {
  if (p.status === "expired") return { text: p.until ? `Ended ${fmtDay(p.until)}` : "Ended", soon: false };
  if (p.daysLeft === null || !p.until) return { text: "No end date", soon: false };
  if (p.daysLeft <= 0) return { text: "Ends today", soon: true };
  if (p.daysLeft <= 5) return { text: `Ends in ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"}`, soon: true };
  return { text: `Valid until ${fmtDay(p.until)}`, soon: false };
}

export default function PromosPage() {
  const store = promosStore.use();
  const [tab, setTab] = useState<Tab>("active");
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      // clipboard blocked: the code is still shown on the card
    }
  }

  if (store.status === "error") return <p role="alert" className="glass rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{store.error}</p>;
  if (!store.data) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const all = store.data;
  const counts = { active: all.filter((p) => p.status === "active").length, expired: all.filter((p) => p.status === "expired").length };
  const list = all.filter((p) => p.status === tab);

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="text-2xl font-semibold">Promos</h1>
        <p className="text-sm text-slate-500">Copy a code and enter it when you book.</p>
      </header>

      <div role="tablist" aria-label="Promo status" className="glass grid grid-cols-2 rounded-full p-1 text-sm">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-full py-2 font-medium ${tab === t.id ? "glass-active text-white" : "text-slate-500"}`}>
            {t.label} <span className={tab === t.id ? "text-white/70" : "text-slate-400"}>({counts[t.id]})</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="glass rounded-3xl px-4 py-10 text-center text-sm text-slate-500">{tab === "active" ? "No active offers right now. Check back soon." : "No expired offers."}</p>
      ) : (
        <ul className="space-y-4 desk:grid desk:grid-cols-2 desk:items-start desk:gap-5 desk:space-y-0 xl:desk:grid-cols-3" role="tabpanel">
          {list.map((p) => {
            const w = when(p);
            const live = p.status === "active";
            const Icon = p.kind === "membership" ? Crown : Gamepad2;
            return (
              <li key={p.code} className={`glass rounded-3xl p-5 ${live ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon size={18} /></span>
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-slate-500">{p.description}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">{p.kind === "membership" ? "Membership" : "Bookings"}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${live ? "bg-orange-500/10 text-accent" : "bg-slate-200 text-slate-500"}`}>{p.discount}</span>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-brand/40 bg-white/50 px-3 py-2.5">
                  <span className={`font-mono text-sm font-semibold tracking-wider ${live ? "" : "line-through"}`}>{p.code}</span>
                  {live && (
                    <button type="button" onClick={() => copy(p.code)} aria-label={`Copy code ${p.code}`} className="flex items-center gap-1 text-xs font-medium text-brand">
                      {copied === p.code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                  )}
                </div>

                <p className={`mt-3 text-xs font-medium ${w.soon ? "text-orange-600" : "text-slate-500"}`}>{w.text}</p>
                <p className="mt-1 text-[11px] text-slate-400">{p.terms}</p>

                {live && (
                  <Link href={p.kind === "membership" ? "/member" : "/book"} className="glass-btn mt-4 block rounded-full py-3 text-center text-sm font-medium text-white">
                    {p.kind === "membership" ? "View membership" : "Book a game"}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="px-2 text-center text-xs text-slate-400">The final discount is confirmed when you pay. One code per booking.</p>
    </div>
  );
}
