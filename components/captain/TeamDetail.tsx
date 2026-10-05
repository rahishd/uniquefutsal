"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Swords } from "lucide-react";
import CaptainGate from "@/components/captain/CaptainGate";
import ChallengeSheet from "@/components/captain/ChallengeSheet";
import Stars from "@/components/captain/Stars";
import { errorText } from "@/lib/api";
import { fetchTeam, type FormResult, type MyTeam, type TeamDetail as TeamData } from "@/lib/teams";

const FORM_STYLE: Record<FormResult, string> = {
  W: "bg-emerald-500 text-white",
  D: "bg-slate-300 text-slate-700",
  L: "bg-rose-500 text-white",
};

// Another team's stats (team stats only: there are no individual player stats anywhere).
function Detail({ id, myTeam }: { id: string; myTeam: MyTeam }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ id: string; team: TeamData | null; error: string | null } | null>(null);

  useEffect(() => {
    let off = false;
    fetchTeam(id)
      .then((team) => !off && setLoaded({ id, team, error: null }))
      .catch((e) => !off && setLoaded({ id, team: null, error: errorText(e) }));
    return () => {
      off = true;
    };
  }, [id]);

  if (!loaded || loaded.id !== id) return <div className="h-64 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  const team = loaded.team;
  if (!team) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium">{loaded.error ?? "Team not found"}</p>
        <Link href="/opponent" className="mt-3 inline-block text-sm text-brand">Back to opponents</Link>
      </div>
    );
  }

  const me = team.id === myTeam.id;
  const s = { ...team.record, gf: team.goalsFor, ga: team.goalsAgainst, form: team.form };

  return (
    <div className="space-y-5">
      <Link href="/opponent" className="inline-flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Opponents</Link>

      <header>
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <p className="text-sm text-slate-500">{team.area} · {team.players} players</p>
      </header>

      <section className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <Stars rating={team.rating} size={20} />
          {team.rank && <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Rank #{team.rank}</span>}
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
