"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronRight, Loader2, Swords, Trophy, Users, X } from "lucide-react";
import CaptainGate from "@/components/captain/CaptainGate";
import ChallengeSheet from "@/components/captain/ChallengeSheet";
import Stars from "@/components/captain/Stars";
import { formatHour, formatRs, parseKey } from "@/lib/booking";
import {
  answerChallenge,
  approveResult,
  cancelChallenge,
  disputeResult,
  pendingActions,
  rankingStore,
  shareLabel,
  splitPreview,
  submitResult,
  useTeams,
  type ActionResult,
  type Challenge,
  type MyTeam,
  type TeamsState,
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

// Runs an action, shows its error (if any) and disables the buttons while it runs.
function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<ActionResult>) {
    setBusy(key);
    setError(null);
    const r = await fn();
    if (!r.ok) setError(r.error);
    setBusy(null);
  }
  return { busy, error, run };
}

function Hub({ team, reportId }: { team: MyTeam; reportId?: string }) {
  const state = useTeams();
  const rankingState = rankingStore.use();
  const nowMs = useSyncExternalStore(noop, minute, () => 0);
  const act = useAction();
  // Opening /opponent?report=<game> (from the "Did you win?" popup) lands on that game's score form.
  const [tab, setTab] = useState<Tab>(reportId ? "results" : "teams");
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [reporting, setReporting] = useState<string | null>(reportId ?? null);

  if (!state || !nowMs) return null;

  const ranked = rankingState.data ?? [];
  const challenges = state.challenges;
  const incoming = challenges.filter((c) => c.direction === "in" && c.status === "pending");
  const withResult = challenges.filter((c) => c.result);
  const awaitingMyApproval = withResult.filter((c) => c.result!.submittedBy === "them" && c.result!.status === "awaiting_approval");
  const awaitingTheirs = withResult.filter((c) => c.result!.submittedBy === "me" && c.result!.status === "awaiting_approval");
  const history = withResult.filter((c) => c.result!.status !== "awaiting_approval");
  const reportable = challenges.filter((c) => c.status === "accepted" && startsAt(c) <= nowMs && (!c.result || c.result.status === "disputed"));
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

      {act.error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{act.error}</p>}

      {/* ---------------- Teams ---------------- */}
      {tab === "teams" && (
        <section aria-label="Team rankings">
          <p className="mb-3 text-xs text-slate-400">Ranked by 5-star rating from confirmed results: win rate, goal difference and recent form.</p>
          {rankingState.status === "error" ? (
            <p role="alert" className="glass rounded-2xl px-4 py-5 text-center text-sm text-rose-600">{rankingState.error}</p>
          ) : !rankingState.data ? (
            <div className="space-y-3" aria-label="Loading teams">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/40" />)}</div>
          ) : (
            <ol className="space-y-3">
              {ranked.map((t) => {
                const mine = t.id === team.id;
                return (
                  <li key={t.id} className={`glass rounded-3xl p-4 ${mine ? "ring-2 ring-brand/50" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{t.rank ?? "–"}</span>
                        <div>
                          <p className="font-semibold leading-tight">{t.name}{mine && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-[#0c0b5d]">YOU</span>}</p>
                          <p className="text-xs text-slate-400">{t.area} · {t.players} players · {t.record.wins}W {t.record.draws}D {t.record.losses}L</p>
                        </div>
                      </div>
                      <Stars rating={t.rating} size={14} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link href={mine ? "/team" : `/opponent/team/${t.id}`} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-2.5 text-xs font-medium text-brand">
                        {mine ? "Manage team" : "View team stats"} <ChevronRight size={14} />
                      </Link>
                      {!mine && <button type="button" onClick={() => setTarget({ id: t.id, name: t.name })} className="glass-btn flex-1 rounded-full py-2.5 text-xs font-semibold text-white">Challenge</button>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {/* ---------------- Challenges ---------------- */}
      {tab === "challenges" && (
        <section aria-label="Challenges" className="space-y-6">
          <Group title="Received" empty="No challenges waiting for you." items={incoming}>
            {(c) => (
              <ChallengeCard key={c.id} c={c}>
                <Link href={`/opponent/team/${c.team.id}`} className="block text-xs font-medium text-brand">See their team stats →</Link>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={act.busy !== null} onClick={() => act.run(`d-${c.id}`, () => answerChallenge(c.id, false))} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-2.5 text-sm font-medium text-slate-600 disabled:opacity-60"><X size={15} /> Decline</button>
                  <button type="button" disabled={act.busy !== null} onClick={() => act.run(`a-${c.id}`, () => answerChallenge(c.id, true))} className="glass-btn flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60">{act.busy === `a-${c.id}` ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Accept</button>
                </div>
              </ChallengeCard>
            )}
          </Group>

          <Group title="Sent" empty="You haven't challenged anyone yet. Pick a team to start." items={challenges.filter((c) => c.direction === "out" && (c.status === "pending" || c.status === "declined" || c.status === "cancelled" || c.status === "expired"))}>
            {(c) => (
              <ChallengeCard key={c.id} c={c} status={c.status}>
                {c.status === "pending" && (
                  <button type="button" disabled={act.busy !== null} onClick={() => act.run(`c-${c.id}`, () => cancelChallenge(c.id))} className="mt-3 text-xs font-medium text-rose-500">Cancel challenge</button>
                )}
              </ChallengeCard>
            )}
          </Group>

          <Group title="Accepted games" empty="No accepted games." items={challenges.filter((c) => c.status === "accepted")}>
            {(c) => {
              const played = startsAt(c) <= nowMs;
              const hasResult = Boolean(c.result && c.result.status !== "disputed");
              return (
                <ChallengeCard key={c.id} c={c} status="accepted">
                  <p className={`mt-3 text-xs font-medium ${c.venuePaidAt ? "text-emerald-600" : "text-slate-400"}`}>
                    {c.venuePaidAt ? "✓ Paid at the venue and confirmed by the venue" : "Payment is made at the venue after the game."}
                  </p>
                  {played && !hasResult && <button type="button" onClick={() => goReport(c.id)} className="glass-btn mt-3 w-full rounded-full py-2.5 text-sm font-semibold text-white">Report result</button>}
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
            {(c) => (
              <ResultCard key={c.id} c={c} team={team}>
                <p className="mt-3 text-xs text-slate-500">Check the final score. Approving confirms the result and updates both teams&apos; records and ratings.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={act.busy !== null} onClick={() => act.run(`x-${c.id}`, () => disputeResult(c.result!.id))} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-2.5 text-sm font-medium text-rose-500 disabled:opacity-60"><X size={15} /> Dispute</button>
                  <button type="button" disabled={act.busy !== null} onClick={() => act.run(`p-${c.id}`, () => approveResult(c.result!.id))} className="glass-btn flex flex-1 items-center justify-center gap-1 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60">{act.busy === `p-${c.id}` ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve</button>
                </div>
              </ResultCard>
            )}
          </Group>

          <Group title="Waiting for the other captain" empty="No results waiting." items={awaitingTheirs}>
            {(c) => (
              <ResultCard key={c.id} c={c} team={team}>
                <p className="mt-3 text-xs text-slate-500">Your team&apos;s record and rating update, and become visible to others, once {c.team.name} approves.</p>
              </ResultCard>
            )}
          </Group>

          <div>
            <h2 className="mb-1 text-base font-medium">Report a result</h2>
            <p className="mb-3 text-xs text-slate-400">The winning captain uploads the final score. The other captain then approves it. If your game was a draw, either captain can upload.</p>
            {reportable.length === 0 ? (
              <p className="glass rounded-2xl px-4 py-5 text-center text-sm text-slate-400">No played games waiting for a result.</p>
            ) : (
              <ul className="space-y-3">
                {reportable.map((c) => (
                  <li key={c.id} className="glass rounded-3xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">vs {c.team.name}</p>
                        <p className="text-xs text-slate-400">{whenText(c)}</p>
                      </div>
                      {reporting !== c.id && <button type="button" onClick={() => setReporting(c.id)} className="glass-btn rounded-full px-4 py-2 text-xs font-semibold text-white">Upload score</button>}
                    </div>
                    {reporting === c.id && <ResultForm challenge={c} team={team} opponent={c.team.name} onDone={() => setReporting(null)} />}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Group title="History" empty="No finished results yet." items={history}>
            {(c) => <ResultCard key={c.id} c={c} team={team} />}
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
  expired: "bg-slate-200 text-slate-500",
};

function ChallengeCard({ c, status, children }: { c: Challenge; status?: string; children?: React.ReactNode }) {
  const p = splitPreview(c.courtPrice, c.loserPct);
  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold leading-tight">{c.direction === "in" ? `${c.team.name} challenged you` : `You challenged ${c.team.name}`}</p>
          <p className="mt-0.5 text-xs text-slate-400">{c.type === "competition" ? "Competition" : "Friendly match"} · {whenText(c)}</p>
        </div>
        {status && <span className={chip(STATUS_CHIP[status] ?? STATUS_CHIP.cancelled)}>{status[0].toUpperCase() + status.slice(1)}</span>}
      </div>
      <p className="mt-2 rounded-2xl bg-brand/5 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold text-brand">{shareLabel(c.loserPct)}</span> ({formatRs(p.loser)}) ·{" "}
        {c.loserPct === 100 ? "winner pays nothing" : `winner pays ${100 - c.loserPct}% (${formatRs(p.winner)})`}. Paid at the venue.
      </p>
      {c.message && <p className="mt-2 rounded-2xl bg-white/60 px-3 py-2 text-sm text-slate-600">“{c.message}”</p>}
      {children}
    </div>
  );
}

function ResultCard({ c, team, children }: { c: Challenge; team: MyTeam; children?: React.ReactNode }) {
  const r = c.result!;
  const opp = c.team.name;
  const outcome = r.myScore > r.theirScore ? "Win" : r.myScore < r.theirScore ? "Loss" : "Draw";
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
      <p className="mt-1 text-xs text-slate-400">Uploaded by {r.submittedBy === "me" ? "you" : `${opp}'s captain`}</p>
      {r.status === "disputed" && <p className="mt-2 text-xs text-slate-400">Nothing was changed. The venue will review this result.</p>}
      {r.status !== "disputed" && (
        <div className="mt-3 rounded-2xl bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-800">
          <p className="font-semibold">Pay at the venue after the game</p>
          <p className="mt-0.5">
            {r.myAmount === 0 ? <b>You pay nothing</b> : <>You pay <b>{formatRs(r.myAmount)}</b></>} · {opp} {r.theirAmount === 0 ? "pays nothing" : <>pays <b>{formatRs(r.theirAmount)}</b></>}
            {r.basis === "draw-split" ? " (draw: split equally)." : c.loserPct === 100 ? " (loser pays in full)." : ` (loser pays ${c.loserPct}%).`}
          </p>
          {r.status === "awaiting_approval" && <p className="mt-0.5 text-emerald-700/80">Final once the result is approved. No online payment.</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function ResultForm({ challenge, team, opponent, onDone }: { challenge: Challenge; team: MyTeam; opponent: string; onDone: () => void }) {
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const num = (v: string | undefined) => (v === undefined || v === "" ? 0 : Number(v));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await submitResult({ challengeId: challenge.id, myScore: num(mine), theirScore: num(theirs) });
    setBusy(false);
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

      <p className="text-xs text-slate-400">Enter the final score only. The other captain then approves it.</p>

      {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600">Cancel</button>
        <button type="submit" disabled={mine === "" || theirs === "" || busy} className="glass-btn flex-1 rounded-full py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Uploading…" : "Upload for approval"}</button>
      </div>
    </form>
  );
}

export type { TeamsState };

export default function OpponentHub({ reportId }: { reportId?: string }) {
  // key: opening a ?report=<game> link while the hub is already open must re-apply the starting tab and form
  return <CaptainGate>{(team) => <Hub key={reportId ?? "hub"} team={team} reportId={reportId} />}</CaptainGate>;
}
