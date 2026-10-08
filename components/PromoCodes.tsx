"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Copy } from "lucide-react";
import { fmtDay, promosStore } from "@/lib/promos";

export default function PromoCodes() {
  const [copied, setCopied] = useState<string | null>(null);
  const live = (promosStore.use().data ?? []).filter((p) => p.status === "active");

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      // clipboard blocked: nothing to do
    }
  }

  if (live.length === 0) return null;

  return (
    <section className="mt-8 desk:mt-10" aria-label="Live promo codes">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live promo codes
        </h2>
        <Link href="/promos" className="flex items-center text-sm text-brand">
          See all <ChevronRight size={16} />
        </Link>
      </div>

      <ul className="-mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2 desk:mx-0 desk:grid desk:grid-cols-1 desk:gap-3 desk:overflow-visible desk:px-0">
        {live.map((p) => (
          <li key={p.code} className="glass w-64 shrink-0 snap-start rounded-3xl p-4 desk:w-auto">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{p.description}</p>
              </div>
              <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-accent">{p.discount}</span>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-brand/40 bg-white/50 px-3 py-2">
              <span className="font-mono text-sm font-semibold tracking-wider">{p.code}</span>
              <button
                type="button"
                onClick={() => copy(p.code)}
                aria-label={`Copy code ${p.code}`}
                className="flex items-center gap-1 text-xs font-medium text-brand"
              >
                {copied === p.code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{p.until ? `Valid until ${fmtDay(p.until)}` : "No end date"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
