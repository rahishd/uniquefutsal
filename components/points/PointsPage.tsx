"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Star, Trophy, ShoppingBag, Gamepad2, UserRound, ChevronDown, Crown, Check } from "lucide-react";
import { useSession, signInDemo } from "@/lib/session";
import {
  GAMES_PER_FREE, MEMBERSHIP_3M_POINTS, POINTS_CAPTAIN_WIN, RS_PER_POINT, SHIFTS,
  claimFreeGame, shiftInfo, usePoints, type PointsKind,
} from "@/lib/points";
import { formatRs, type Period } from "@/lib/booking";

const KIND: Record<PointsKind, { icon: typeof Star; tone: string }> = {
  game: { icon: Gamepad2, tone: "bg-emerald-400/20 text-emerald-600" },
  "captain-win": { icon: Trophy, tone: "bg-amber-400/25 text-amber-600" },
  goods: { icon: ShoppingBag, tone: "bg-sky-400/20 text-sky-600" },
  membership: { icon: Crown, tone: "bg-violet-400/20 text-violet-600" },
  "free-game": { icon: Gift, tone: "bg-orange-400/20 text-orange-600" },
};

const SHOWN = 4;

export default function PointsPage() {
  const session = useSession();
  const [all, setAll] = useState(false);
  const { ledger, vouchers, summary: sum } = usePoints();
  const [confirming, setConfirming] = useState<Period | null>(null);

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!session.registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Loyalty points</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to collect points on every game and turn {GAMES_PER_FREE} games into a free one.</p>
        <button type="button" onClick={signInDemo} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in (demo)</button>
      </div>
    );
  }

  const rows = all ? ledger : ledger.slice(0, SHOWN);

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-2xl font-semibold">Loyalty points</h1>

      {/* Balance */}
      <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] to-[#2a2aa8] p-5 text-white shadow-lg" aria-label="Your points balance">
        <p className="text-xs uppercase tracking-wide text-white/60">Remaining points</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="flex items-center gap-2 text-5xl font-semibold"><Star className="fill-amber-400 text-amber-400" size={34} /> {sum.remaining}</p>
          {sum.toNext === 0 && <p className="rounded-full bg-orange-400/25 px-3 py-1 text-xs font-medium text-orange-100">Free game unlocked</p>}
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={sum.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to a free game">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${sum.progressPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-white/70">
          {sum.toNext === 0 ? "You have enough points to claim a free game below." : `${sum.toNext} more points to unlock a free game`}
        </p>
      </section>

      {/* Claim a free game */}
      <section className="glass rounded-3xl p-5" aria-label="Claim a free game">
        {vouchers.length > 0 && (
          <div className="mb-4 rounded-2xl bg-emerald-400/15 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <Check size={16} /> Ready: {vouchers.map((v) => `${v.period} game`).join(", ")}
            </p>
            <p className="mt-1 text-xs text-slate-500">Choose a slot in that shift and tap &ldquo;Use a free game voucher&rdquo; when you book.</p>
            <Link href="/book" className="glass-btn mt-3 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white">Book my free game</Link>
          </div>
        )}
        <h2 className="text-base font-semibold">Claim a free game</h2>
        <p className="mt-1 text-xs text-slate-500">Pick any shift you have enough points for. It books one regular game and can&apos;t be used to host a challenge.</p>
        <ul className="mt-4 space-y-2">
          {SHIFTS.map((s) => {
            const info = shiftInfo(s.period);
            const enough = sum.remaining >= info.cost;
            const sure = confirming === s.period;
            return (
              <li key={s.period} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{info.label} <span className="text-xs font-normal text-slate-400">{info.hours}</span></p>
                  <p className="text-xs text-slate-500">{formatRs(info.price)} game · costs <b>{info.cost}</b> points</p>
                </div>
                {sure ? (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => { claimFreeGame(s.period); setConfirming(null); }} className="glass-btn rounded-full px-4 py-2 text-xs font-semibold text-white">Use {info.cost}</button>
                    <button type="button" onClick={() => setConfirming(null)} aria-label="Cancel" className="rounded-full bg-white/80 px-3 py-2 text-xs text-slate-500">No</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!enough}
                    onClick={() => setConfirming(s.period)}
                    className="glass-btn rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {enough ? "Claim" : `Need ${info.cost - sum.remaining} more`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Claimed vs remaining */}
      <section className="grid grid-cols-2 gap-3" aria-label="Claimed and remaining">
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-slate-500">Claimed</p>
          <p className="mt-1 text-2xl font-semibold">{sum.claimed}</p>
          <p className="text-xs text-slate-400">{sum.freeGamesClaimed} free {sum.freeGamesClaimed === 1 ? "game" : "games"} used</p>
        </div>
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-slate-500">Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-accent">{sum.remaining}</p>
          <p className="text-xs text-slate-400">of {sum.earned} earned</p>
        </div>
      </section>

      {/* How it works */}
      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-semibold">How it works</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex gap-3"><Gamepad2 size={20} className="mt-0.5 shrink-0 text-emerald-600" /><span>Every <b>Rs. {RS_PER_POINT}</b> you pay for a game = <b>1 point</b>. A Rs. 1,250 game earns 12 (1.2 &times; 10).</span></li>
          <li className="flex gap-3"><Gift size={20} className="mt-0.5 shrink-0 text-orange-500" /><span><b>{GAMES_PER_FREE} games = 1 free game</b> in any shift you have enough points for.</span></li>
          <li className="flex gap-3"><Trophy size={20} className="mt-0.5 shrink-0 text-amber-600" /><span>Challenge games: only the <b>winning captain</b> earns <b>{POINTS_CAPTAIN_WIN} points</b>.</span></li>
          <li className="flex gap-3"><Crown size={20} className="mt-0.5 shrink-0 text-violet-600" /><span>Buy or renew the <b>3-month membership</b> and earn <b>{MEMBERSHIP_3M_POINTS} points</b>.</span></li>
          <li className="flex gap-3"><ShoppingBag size={20} className="mt-0.5 shrink-0 text-sky-600" /><span>Extra goods: same rate, every <b>Rs. {RS_PER_POINT}</b> = <b>1 point</b>.</span></li>
        </ul>
      </section>

      {/* History */}
      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-semibold">Points history</h2>
        <ul className="mt-3 space-y-3">
          {rows.map((e) => {
            const k = KIND[e.kind];
            const Icon = k.icon;
            return (
              <li key={e.id} className="flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${k.tone}`}><Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="truncate text-xs text-slate-400">{e.detail} · {e.date}</p>
                </div>
                <p className={`text-sm font-semibold ${e.points > 0 ? "text-emerald-600" : "text-orange-600"}`}>{e.points > 0 ? "+" : "−"}{Math.abs(e.points)}</p>
              </li>
            );
          })}
        </ul>
        {ledger.length > SHOWN && (
          <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="mt-4 flex w-full items-center justify-center gap-1 rounded-2xl bg-white/60 py-2.5 text-sm font-medium text-brand">
            {all ? "Show less" : `Show all (${ledger.length})`} <ChevronDown size={16} className={all ? "rotate-180" : ""} />
          </button>
        )}
      </section>

      <p className="px-2 text-center text-xs text-slate-400">
        Ready to use a free game? <Link href="/book" className="font-medium text-brand">Book now</Link>
      </p>
    </div>
  );
}
