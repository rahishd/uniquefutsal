"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Trash2, UserPlus } from "lucide-react";
import CaptainGate from "@/components/captain/CaptainGate";
import Stars from "@/components/captain/Stars";
import { MAX_TEAM_SIZE, addMember, removeMember, useTeams, type MyTeam } from "@/lib/teams";

function Roster({ team }: { team: MyTeam }) {
  const state = useTeams();
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!state) return null;
  const me = team;
  const s = { played: team.record.played, wins: team.record.wins, draws: team.record.draws, losses: team.record.losses, gf: team.goalsFor, ga: team.goalsAgainst };
  const full = team.members.length >= MAX_TEAM_SIZE;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addMember(phone);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "The player was added to your team." });
      setPhone("");
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Captain profile</p>
        <h1 className="mt-1 text-2xl font-semibold">{team.name}</h1>
      </header>

      <section className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <Stars rating={me.rating} size={20} />
          {me.rank && <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Rank #{me.rank}</span>}
        </div>
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[["Played", s.played], ["Won", s.wins], ["Drawn", s.draws], ["Lost", s.losses]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/60 py-2.5"><dd className="text-lg font-semibold">{v}</dd><dt className="text-[11px] text-slate-400">{k}</dt></div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-400">Goals {s.gf} for · {s.ga} against. Ratings use only results the other captain has approved.</p>
        <Link href="/opponent" className="mt-3 flex items-center justify-between rounded-2xl bg-brand/5 px-4 py-3 text-sm font-medium text-brand">
          Find opponents and manage challenges <ChevronRight size={16} />
        </Link>
      </section>

      <section className="glass rounded-3xl p-5" aria-label="Team members">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Players</h2>
          <span className="text-sm text-slate-500" aria-live="polite">{team.members.length} / {MAX_TEAM_SIZE}</span>
        </div>

        <ul className="space-y-2">
          {team.members.map((m) => {
            const isCaptain = m.isCaptain;
            return (
              <li key={m.userId} className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {m.name}
                    {isCaptain && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-[#0c0b5d]" title="Captain">C</span>}
                  </p>
                  <p className="text-xs text-slate-400">{m.position}</p>
                </div>
                {!isCaptain && (
                  <button type="button" onClick={async () => { const r = await removeMember(m.userId); if (!r.ok) setMsg({ ok: false, text: r.error }); }} aria-label={`Remove ${m.name}`} className="shrink-0 text-slate-400 hover:text-rose-500"><Trash2 size={17} /></button>
                )}
              </li>
            );
          })}
        </ul>

        <form onSubmit={add} className="mt-4">
          <label htmlFor="add-phone" className="text-xs font-medium text-slate-500">Add a registered player by mobile number</label>
          <div className="mt-2 flex gap-2">
            <input
              id="add-phone"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setMsg(null); }}
              inputMode="numeric"
              placeholder="98XXXXXXXX"
              disabled={full}
              className="min-w-0 flex-1 rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand disabled:opacity-50"
            />
            <button type="submit" disabled={full || phone.length === 0 || busy} className="flex items-center gap-1.5 rounded-2xl bg-brand px-4 text-sm font-medium text-white disabled:opacity-50"><UserPlus size={16} /> Add</button>
          </div>
          {full && <p className="mt-2 text-xs text-slate-500">Your team is full. Remove a player to add someone new.</p>}
          {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-emerald-600" : "text-rose-500"}`}>{msg.text}</p>}
        </form>
      </section>
    </div>
  );
}

export default function TeamPage() {
  return <CaptainGate>{(team) => <Roster team={team} />}</CaptainGate>;
}
