"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell, CalendarDays, ChevronDown, Crown, Download, Gift, Search, ShieldCheck, Swords, Tag, Trophy, UserRound, Users, WalletCards, Wifi, Repeat, Phone, MessageCircle,
} from "lucide-react";
import { helpTopics, type HelpIcon } from "@/lib/help";
import { site } from "@/lib/site";

const ICONS: Record<HelpIcon, typeof Bell> = {
  book: CalendarDays,
  pay: WalletCards,
  rebook: Repeat,
  member: Crown,
  points: Gift,
  promo: Tag,
  bell: Bell,
  captain: Swords,
  profile: UserRound,
  trophy: Trophy,
  install: Download,
  guest: Users,
  wifi: Wifi,
};

export default function HelpPage() {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const topics = needle
    ? helpTopics.filter((t) => `${t.title} ${t.summary} ${t.points.join(" ")}`.toLowerCase().includes(needle))
    : helpTopics;

  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="text-sm text-slate-500">Short answers about how everything in the app works. Tap a topic to open it.</p>
      </header>

      <label className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
        <Search size={18} className="text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help, e.g. points, QR, captain"
          aria-label="Search help"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </label>

      {topics.length === 0 ? (
        <p className="glass rounded-3xl px-4 py-8 text-center text-sm text-slate-500">Nothing found for &ldquo;{q}&rdquo;. Try another word or contact us below.</p>
      ) : (
        <ul className="space-y-3 desk:grid desk:grid-cols-2 desk:items-start desk:gap-4 desk:space-y-0">
          {topics.map((t) => {
            const Icon = ICONS[t.icon] ?? ShieldCheck;
            const isOpen = open === t.id || Boolean(needle);
            return (
              <li key={t.id} className="glass overflow-hidden rounded-3xl">
                <button
                  type="button"
                  onClick={() => setOpen(open === t.id ? null : t.id)}
                  aria-expanded={isOpen}
                  aria-controls={`help-${t.id}`}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.title}</span>
                    <span className="block text-xs text-slate-500">{t.summary}</span>
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div id={`help-${t.id}`} className="border-t border-white/60 px-4 pb-4 pt-3">
                    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
                      {t.points.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                    {t.href && (
                      <Link href={t.href.to} className="glass-btn mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white">{t.href.label}</Link>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-semibold">Still confused?</h2>
        <p className="mt-1 text-xs text-slate-500">Talk to us. We reply fast.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <a href={`tel:${site.phone}`} className="glass flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-brand"><Phone size={16} /> Call</a>
          <a href={site.whatsapp} target="_blank" rel="noopener noreferrer" className="glass-btn flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white"><MessageCircle size={16} /> WhatsApp</a>
        </div>
      </section>
    </div>
  );
}
