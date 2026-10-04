import Link from "next/link";
import { ChevronLeft, MapPin, CalendarDays, Trophy, Users } from "lucide-react";
import PlaceholderPage from "@/components/PlaceholderPage";
import TieSheet from "@/components/TieSheet";
import { sampleTournament as t } from "@/lib/sample-data";

export default function TournamentsPage() {
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
            <dd className="font-medium">{t.startDate} – {t.endDate}</dd>
          </div>
        </div>
        <div className="flex gap-2">
          <Users size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">Format</dt>
            <dd className="font-medium">{t.format}</dd>
          </div>
        </div>
        <div className="col-span-2 flex gap-2">
          <MapPin size={18} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <dt className="text-xs text-slate-400">Venue</dt>
            <dd className="font-medium">{t.venue}</dd>
          </div>
        </div>
        <div className="col-span-2 flex gap-2">
          <Trophy size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="w-full">
            <dt className="text-xs text-slate-400">Prize pool · {t.prizePool}</dt>
            <dd className="mt-1 grid grid-cols-3 gap-2 text-center text-xs">
              <span className="rounded-xl bg-white/60 py-2"><b className="block text-sm">{t.prizes.first}</b>1st</span>
              <span className="rounded-xl bg-white/60 py-2"><b className="block text-sm">{t.prizes.second}</b>2nd</span>
              <span className="rounded-xl bg-white/60 py-2"><b className="block text-sm">{t.prizes.third}</b>3rd</span>
            </dd>
          </div>
        </div>
      </dl>

      <h2 className="mb-3 mt-8 text-lg font-medium">Tie-sheet</h2>
      <TieSheet rounds={t.rounds} />
      <p className="mt-2 text-xs text-slate-400">Swipe sideways to see every round.</p>
    </div>
  );
}
