import { Radio } from "lucide-react";
import { matchTime, type TieMatch, type TieRound } from "@/lib/tournament";

function Row({ name, score, winner }: { name: string | null; score?: number | null; winner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`truncate text-sm ${name ? (winner ? "font-semibold" : "text-slate-600") : "italic text-slate-400"}`}>
        {name ?? "To be decided"}
      </span>
      <span className={`text-sm tabular-nums ${winner ? "font-semibold text-brand" : "text-slate-500"}`}>
        {score ?? "–"}
      </span>
    </div>
  );
}

function MatchCard({ m }: { m: TieMatch }) {
  const done = m.status === "finished";
  const homeWins = done && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWins = done && (m.awayScore ?? 0) > (m.homeScore ?? 0);
  // level score after a shoot-out: the note says who won, keep both unbolded
  return (
    <div className="glass w-60 shrink-0 rounded-2xl p-4">
      <div className="space-y-2">
        <Row name={m.home} score={m.homeScore} winner={homeWins} />
        <Row name={m.away} score={m.awayScore} winner={awayWins} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>{m.note && m.status !== "live" ? m.note : matchTime(m) || m.venue || ""}</span>
        {m.status === "live" && (
          <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-500">
            <Radio size={11} /> Live {m.note}
          </span>
        )}
        {done && <span className="font-medium text-slate-400">FT</span>}
        {m.status === "upcoming" && <span className="font-medium text-brand">Upcoming</span>}
      </div>
    </div>
  );
}

export default function TieSheet({ rounds }: { rounds: TieRound[] }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2" aria-label="Tie-sheet">
      <div className="flex gap-6">
        {rounds.map((round) => (
          <section key={round.id} className="flex shrink-0 flex-col">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{round.name}</h3>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {round.matches.map((m) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
