"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronRight, Swords, Trophy, Users, X } from "lucide-react";
import CaptainGate from "@/components/captain/CaptainGate";
import ChallengeSheet from "@/components/captain/ChallengeSheet";
import Stars from "@/components/captain/Stars";
import { formatHour, formatRs, parseKey, priceFor } from "@/lib/booking";
import {
  allTeams,
  answerChallenge,
  approveResult,
  cancelChallenge,
  demoAdminMarksPaid,
  demoOpponentAnswers,
  demoOpponentApproves,
  disputeResult,
  getOtherTeam,
  pendingActions,
  rankTeams,
  settlement,
  shareLabel,
  splitPreview,
  submitResult,
  useTeams,
  type Challenge,
  type Result,
  type Team,
} from "@/lib/teams";

type Tab = "teams" | "challenges" | "results";

const noop = () => () => {};
const minute = () => Math.floor(Date.now() / 60000) * 60000;

function whenText(c: { date: string; hour: number }) {
  return `${parseKey(c.date).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })} · ${formatHour(c.hour)}`;
}

function startsAt(c: { date: string; hour: number }) {
  const d = parseKey(c.date);
  d.setHours(c.hour, 0, 0, 0);
  return d.getTime();
}

const chip = (cls: string) => `rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`;

function Hub({ team, reportId }: { team: Team; reportId?: string }) {
  const state = useTeams();
  const nowMs = useSyncExternalStore(noop, minute, () => 0);
  // Opening /opponent?report=<game> (from the "Did you win?" popup) lands on that game's score form.
  const [tab, setTab] = useState<Tab>(reportId ? "results" : "teams");
  const [target, setTarget] = useState<Team | null>(null);
  const [reporting, setReporting] = useState<string | null>(reportId ?? null);

  if (!state || !nowMs) return null;

  const ranked = rankTeams(allTeams(state));
  const nameOf = (id: string) => (id === "me" ? team.name : getOtherTeam(state, id)?.name ?? "Unknown team");
  const incoming = state.challenges.filter((c) => c.direction === "in" && c.status === "pending");
  const awaitingMyApproval = state.results.filter((r) => r.submittedBy === "them" && r.status === "awaiting_approval");
  const awaitingTheirs = state.results.filter((r) => r.submittedBy === "me" && r.status === "awaiting_approval");
  const history = state.results.filter((r) => r.status !== "awaiting_approval");
  const reportable = state.challenges.filter(
    (c) => c.status === "accepted" && startsAt(c) <= nowMs && !state.results.some((r) => r.challengeId === c.id && r.status !== "disputed"),
  );
  const todo = pendingActions(state);

  function goReport(id: string) {
    setReporting(id);
    setTab("results");
  }

  const tabs: { id: Tab; label: string; icon: typeof Users; badge: number }[] = [
    { id: "teams", label: "Teams", icon: Users, badge: 0 },
    { id: "challenges", label: "Challenges", icon: Swords, badge: incoming.length },
    { id: "results", label: "Results", icon: Trophy, badge: awaitingMyApproval.length + reportable.length },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Opponents</h1>
          <p className="text-sm text-slate-500">Captain of {team.name}{todo > 0 ? ` · ${todo} need${todo === 1 ? "s" : ""} your action` : ""}</p>
        </div>
        <Link href="/team" className="shrink-0 rounded-full bg-white/70 px-4 py-2 text-xs font-medium text-brand">My team</Link>
      </header>

      <div role="tablist" aria-label="Opponent sections" className="grid grid-cols-3 gap-1 rounded-full bg-white/60 p-1 text-sm font-medium">
        {tabs.map(({ id, label, badge }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`relative rounded-full py-2 ${tab === id ? "glass-active text-white" : "text-slate-500"}`}>
            {label}
            {badge > 0 && <span aria-label={`${badge} need action`} className="absolute -right-0.5 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white">{badge}</span>}
          </button>
        ))}
      </div>

      {/* ---------------- Teams ---------------- */}
      {tab === "teams" && (
        <section aria-label="Team rankings">
          <p className="mb-3 text-xs text-slate-400">Ranked by 5-star rating from confirmed results: win rate, goal difference and recent form.</p>
          <ol className="space-y-3">
            {ranked.map(({ team: t, rating, rank }) => {
              const mine = t.id === team.id;
              const s = t.stats;
              return (
                <li key={t.id} className={`glass rounded-3xl p-4 ${mine ? "ring-2 ring-brand/50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{rank ?? "–"}</span>
                      <div>
                        <p className="font-semibold leading-tight">{t.name}{mine && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-[#0c0b5d]">YOU</span>}</p>
                        <p className="text-xs text-slate-400">{t.area} · {t.members.length} players · {s.wins}W {s.draws}D {s.losses}L</p>
                      </div>
                    </div>
                    <Stars rating={rating} size={14} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link href={mine ? "/team" : `/opponent/team/${t.id}`} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-2.5 text-xs font-medium text-brand">
                      {mine ? "Manage team" : "View team stats"} <ChevronRight size={14} />
                    </Link>
                    {!mine && <button type="button" onClick={() => setTarget(t)} className="glass-btn flex-1 rounded-full py-2.5 text-xs font-semibold text-white">Challenge</button>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ---------------- Challenges ---------------- */}
      {tab === "challenges" && (
        <section aria-label="Challenges" className="space-y-6">
          <Group title="Received" empty="No challenges waiting for you." items={incoming}>
            {(c) => (
              <ChallengeCard key={c.id} c={c} name={nameOf(c.teamId)}>
                <Link href={`/opponent/team/${c.teamId}`} className="block text-xs font-medium text-brand">See their team stats →</Link>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => answerChallenge(c.id, false)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-2.5 text-sm font-medium text-slate-600"><X size={15} /> Decline</button>
                  <button type="button" onClick={() => answerChallenge(c.id, true)} className="glass-btn flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-sm font-semibold text-white"><Check size={15} /> Accept</button>
                </div>
              </ChallengeCard>
            )}
          </Group>

          <Group title="Sent" empty="You haven't challenged anyone yet. Pick a team to start." items={state.challenges.filter((c) => c.direction === "out" && (c.status === "pending" || c.status === "declined" || c.status === "cancelled"))}>
            {(c) => (
              <ChallengeCard key={c.id} c={c} name={nameOf(c.teamId)} status={c.status}>
                {c.status === "pending" && (
                  <>
                    <button type="button" onClick={() => cancelChallenge(c.id)} className="mt-3 text-xs font-medium text-rose-500">Cancel challenge</button>
                    <div className="mt-3 rounded-2xl bg-amber-400/15 p-3 text-xs text-amber-700">
                      Demo: the other captain answers on their own phone.
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => demoOpponentAnswers(c.id, true)} className="rounded-full bg-amber-500 px-3 py-1.5 font-semibold text-white">They accept</button>
                        <button type="button" onClick={() => demoOpponentAnswers(c.id, false)} className="rounded-full bg-white px-3 py-1.5 font-semibold text-amber-700">They decline</button>
                      </div>
                    </div>
                  </>
                )}
              </ChallengeCard>
            )}
          </Group>

          <Group title="Accepted games" empty="No accepted games." items={state.challenges.filter((c) => c.status === "accepted")}>
            {(c) => {
              const played = startsAt(c) <= nowMs;
              const hasResult = state.results.some((r) => r.challengeId === c.id && r.status !== "disputed");
              return (
                <ChallengeCard key={c.id} c={c} name={nameOf(c.teamId)} status="accepted">
                  <p className={`mt-3 text-xs font-medium ${c.venuePaidAt ? "text-emerald-600" : "text-slate-400"}`}>
                    {c.venuePaidAt ? "✓ Paid at the venue and confirmed by admin" : "Payment is made at the venue after the game."}
                  </p>
                  {played && !c.venuePaidAt && (
                    <div className="mt-2 rounded-2xl bg-amber-400/15 p-3 text-xs text-amber-700">
                      Demo: venue staff confirm the payment in the admin system, and both captains get a &quot;Did you win?&quot; popup.
                      <button type="button" onClick={() => demoAdminMarksPaid(c.id)} className="mt-2 block rounded-full bg-amber-500 px-3 py-1.5 font-semibold text-white">Admin: mark paid at venue</button>
                    </div>
                  )}
                  {played && !hasResult &&<button type="button" onClick={() => goReport(c.id)} className="glass-btn mt-3 w-full rounded-full py-2.5 text-sm font-semibold text-white">Report result</button>}
                  {hasResult && <p className="mt-2 text-xs text-slate-400">Result uploaded. See the Results tab.</p>}
                  {!played && <p className="mt-2 text-xs text-slate-400">You can upload the result once the game has been played.</p>}
                </ChallengeCard>
              );
            }}
          </Group>
        </section>
      )}

      {/* ---------------- Results ---------------- */}
      {tab === "results" && (
        <section aria-label="Results" className="space-y-6">
          <Group title="Needs your approval" empty="Nothing to approve." items={awaitingMyApproval}>
            {(r) => (
              <ResultCard key={r.id} r={r} team={team} state={state} nameOf={nameOf}>
                <p className="mt-3 text-xs text-slate-500">Check the score and the goals each player is credited with. Approving confirms them as your opponent&apos;s public stats.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => disputeResult(r.id)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-2.5 text-sm font-medium text-rose-500"><X size={15} /> Dispute</button>
                  <button type="button" onClick={() => approveResult(r.id)} className="glass-btn flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-sm font-semibold text-white"><Check size={15} /> Approve</button>
                </div>
              </ResultCard>
            )}
          </Group>

          <Group title="Waiting for the other captain" empty="No results waiting." items={awaitingTheirs}>
            {(r) => (
              <ResultCard key={r.id} r={r} team={team} state={state} nameOf={nameOf}>
                <p className="mt-3 text-xs text-slate-500">Your stats become visible to others once {nameOf(r.teamId)} approves.</p>
                <div className="mt-3 rounded-2xl bg-amber-400/15 p-3 text-xs text-amber-700">
                  Demo: the other captain approves on their own phone.
                  <button type="button" onClick={() => demoOpponentApproves(r.id)} className="mt-2 block rounded-full bg-amber-500 px-3 py-1.5 font-semibold text-white">They approve</button>
                </div>
              </ResultCard>
            )}
          </Group>

          <div>
            <h2 className="mb-1 text-base font-medium">Report a result</h2>
            <p className="mb-3 text-xs text-slate-400">The winning captain uploads the score and who scored. The other captain then approves it. If your game was a draw, either captain can upload.</p>
            {reportable.length === 0 ? (
              <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-slate-400">No played games waiting for a result.</p>
            ) : (
              <ul className="space-y-3">
                {reportable.map((c) => (
                  <li key={c.id} className="glass rounded-3xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">vs {nameOf(c.teamId)}</p>
                        <p className="text-xs text-slate-400">{whenText(c)}</p>
                      </div>
                      {reporting !== c.id && <button type="button" onClick={() => setReporting(c.id)} className="glass-btn rounded-full px-4 py-2 text-xs font-semibold text-white">Upload score</button>}
                    </div>
                    {reporting === c.id && <ResultForm challenge={c} team={team} opponent={nameOf(c.teamId)} onDone={() => setReporting(null)} />}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Group title="History" empty="No finished results yet." items={history}>
            {(r) => <ResultCard key={r.id} r={r} team={team} state={state} nameOf={nameOf} />}
          </Group>
        </section>
      )}

      {target && <ChallengeSheet target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

function Group<T>({ title, empty, items, children }: { title: string; empty: string; items: T[]; children: (item: T) => React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-base font-medium">{title}</h2>
      {items.length === 0 ? <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-slate-400">{empty}</p> : <ul className="space-y-3">{items.map((i, idx) => <li key={idx}>{children(i)}</li>)}</ul>}
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-400/20 text-amber-700",
  accepted: "bg-emerald-500/10 text-emerald-600",
  declined: "bg-rose-500/10 text-rose-500",
  cancelled: "bg-slate-200 text-slate-500",
};

function ChallengeCard({ c, name, status, children }: { c: Challenge; name: string; status?: string; children?: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold leading-tight">{c.direction === "in" ? `${name} challenged you` : `You challenged ${name}`}</p>
          <p className="mt-0.5 text-xs text-slate-400">{c.type === "competition" ? "Competition" : "Friendly match"} · {whenText(c)}</p>
        </div>
        {status && <span className={chip(STATUS_CHIP[status])}>{status[0].toUpperCase() + status.slice(1)}</span>}
      </div>
      <p className="mt-2 rounded-2xl bg-brand/5 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold text-brand">{shareLabel(c.loserPct)}</span> ({formatRs(splitPreview(priceFor(c.hour), c.loserPct).loser)}) ·{" "}
        {c.loserPct === 100 ? "winner pays nothing" : `winner pays ${100 - c.loserPct}% (${formatRs(splitPreview(priceFor(c.hour), c.loserPct).winner)})`}. Paid at the venue.
      </p>
      {c.message && <p className="mt-2 rounded-2xl bg-white/60 px-3 py-2 text-sm text-slate-600">“{c.message}”</p>}
      {children}
    </div>
  );
}

function ResultCard({ r, team, state, nameOf, children }: { r: Result; team: Team; state: NonNullable<ReturnType<typeof useTeams>>; nameOf: (id: string) => string; children?: React.ReactNode }) {
  const opp = nameOf(r.teamId);
  const outcome = r.myScore > r.theirScore ? "Win" : r.myScore < r.theirScore ? "Loss" : "Draw";
  const scorerTeam = r.submittedBy === "me" ? team : getOtherTeam(state, r.teamId);
  const game = state.challenges.find((c) => c.id === r.challengeId);
  const pay = game ? settlement(priceFor(game.hour), game.loserPct, r.myScore, r.theirScore) : null;
  const scorers = Object.entries(r.scorers).filter(([, v]) => v.goals > 0 || v.assists > 0);
  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">{team.name} vs {opp}</p>
          <p className="text-2xl font-semibold tabular-nums">{r.myScore} – {r.theirScore} <span className={`ml-1 align-middle text-xs font-semibold ${outcome === "Win" ? "text-emerald-600" : outcome === "Loss" ? "text-rose-500" : "text-slate-400"}`}>{outcome}</span></p>
        </div>
        {r.status !== "awaiting_approval" && <span className={chip(r.status === "approved" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-500")}>{r.status === "approved" ? "Confirmed" : "Disputed"}</span>}
        {r.status === "awaiting_approval" && <span className={chip("bg-amber-400/20 text-amber-700")}>Awaiting approval</span>}
      </div>
      {scorers.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-medium">{r.submittedBy === "me" ? team.name : opp} scorers:</span>{" "}
          {scorers.map(([id, v]) => `${scorerTeam?.members.find((m) => m.id === id)?.name ?? "Player"} ${v.goals}G${v.assists ? ` ${v.assists}A` : ""}`).join(" · ")}
        </p>
      )}
      {r.status === "disputed" && <p className="mt-2 text-xs text-slate-400">No stats were changed. An admin will review this result.</p>}
      {pay && r.status !== "disputed" && (
        <div className="mt-3 rounded-2xl bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-800">
          <p className="font-semibold">Pay at the venue after the game</p>
          <p className="mt-0.5">
            {pay.myAmount === 0 ? <b>You pay nothing</b> : <>You pay <b>{formatRs(pay.myAmount)}</b></>} · {opp} {pay.theirAmount === 0 ? "pays nothing" : <>pays <b>{formatRs(pay.theirAmount)}</b></>}
            {pay.basis === "draw-split" ? " (draw: split equally)." : pay.loserPct === 100 ? " (loser pays in full)." : ` (loser pays ${pay.loserPct}%).`}
          </p>
          {r.status === "awaiting_approval" && <p className="mt-0.5 text-emerald-700/80">Final once the result is approved. No online payment.</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function ResultForm({ challenge, team, opponent, onDone }: { challenge: Challenge; team: Team; opponent: string; onDone: () => void }) {
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const [rows, setRows] = useState<Record<string, { goals: string; assists: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const num = (v: string | undefined) => (v === undefined || v === "" ? 0 : Number(v));
  const sum = team.members.reduce((a, m) => a + num(rows[m.id]?.goals), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const scorers: Record<string, { goals: number; assists: number }> = {};
    for (const m of team.members) scorers[m.id] = { goals: num(rows[m.id]?.goals), assists: num(rows[m.id]?.assists) };
    const res = submitResult({ challengeId: challenge.id, myScore: num(mine), theirScore: num(theirs), scorers });
    if (res.ok) onDone();
    else setError(res.error);
  }

  const small = "w-full rounded-xl bg-white/80 px-2 py-2 text-center text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 border-t border-white/70 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`my-${challenge.id}`} className="text-xs text-slate-500">{team.name} goals</label>
          <input id={`my-${challenge.id}`} inputMode="numeric" value={mine} onChange={(e) => setMine(e.target.value.replace(/\D/g, "").slice(0, 2))} className={small} placeholder="0" />
        </div>
        <div>
          <label htmlFor={`th-${challenge.id}`} className="text-xs text-slate-500">{opponent} goals</label>
          <input id={`th-${challenge.id}`} inputMode="numeric" value={theirs} onChange={(e) => setTheirs(e.target.value.replace(/\D/g, "").slice(0, 2))} className={small} placeholder="0" />
        </div>
      </div>

      <div>
        <div className="mb-2 grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Your scorers</span><span className="text-center">Goals</span><span className="text-center">Assists</span>
        </div>
        <ul className="space-y-2">
          {team.members.map((m) => (
            <li key={m.id} className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2 text-sm">
              <span className="truncate">{m.name}</span>
              <input aria-label={`${m.name} goals`} inputMode="numeric" value={rows[m.id]?.goals ?? ""} placeholder="0" onChange={(e) => setRows({ ...rows, [m.id]: { goals: e.target.value.replace(/\D/g, "").slice(0, 2), assists: rows[m.id]?.assists ?? "" } })} className={small} />
              <input aria-label={`${m.name} assists`} inputMode="numeric" value={rows[m.id]?.assists ?? ""} placeholder="0" onChange={(e) => setRows({ ...rows, [m.id]: { goals: rows[m.id]?.goals ?? "", assists: e.target.value.replace(/\D/g, "").slice(0, 2) } })} className={small} />
            </li>
          ))}
        </ul>
        <p className={`mt-2 text-xs ${mine !== "" && sum !== num(mine) ? "text-rose-500" : "text-slate-400"}`}>Player goals: {sum}{mine !== "" ? ` of ${num(mine)}` : ""}. They must add up to your team&apos;s score.</p>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600">Cancel</button>
        <button type="submit" disabled={mine === "" || theirs === ""} className="glass-btn flex-1 rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50">Upload for approval</button>
      </div>
    </form>
  );
}

export default function OpponentHub({ reportId }: { reportId?: string }) {
  // key: opening a ?report=<game> link while the hub is already open must re-apply the starting tab and form
  return <CaptainGate>{(team) => <Hub key={reportId ?? "hub"} team={team} reportId={reportId} />}</CaptainGate>;
}
