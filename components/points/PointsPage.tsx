"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Star, Trophy, ShoppingBag, Gamepad2, UserRound, ChevronDown, Crown, HeartHandshake, Check, Clock, TriangleAlert, Loader2 } from "lucide-react";
import { useSession, openSignIn } from "@/lib/session";
import { errorText } from "@/lib/api";
import { GAMES_PER_FREE, GAME_POINTS_MONTHS, MEMBERSHIP_POINTS, POINTS_CAPTAIN_WIN, RS_PER_POINT, SHIFT_HOURS, fmtPts } from "@/lib/points";
import { claimFreeGame, loyaltyStore, progressPct, type LoyaltyRow, type Period } from "@/lib/loyalty";
import { formatRs } from "@/lib/booking";
import { fmtDay } from "@/lib/promos";

const KIND: Record<LoyaltyRow["kind"], { icon: typeof Star; tone: string }> = {
  game: { icon: Gamepad2, tone: "bg-emerald-400/20 text-emerald-600" },
  captain_win: { icon: Trophy, tone: "bg-amber-400/25 text-amber-600" },
  goods: { icon: ShoppingBag, tone: "bg-sky-400/20 text-sky-600" },
  membership: { icon: Crown, tone: "bg-violet-400/20 text-violet-600" },
  free_game: { icon: Gift, tone: "bg-orange-400/20 text-orange-600" },
  referral: { icon: HeartHandshake, tone: "bg-pink-400/20 text-pink-600" },
};

const SHOWN = 4;

function Validity({ row }: { row: LoyaltyRow }) {
  if (row.status === "used") return <p className="text-[11px] text-slate-400">Used</p>;
  if (row.status === "expired") return <p className="text-[11px] font-medium text-rose-500">Expired {row.expiresOn ? fmtDay(row.expiresOn) : ""}</p>;
  if (row.status === "never") return <p className="text-[11px] text-emerald-600">Never expires</p>;
  if (row.status === "valid" && row.expiresOn) return <p className="text-[11px] text-slate-400">Valid until {fmtDay(row.expiresOn)}</p>;
  return null;
}

