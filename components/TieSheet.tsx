"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Radio } from "lucide-react";
import { errorText } from "@/lib/api";
import { enablePush, pushState } from "@/lib/push";
import { useSession } from "@/lib/session";
import { followStore, matchTime, setFollowing, type TieMatch, type TieRound } from "@/lib/tournament";

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

// The bell on a match: tap to get a notification for kick-off, every goal and full time of THIS match.
function Follow({ m, following, onNote }: { m: TieMatch; following: boolean; onNote: (text: string) => void }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  if (m.status === "finished") return null;
  const label = following ? "Stop live updates for this match" : "Get live updates for this match";
  const cls = `grid h-8 w-8 shrink-0 place-items-center rounded-full ${following ? "bg-brand text-white" : "bg-brand/10 text-brand"}`;
  if (!session?.registered) return <Link href="/login" aria-label="Sign in to get live updates" className={cls}><Bell size={15} /></Link>;

  async function toggle() {
    setBusy(true);
    try {
      await setFollowing(m.id, !following);
      if (!following) {
        const push = await pushState();
        onNote(push === "on" ? "You will be notified at kick-off, for every goal and at full time." : "Following. You will see updates in your notifications. Turn on alerts in Profile > Settings to get them when the app is closed.");
      } else {
        onNote("Live updates are off for this match.");
      }
    } catch (e) {
      onNote(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={following} aria-label={label} title={label} className={`${cls} disabled:opacity-60`}>
      {following ? <BellRing size={15} /> : <Bell size={15} />}
    </button>
  );
}

function MatchCard({ m, following, onNote }: { m: TieMatch; following: boolean; onNote: (text: string) => void }) {
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
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="min-w-0 truncate">{m.note && m.status !== "live" ? m.note : matchTime(m) || m.venue || ""}</span>
        <span className="flex shrink-0 items-center gap-2">
          {m.status === "live" && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 font-medium text-rose-500">
              <Radio size={11} /> Live {m.note}
            </span>
          )}
          {done && <span className="font-medium text-slate-400">FT</span>}
          {m.status === "upcoming" && <span className="font-medium text-brand">Upcoming</span>}
          <Follow m={m} following={following} onNote={onNote} />
        </span>
      </div>
    </div>
  );
}

export default function TieSheet({ rounds }: { rounds: TieRound[] }) {
  const { data } = followStore.use();
  const following = new Set(data ?? []);
  const [note, setNote] = useState("");
  const [push, setPush] = useState<"" | "asking" | "done">("");
  const offer = note.startsWith("Following.") && push !== "done";

  async function turnOnAlerts() {
    setPush("asking");
    const r = await enablePush();
    setNote(r.ok ? "Alerts are on. You will be notified even when the app is closed." : r.error);
    setPush("done");
  }

  return (
    <div>
      <div className="-mx-5 overflow-x-auto px-5 pb-2" aria-label="Tie-sheet">
        <div className="flex gap-6">
          {rounds.map((round) => (
            <section key={round.id} className="flex shrink-0 flex-col">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{round.name}</h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.matches.map((m) => (
                  <MatchCard key={m.id} m={m} following={following.has(m.id)} onNote={(t) => { setNote(t); setPush(""); }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {note && (
        <p role="status" className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-600">
          {note}
          {offer && <button type="button" onClick={turnOnAlerts} disabled={push === "asking"} className="mt-2 block rounded-full bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-60">Turn on alerts when the app is closed</button>}
        </p>
      )}
      {!note && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Bell size={12} /> Tap the bell on a match to get live updates.</p>}
    </div>
  );
}
