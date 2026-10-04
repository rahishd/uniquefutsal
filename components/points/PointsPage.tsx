"use client";

import { useState } from "react";
import Link from "next/link";
import { Gift, Star, Trophy, ShoppingBag, Gamepad2, UserRound, ChevronDown, Crown, Check } from "lucide-react";
import { useSession, signInDemo } from "@/lib/session";
import {
  GOODS_STEP_RS, MEMBERSHIP_3M_POINTS, POINTS_CAPTAIN_WIN, POINTS_PER_FREE_GAME, POINTS_PER_GAME, POINTS_PER_GOODS_STEP,
  claimFreeGame, usePoints, type PointsKind,
} from "@/lib/points";

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
  const [confirming, setConfirming] = useState(false);

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!session.registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Loyalty points</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to collect points on every game and turn {POINTS_PER_FREE_GAME} points into a free game.</p>
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
          <p className="rounded-full bg-orange-400/25 px-3 py-1 text-xs font-medium text-orange-100">
            {sum.canClaim} free {sum.canClaim === 1 ? "game" : "games"} to claim
          </p>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={sum.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to your next free game">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${sum.progressPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-white/70">{sum.toNext} more points for your next free game</p>
      </section>

      {/* Claim a free game */}
      <section className="glass rounded-3xl p-5" aria-label="Claim a free game">
        {vouchers > 0 && (
          <div className="mb-4 rounded-2xl bg-emerald-400/15 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><Check size={16} /> {vouchers} free game {vouchers === 1 ? "voucher" : "vouchers"} ready</p>
            <p className="mt-1 text-xs text-slate-500">Choose it at the payment step when you book.</p>
            <Link href="/book" className="glass-btn mt-3 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white">Book my free game</Link>
          </div>
        )}
        <h2 className="text-base font-semibold">Claim a free game</h2>
        <p className="mt-1 text-xs text-slate-500">Spend {POINTS_PER_FREE_GAME} points to book one regular game for free. It can&apos;t be used to host a challenge.</p>
        {confirming ? (
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { claimFreeGame(); setConfirming(false); }} className="glass-btn flex-1 rounded-full py-3 text-sm font-semibold text-white">Yes, use {POINTS_PER_FREE_GAME} points</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-full bg-white/70 px-5 py-3 text-sm font-medium text-slate-600">Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            disabled={sum.canClaim < 1}
            onClick={() => setConfirming(true)}
            className="glass-btn mt-4 w-full rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sum.canClaim < 1 ? `Need ${sum.toNext} more points` : "Claim free game"}
          </button>
        )}
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
          <li className="flex gap-3"><Gift size={20} className="mt-0.5 shrink-0 text-orange-500" /><span><b>{POINTS_PER_FREE_GAME} points = 1 free game.</b></span></li>
          <li className="flex gap-3"><Gamepad2 size={20} className="mt-0.5 shrink-0 text-emerald-600" /><span>Every game you play earns <b>{POINTS_PER_GAME} points</b>.</span></li>
          <li className="flex gap-3"><Trophy size={20} className="mt-0.5 shrink-0 text-amber-600" /><span>Challenge games: only the <b>winning captain</b> earns <b>{POINTS_CAPTAIN_WIN} points</b>.</span></li>
          <li className="flex gap-3"><Crown size={20} className="mt-0.5 shrink-0 text-violet-600" /><span>Buy or renew the <b>3-month membership</b> and earn <b>{MEMBERSHIP_3M_POINTS} points</b>.</span></li>
          <li className="flex gap-3"><ShoppingBag size={20} className="mt-0.5 shrink-0 text-sky-600" /><span>Extra goods: every <b>Rs. {GOODS_STEP_RS}</b> earns <b>{POINTS_PER_GOODS_STEP} points</b>.</span></li>
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