export default function PointsPage() {
  const session = useSession();
  const store = loyaltyStore.use();
  const [all, setAll] = useState(false);
  const [confirming, setConfirming] = useState<Period | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!session.registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Loyalty points</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to collect points on every game and turn {GAMES_PER_FREE} games into a free one.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  const loy = store.data ?? null;
  if (!loy) {
    return store.status === "error" ? (
      <p role="alert" className="glass rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{store.error}</p>
    ) : (
      <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />
    );
  }

  const rows = all ? loy.rows : loy.rows.slice(0, SHOWN);
  const pct = progressPct(loy);

  async function claim(period: Period) {
    setBusy(true);
    setError(null);
    try {
      await claimFreeGame(period);
      setConfirming(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 pb-4 desk:grid desk:grid-cols-2 desk:items-start desk:gap-6 desk:space-y-0">
      <h1 className="text-2xl font-semibold desk:col-span-2 desk:text-3xl">Loyalty points</h1>

      {/* Balance */}
      <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] to-[#2a2aa8] p-5 text-white shadow-lg desk:col-span-2" aria-label="Your points balance">
        <p className="text-xs uppercase tracking-wide text-white/60">Remaining points</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="flex items-center gap-2 text-5xl font-semibold"><Star className="fill-amber-400 text-amber-400" size={34} /> {fmtPts(loy.remaining)}</p>
          {loy.toNext === 0 && <p className="rounded-full bg-orange-400/25 px-3 py-1 text-xs font-medium text-orange-100">Free game unlocked</p>}
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to a free game">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-white/70">
          {loy.toNext === 0 ? "You have enough points to claim a free game below." : `${fmtPts(loy.toNext)} more points to unlock a free game`}
        </p>
        {loy.expiringSoon && (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-400/20 px-3 py-2.5 text-xs text-amber-100">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            {fmtPts(loy.expiringSoon.points)} points expire on {fmtDay(loy.expiringSoon.date)}. Claim a free game before then.
          </p>
        )}
      </section>

      {/* Claim a free game */}
      <section className="glass rounded-3xl p-5 desk:col-span-2" aria-label="Claim a free game">
        {loy.vouchers.length > 0 && (
          <div className="mb-4 rounded-2xl bg-emerald-400/15 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Check size={16} /> Ready: {loy.vouchers.map((v) => `${v.period} game`).join(", ")}
            </p>
            <p className="mt-1 text-xs text-slate-500">Choose a slot in that shift and tap &ldquo;Use a free game voucher&rdquo; when you book.</p>
            <Link href="/book" className="glass-btn mt-3 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white">Book my free game</Link>
          </div>
        )}
        <h2 className="text-base font-semibold">Claim a free game</h2>
        <p className="mt-1 text-xs text-slate-500">Pick any shift you have enough points for. It books one regular game and can&apos;t be used to host a challenge.</p>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>}
        <ul className="mt-4 space-y-2">
          {loy.shifts.map((s) => {
            const sure = confirming === s.period;
            return (
              <li key={s.period} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.period} <span className="text-xs font-normal text-slate-400">{SHIFT_HOURS[s.period]}</span></p>
                  <p className="text-xs text-slate-500">{formatRs(s.price)} game · costs <b>{fmtPts(s.cost)}</b> points</p>
                </div>
                {sure ? (
                  <div className="flex gap-1.5">
                    <button type="button" disabled={busy} onClick={() => claim(s.period)} className="glass-btn flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                      {busy && <Loader2 size={12} className="animate-spin" />} Use {fmtPts(s.cost)}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} aria-label="Cancel" className="rounded-full bg-white/80 px-3 py-2 text-xs text-slate-500">No</button>
                  </div>
                ) : (
                  <button type="button" disabled={!s.canClaim} onClick={() => { setError(null); setConfirming(s.period); }} className="glass-btn rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {s.canClaim ? "Claim" : `Need ${fmtPts(s.cost - loy.remaining)} more`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Claimed vs remaining */}
      <section className="grid grid-cols-2 gap-3 desk:col-span-2" aria-label="Claimed and remaining">
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-slate-500">Claimed</p>
          <p className="mt-1 text-2xl font-semibold">{fmtPts(loy.claimed)}</p>
          <p className="text-xs text-slate-400">points used for free games</p>
        </div>
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-slate-500">Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-accent">{fmtPts(loy.remaining)}</p>
          <p className="text-xs text-slate-400">of {fmtPts(loy.earned)} earned{loy.expired > 0 ? ` · ${fmtPts(loy.expired)} expired` : ""}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-semibold">How it works</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex gap-3"><Gamepad2 size={20} className="mt-0.5 shrink-0 text-emerald-600" /><span>Every game earns <b>price ÷ {RS_PER_POINT}</b> points. A Rs. 1,250 game earns 12.5.</span></li>
          <li className="flex gap-3"><Gift size={20} className="mt-0.5 shrink-0 text-orange-500" /><span><b>{GAMES_PER_FREE} games = 1 free game</b> in any shift you have the points for: {loy.shifts.map((s) => `${s.period} ${fmtPts(s.cost)}`).join(" · ")}.</span></li>
          <li className="flex gap-3"><ShoppingBag size={20} className="mt-0.5 shrink-0 text-sky-600" /><span>Extra goods: every <b>Rs. {RS_PER_POINT}</b> spent = <b>1 point</b>. Rs. 10,000 = 100 points.</span></li>
          <li className="flex gap-3"><Crown size={20} className="mt-0.5 shrink-0 text-violet-600" /><span>Membership purchase or renewal: <b>3 months = {MEMBERSHIP_POINTS.quarterly} points</b>, <b>6 months = {MEMBERSHIP_POINTS.half} points</b>.</span></li>
          <li className="flex gap-3"><Trophy size={20} className="mt-0.5 shrink-0 text-amber-600" /><span>Challenge games: only the <b>winning captain</b> earns <b>{POINTS_CAPTAIN_WIN} points</b>.</span></li>
        </ul>
      </section>

      {/* Expiry */}
      <section className="glass rounded-3xl p-5" aria-label="When points expire">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Clock size={18} className="text-brand" /> When points expire</h2>
        <ul className="mt-3 divide-y divide-white/70 text-sm">
          {[
            { label: "Game points", rule: `${GAME_POINTS_MONTHS} months from the game`, b: loy.byType.games },
            { label: "Extra goods", rule: "1 year from purchase", b: loy.byType.goods },
            { label: "Membership", rule: "Never expire", b: loy.byType.membership },
          ].map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-medium">{r.label}</p>
                <p className="text-xs text-slate-500">{r.rule}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{fmtPts(r.b.points)}</p>
                <p className="text-[11px] text-slate-400">{r.b.nextExpiry ? `next ${fmtDay(r.b.nextExpiry)}` : r.b.points > 0 ? "no expiry" : "—"}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-2xl bg-white/60 px-3 py-2 text-xs text-slate-500">
          Play {GAMES_PER_FREE} games within {GAME_POINTS_MONTHS} months to claim a free game. Game points not used in time vanish automatically, and the points that expire soonest are spent first.
        </p>
      </section>

      {/* History */}
      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-semibold">Points history</h2>
        {loy.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No points yet. Play a game to start earning.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map((e) => {
              const k = KIND[e.kind] ?? KIND.game;
              const Icon = k.icon;
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${k.tone}`}><Icon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.detail}</p>
                    <p className="truncate text-xs text-slate-400">{fmtDay(e.earnedOn)}</p>
                    {e.points > 0 && <Validity row={e} />}
                  </div>
                  <p className={`text-sm font-semibold ${e.points > 0 ? "text-emerald-600" : "text-orange-600"}`}>{e.points > 0 ? "+" : "−"}{fmtPts(Math.abs(e.points))}</p>
                </li>
              );
            })}
          </ul>
        )}
        {loy.rows.length > SHOWN && (
          <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="mt-4 flex w-full items-center justify-center gap-1 rounded-2xl bg-white/60 py-2.5 text-sm font-medium text-brand">
            {all ? "Show less" : `Show all (${loy.rows.length})`} <ChevronDown size={16} className={all ? "rotate-180" : ""} />
          </button>
        )}
      </section>

      <section className="rounded-3xl bg-white/40 p-5 text-xs text-slate-500" aria-label="Terms">
        <h2 className="text-sm font-semibold text-slate-700">Terms</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li>Points are earned only by the registered account holder (the main person). Guests don&apos;t earn points.</li>
          <li>Game points last {GAME_POINTS_MONTHS} months. Play {GAMES_PER_FREE} games within {GAME_POINTS_MONTHS} months to claim a free game, or the game points are cancelled.</li>
          <li>Extra goods points last 1 year. Membership points never expire.</li>
          <li>A free game is for one regular booking in the shift you chose. It can&apos;t be used to host a challenge and has no cash value.</li>
          <li>The final points are confirmed by Unique Futsal after the game or payment.</li>
        </ul>
      </section>

      <p className="px-2 text-center text-xs text-slate-400 desk:col-span-2">
        Ready to use a free game? <Link href="/book" className="font-medium text-brand">Book now</Link>
      </p>
    </div>
  );
}
