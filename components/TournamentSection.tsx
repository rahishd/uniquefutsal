"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Radio, Trophy } from "lucide-react";
import { fmtDay } from "@/lib/promos";
import { formatRs } from "@/lib/booking";
import { site } from "@/lib/site";
import { tournamentStore } from "@/lib/tournament";

export default function TournamentSection() {
  const t = tournamentStore.use().data ?? null;
  if (!t) return null; // no tournament hosted

  const live = t.rounds.flatMap((r) => r.matches).filter((m) => m.status === "live");

  return (
    <section className="mt-8" aria-label="Tournament">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Tournament</h2>
        <Link href="/tournaments" className="flex items-center text-sm text-brand">
          Tie-sheet <ChevronRight size={16} />
        </Link>
      </div>

      <div className="glass mt-4 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium leading-snug">{t.name}</p>
            <p className="mt-1 text-xs text-slate-400">
              {fmtDay(t.startDate)} – {fmtDay(t.endDate)} · {t.teams} teams
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={12} /> {site.name}, {site.address}
            </p>
          </div>
          {t.prizePool > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-600">
              <Trophy size={12} /> {formatRs(t.prizePool)}
            </span>
          )}
        </div>

        {live.length > 0 && (
          <ul className="mt-4 space-y-2">
            {live.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3">
                <div className="text-sm font-medium leading-snug">
                  <p>{m.home}</p>
                  <p>{m.away}</p>
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {m.homeScore ?? 0} - {m.awayScore ?? 0}
                </p>
                <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-500">
                  <Radio size={11} /> Live {m.note}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/tournaments"
          className="glass-btn mt-4 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white"
        >
          View full tie-sheet
        </Link>
      </div>
    </section>
  );
}
