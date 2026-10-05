"use client";

import Link from "next/link";
import { ChevronLeft, MapPin, CalendarDays, Trophy, Users } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";
import TieSheet from "@/components/TieSheet";
import { formatRs } from "@/lib/booking";
import { fmtDay } from "@/lib/promos";
import { site } from "@/lib/site";
import { tournamentStore } from "@/lib/tournament";

export default function TournamentsPage() {
  const store = tournamentStore.use();
  if (store.status === "error") return <p role="alert" className="glass rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{store.error}</p>;
  if (store.status === "idle" || store.status === "loading") return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  const t = store.data ?? null;
  if (!t) {
    return <PlaceholderPage icon={Trophy} title="No tournament right now" note="Check back soon for the next one." />;
  }

  return (
    <div>
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-brand">
        <ChevronLeft size={18} /> Home
      </Link>

      <header className="mt-4">
        <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium capitalize text-rose-500">{t.status}</span>
        <h1 className="mt-3 text-2xl font-semibold leading-tight">{t.name}</h1>
      </header>

      <dl className="glass mt-5 grid grid-cols-2 gap-4 rounded-3xl p-5 text-sm">
        <div className="flex gap-2">
          <CalendarDays size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">Dates</dt>
            <dd className="font-medium">{fmtDay(t.startDate)} – {fmtDay(t.endDate)}</dd>
          </div>
        </div>
        <div className="flex gap-2">
          <Users size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">{t.format ? "Format" : "Teams"}</dt>
            <dd className="font-medium">{t.format ?? `${t.teams} teams`}</dd>
          </div>
        </div>
        <div className="col-span-2 flex gap-2">
          <MapPin size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">Venue</dt>
            <dd className="font-medium">{site.name}, {site.address}</dd>
          </div>
        </div>
        {t.prizePool > 0 && (
          <div className="col-span-2 flex gap-2">
            <Trophy size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="w-full">
              <dt className="text-xs text-slate-400">Prize pool · {formatRs(t.prizePool)}</dt>
              {t.prizes && (
                <dd className="mt-1 grid grid-cols-3 gap-2 text-center text-xs">
                  {[["1st", t.prizes.first], ["2nd", t.prizes.second], ["3rd", t.prizes.third]].map(([k, v]) => v && (
                    <span key={k} className="rounded-xl bg-white/60 py-2"><b className="block text-sm">{v}</b>{k}</span>
                  ))}
                </dd>
              )}
            </div>
          </div>
        )}
      </dl>

      <h2 className="mb-3 mt-8 text-lg font-medium">Tie-sheet</h2>
      {t.rounds.length === 0 ? (
        <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-slate-500">The tie-sheet will appear here once the draw is made.</p>
      ) : (
        <>
          <TieSheet rounds={t.rounds} />
          <p className="mt-2 text-xs text-slate-400">Swipe sideways to see every round.</p>
        </>
      )}
    </div>
  );
}
