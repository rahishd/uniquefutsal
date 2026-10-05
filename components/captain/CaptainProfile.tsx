"use client";

import Link from "next/link";
import { ChevronRight, Swords, Users } from "lucide-react";
import Stars from "@/components/captain/Stars";
import { MAX_TEAM_SIZE, pendingActions, setMode, useTeams } from "@/lib/teams";

// Switch between the Player profile and the Captain profile (any registered player can be a captain).
export function ModeToggle() {
  const state = useTeams();
  const captain = state?.mode === "captain";
  return (
    <div role="radiogroup" aria-label="Profile mode" className="grid grid-cols-2 gap-1 rounded-full bg-white/60 p-1 text-sm font-medium">
      {(["player", "captain"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={(m === "captain") === captain}
          onClick={() => void setMode(m)}
          className={`flex items-center justify-center gap-2 rounded-full py-2.5 ${(m === "captain") === captain ? "glass-active text-white" : "text-slate-500"}`}
        >
          {m === "captain" && <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-[#0c0b5d]">C</span>}
          {m === "player" ? "Player profile" : "Captain profile"}
        </button>
      ))}
    </div>
  );
}

// The Captain profile: your team, its 5-star rating and what needs your action.
export function CaptainSummary() {
  const state = useTeams();
  if (!state) return null;

  if (!state.team) {
    return (
      <section className="glass rounded-3xl p-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-600"><Users size={26} /></span>
        <h2 className="mt-3 text-lg font-semibold">Start your team</h2>
        <p className="mt-1 text-sm text-slate-500">As captain you can add up to {MAX_TEAM_SIZE - 1} players, challenge other teams and upload match results.</p>
        <Link href="/opponent" className="glass-btn mt-4 inline-block rounded-full px-8 py-3 text-sm font-semibold text-white">Create your team</Link>
      </section>
    );
  }

  const team = state.team;
  const todo = pendingActions(state);
  const s = team.record;

  return (
    <section aria-label="Captain profile" className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Captain</p>
        <h2 className="mt-1 text-xl font-semibold">{team.name}</h2>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-2xl bg-white px-3 py-1.5"><Stars rating={team.rating} size={16} /></span>
          {team.rank && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Rank #{team.rank}</span>}
        </div>
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[["Played", s.played], ["Won", s.wins], ["Lost", s.losses], ["Players", `${team.players}/${MAX_TEAM_SIZE}`]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/10 py-2.5"><dd className="text-lg font-semibold">{v}</dd><dt className="text-[11px] text-white/60">{k}</dt></div>
          ))}
        </dl>
      </div>

      <Link href="/opponent" className="glass flex items-center justify-between rounded-2xl px-4 py-4">
        <span className="flex items-center gap-3 text-sm font-medium"><Swords size={20} className="text-rose-500" /> Opponents, challenges and results</span>
        <span className="flex items-center gap-2">
          {todo > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white" aria-label={`${todo} need your action`}>{todo}</span>}
          <ChevronRight size={18} className="text-slate-400" />
        </span>
      </Link>
      <Link href="/team" className="glass flex items-center justify-between rounded-2xl px-4 py-4">
        <span className="flex items-center gap-3 text-sm font-medium"><Users size={20} className="text-brand" /> Manage players</span>
        <ChevronRight size={18} className="text-slate-400" />
      </Link>
    </section>
  );
}
