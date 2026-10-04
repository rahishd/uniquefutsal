"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, ChevronDown, ChevronRight, Info, Radio, Tag, Trophy } from "lucide-react";
import { sampleFinished, sampleLive, sampleUpNext, sampleUpdates, type UpdateKind } from "@/lib/sample-data";

const KIND: Record<UpdateKind, { icon: typeof Bell; box: string }> = {
  alert: { icon: Bell, box: "bg-red-500/10 text-red-400" },
  promo: { icon: Tag, box: "bg-lime-300/10 text-lime-300" },
  tournament: { icon: Trophy, box: "bg-amber-400/10 text-amber-400" },
  info: { icon: Info, box: "bg-sky-400/10 text-sky-400" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
}

export default function HomeScreen() {
  const [open, setOpen] = useState<string | null>(null);
  const userName = "Player"; // TODO: from auth once login exists

  return (
    <div>
      <header className="flex items-start justify-between">
        <div>
          <p suppressHydrationWarning className="font-heading text-sm font-semibold uppercase tracking-widest text-slate-400">
            {greeting()}
          </p>
          <h1 className="font-heading mt-1 text-3xl font-bold leading-tight">
            {userName} <span aria-hidden>👋</span>
          </h1>
        </div>
        <Link
          href="/profile"
          aria-label="Profile"
          className="font-heading relative flex h-12 w-12 items-center justify-center rounded-full bg-brand text-base font-bold text-black"
        >
          {userName.slice(0, 2).toUpperCase()}
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0b0b10] bg-red-500" />
        </Link>
      </header>

      <Link
        href="/book"
        className="mt-6 flex items-center justify-between rounded-3xl bg-brand px-6 py-7 text-black shadow-[0_0_40px_-10px_rgba(200,241,53,0.5)] transition-transform active:scale-[0.99]"
      >
        <div>
          <p className="font-heading text-sm font-semibold uppercase tracking-widest text-black/60">Reserve now</p>
          <p className="font-heading mt-1 text-2xl font-bold">BOOK A COURT</p>
        </div>
        <div className="flex items-center gap-3">
          <CalendarDays size={28} />
          <ChevronRight size={22} />
        </div>
      </Link>

      <hr className="my-6 border-white/10" />

      <section aria-label="Live matches">
        <div className="flex items-center justify-between">
          <p className="font-heading flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-red-500">Live</span>
            <span className="font-medium normal-case tracking-normal text-slate-400">· Tournament Day 3</span>
          </p>
          <Trophy size={18} className="text-amber-400" />
        </div>

        <div className="mt-4 space-y-3">
          {sampleLive.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-card px-4 py-4">
              <div className="font-heading text-lg font-bold leading-snug">
                <p>{m.home}</p>
                <p>{m.away}</p>
              </div>
              <div className="text-center">
                <p className="font-heading text-3xl font-bold">
                  {m.homeScore} - {m.awayScore}
                </p>
                <p className="text-xs font-semibold text-red-500">{m.minute}&apos;</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-slate-400">{m.venue}</span>
                <span className="flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-[11px] font-bold uppercase text-red-500">
                  <Radio size={12} /> Live
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">FT · {sampleFinished.venue}</p>
            <p className="mt-2 text-slate-400">{sampleFinished.home}</p>
            <p className="font-heading text-lg font-bold text-slate-400">
              {sampleFinished.homeScore} - {sampleFinished.awayScore}
            </p>
            <p className="text-slate-400">{sampleFinished.away}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">Up next · {sampleUpNext.time}</p>
            <p className="mt-2 font-semibold">{sampleUpNext.home}</p>
            <p className="font-heading font-bold text-sky-400">VS</p>
            <p className="font-semibold">{sampleUpNext.away}</p>
          </div>
        </div>
      </section>

      <section aria-label="Updates" className="mt-8">
        <div className="flex items-center justify-between">
          <p className="font-heading text-sm font-bold uppercase tracking-widest text-slate-400">Updates</p>
          <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">
            {sampleUpdates.length} new
          </span>
        </div>
        <ul className="mt-4 space-y-3">
          {sampleUpdates.map((u) => {
            const { icon: Icon, box } = KIND[u.kind];
            const isOpen = open === u.id;
            return (
              <li key={u.id} className="rounded-2xl border border-white/10 bg-card">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : u.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${box}`}>
                    <Icon size={20} />
                  </span>
                  <span className="font-heading flex-1 text-lg font-bold leading-snug">{u.title}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                    {u.ago}
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {isOpen && <p className="px-4 pb-4 pl-[76px] text-sm text-slate-400">{u.body}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
