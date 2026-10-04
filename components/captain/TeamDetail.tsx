"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Swords } from "lucide-react";
import CaptainGate from "@/components/captain/CaptainGate";
import ChallengeSheet from "@/components/captain/ChallengeSheet";
import Stars from "@/components/captain/Stars";
import { allTeams, getOtherTeam, rankTeams, useTeams, type FormResult, type Team } from "@/lib/teams";

const FORM_STYLE: Record<FormResult, string> = {
  W: "bg-emerald-500 text-white",
  D: "bg-slate-300 text-slate-700",
  L: "bg-rose-500 text-white",
};

function Detail({ id, myTeam }: { id: string; myTeam: Team }) {
  const state = useTeams();
  const [open, setOpen] = useState(false);
  if (!state) return null;

  const team = id === myTeam.id ? myTeam : getOtherTeam(state, id);
  if (!team) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium">Team not found</p>
        <Link href="/opponent" className="mt-3 inline-block text-sm text-brand">Back to opponents</Link>
      </div>
    );
  }

  const me = team.id === myTeam.id;
  const ranked = rankTeams(allTeams(state)).find((r) => r.team.id === team.id);
  const s = team.stats;
  const sorted = [...team.members].sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists);

  return (
    <div className="space-y-5">
      <Link href="/opponent" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Opponents</Link>

      <header>
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <p className="text-sm text-slate-500">{team.area} · {team.members.length} players</p>
      </header>

      <section className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <Stars rating={ranked?.rating ?? null} size={20} />
          {ranked?.rank && <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Rank #{ranked.rank}</span>}
        </div>
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[["Played", s.played], ["Won", s.wins], ["Drawn", s.draws], ["Lost", s.losses]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/60 py-2.5"><dd className="text-lg font-semibold">{v}</dd><dt className="text-[11px] text-slate-400">{k}</dt></div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Goals {s.gf} for · {s.ga} against</span>
          <span className="flex gap-1" aria-label={`Recent form: ${s.form.slice(-5).join(" ")}`}>
            {s.form.slice(-5).map((r, i) => <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${FORM_STYLE[r]}`}>{r}</span>)}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">Stats include only results confirmed by both captains.</p>
      </section>

      <section className="glass rounded-3xl p-5" aria-label="Player stats">
        <h2 className="mb-3 text-base font-medium">Player stats</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                <th className="pb-2 font-semibold">Player</th>
                <th className="pb-2 text-center font-semibold">Pos</th>
                <th className="pb-2 text-center font-semibold">GP</th>
                <th className="pb-2 text-center font-semibold">G</th>
                <th className="pb-2 text-center font-semibold">A</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id} className="border-t border-white/70">
                  <td className="py-2.5 font-medium">
                    {m.name}
                    {m.id === team.captainId && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-[#0c0b5d]">C</span>}
                  </td>
                  <td className="py-2.5 text-center text-slate-500">{m.position}</td>
                  <td className="py-2.5 text-center text-slate-500">{m.stats.games}</td>
                  <td className="py-2.5 text-center font-semibold">{m.stats.goals}</td>
                  <td className="py-2.5 text-center text-slate-500">{m.stats.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">GP games played · G goals · A assists</p>
      </section>

      {!me && (
        <button type="button" onClick={() => setOpen(true)} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-semibold text-white">
          <Swords size={18} /> Challenge {team.name}
        </button>
      )}
      {open && <ChallengeSheet target={team} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default function TeamDetail({ id }: { id: string }) {
  return <CaptainGate>{(myTeam) => <Detail id={id} myTeam={myTeam} />}</CaptainGate>;
}
