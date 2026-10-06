"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, HeartHandshake, Loader2, UserRound } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { errorText } from "@/lib/api";
import { markReadByTypes } from "@/lib/notifications";
import { STATUS_TEXT, clock, dayLabel, loadMe, loadRules, sendReferral, withdrawReferral, type ReferMe, type ReferRules } from "@/lib/refer";

const input = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";

export default function ReferPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const [rules, setRules] = useState<ReferRules | null>(null);
  const [me, setMe] = useState<ReferMe | null>(null);
  const [bookingCode, setBookingCode] = useState("");
  const [friendPhone, setFriendPhone] = useState("");
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => { loadRules().then(setRules).catch(() => {}); }, []);
  const refresh = useCallback(() => loadMe().then((m) => { setMe(m); setRules(m.rules); }).catch(() => {}), []);
  useEffect(() => {
    if (!registered) return;
    refresh();
    markReadByTypes(["referral"]); // opening this page clears the badge
  }, [registered, refresh]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!bookingCode) return setError("Choose the booking you made for the other team.");
    setBusy(true);
    try {
      await sendReferral({ bookingCode, friendPhone, teamName });
      setSent(true);
      setBookingCode("");
      setFriendPhone("");
      setTeamName("");
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    if (!window.confirm("Withdraw this referral?")) return;
    try {
      await withdrawReferral(id);
      refresh();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const offer = rules ? `You get ${rules.referrerPoints} points and the other team's captain gets ${rules.friendPoints}.` : "You and the other team's captain both earn loyalty points.";

  if (!registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Refer &amp; Earn</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Book a game for another team and you both earn loyalty points. {offer} Sign in to start.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={38} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Referral sent</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">The venue will check it. When it is approved, the points are added to both accounts and you are both told in the app.</p>
        <button type="button" onClick={() => setSent(false)} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Done</button>
      </div>
    );
  }

  const eligible = me?.eligibleBookings ?? [];
  return (
    <div className="space-y-6 pb-4">
      <header>
        <h1 className="text-2xl font-semibold">Refer &amp; Earn</h1>
        <p className="text-sm text-slate-500">Book a game on behalf of another team and you both earn loyalty points. {offer}</p>
      </header>

      {rules && !rules.enabled && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Refer &amp; Earn is paused right now. Please check back later.</p>}

      <ol className="glass space-y-2 rounded-3xl p-5 text-sm text-slate-600">
        <li><strong>1.</strong> <Link href="/book" className="font-medium text-brand underline">Book a game</Link> on your own account for the other team.</li>
        <li><strong>2.</strong> Come back here, pick that booking and enter the other team&apos;s captain and team name.</li>
        <li><strong>3.</strong> The venue checks it. Once approved, both of you get the points.</li>
      </ol>

      <Link href="/book" className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white">Step 1: Book a slot for their team</Link>

      <form onSubmit={submit} className="glass space-y-5 rounded-3xl p-5" aria-label="New referral">
        <label className="block text-sm font-medium">The booking you made for them
          <select value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} className={input} disabled={!me}>
            <option value="">{!me ? "Loading…" : eligible.length === 0 ? "No bookings available" : "Choose a booking"}</option>
            {eligible.map((b) => <option key={b.code} value={b.code}>{dayLabel(b.date)}, {clock(b.startTime)} · {b.code}</option>)}
          </select>
          {me && eligible.length === 0 && <span className="mt-1 block text-xs font-normal text-slate-400">You have no booking to send yet. Use the Book a slot button above, then come back to this page. Only bookings from the last 30 days that were not already sent can be used.</span>}
        </label>
        <label className="block text-sm font-medium">Other team&apos;s captain, mobile number
          <input value={friendPhone} onChange={(e) => setFriendPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="98XXXXXXXX" className={input} />
          <span className="mt-1 block text-xs font-normal text-slate-400">They must have an account in this app to receive points.</span>
        </label>
        <label className="block text-sm font-medium">Other team&apos;s name
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={40} className={input} />
        </label>
        {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={busy || rules?.enabled === false} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : "Send referral"}
        </button>
        <p className="text-center text-xs text-slate-400">Up to {rules?.perDay ?? 5} referrals a day. Points are added only after the venue approves.</p>
      </form>

      <section aria-label="My referrals" className="space-y-3">
        <h2 className="text-lg font-medium">My referrals</h2>
        {me === null && <div className="h-20 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />}
        {me?.referrals.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-8 text-center text-sm text-slate-500">
            <HeartHandshake size={28} className="text-slate-400" /> No referrals yet.
          </div>
        )}
        <ul className="space-y-3">
          {me?.referrals.map((r) => {
            const st = STATUS_TEXT[r.status];
            return (
              <li key={r.id} className="glass space-y-1 rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{r.role === "referrer" ? `You booked for ${r.teamName}` : `${r.referrerName ?? "A player"} booked for your team`}</p>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>
                </div>
                <p className="text-sm text-slate-600">{dayLabel(r.gameDate)}, {clock(r.gameTime)} · {r.points} points for you</p>
                <p className="text-xs text-slate-400"><span className="font-mono">{r.code}</span>{r.status === "rejected" && r.staffNote ? ` · ${r.staffNote}` : ""}</p>
                {r.status === "pending" && r.role === "referrer" && <button type="button" onClick={() => withdraw(r.id)} className="mt-1 text-sm font-medium text-rose-600">Withdraw</button>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
