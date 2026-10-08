"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, HeartHandshake, Loader2, UserRound } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { errorText } from "@/lib/api";
import { markReadByTypes } from "@/lib/notifications";
import { MAX_ADVANCE_DAYS, dateKey, fetchSlots, type Slot } from "@/lib/booking";
import { STATUS_TEXT, bookAndRefer, clock, dayLabel, loadMe, loadRules, withdrawReferral, type ReferMe, type ReferRules } from "@/lib/refer";

const input = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";

export default function ReferPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const [rules, setRules] = useState<ReferRules | null>(null);
  const [me, setMe] = useState<ReferMe | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startTime, setStartTime] = useState("");
  const [friendPhone, setFriendPhone] = useState("");
  const [friendName, setFriendName] = useState("");
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

  const pickDate = useCallback((d: string) => {
    setDate(d);
    setStartTime("");
    setSlots(null);
    setError(null);
    fetchSlots(d).then(setSlots).catch((e) => { setSlots([]); setError(errorText(e)); });
  }, []);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!date || !startTime) return setError("Choose a date and a time.");
    setBusy(true);
    try {
      await bookAndRefer({ date, startTime, friendPhone, friendName });
      setSent(true);
      setDate("");
      setSlots(null);
      setStartTime("");
      setFriendPhone("");
      setFriendName("");
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
        <h1 className="mt-6 text-2xl font-semibold">Booking confirmed</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">The slot is reserved for the other team and you pay nothing now. The venue will check it. When it is approved, the points are added to both accounts and you are both told in the app.</p>
        <button type="button" onClick={() => setSent(false)} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4 desk:mx-auto desk:max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Refer &amp; Earn</h1>
        <p className="text-sm text-slate-500">Book a game on behalf of another team and you both earn loyalty points. {offer}</p>
      </header>

      {rules && !rules.enabled && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">Refer &amp; Earn is paused right now. Please check back later.</p>}

      <form onSubmit={submit} className="glass space-y-5 rounded-3xl p-5" aria-label="Book a slot for another team">
        <div>
          <p className="text-sm font-medium">1. Pick a date</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Date">
            {Array.from({ length: MAX_ADVANCE_DAYS + 1 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return dateKey(d); }).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={date === k} onClick={() => pickDate(k)} className={`shrink-0 rounded-2xl px-3 py-2 text-center text-xs font-medium ${date === k ? "glass-active text-white" : "bg-white/70 text-slate-600"}`}>
                {dayLabel(k)}
              </button>
            ))}
          </div>
        </div>

        {date && (
          <div>
            <p className="text-sm font-medium">2. Pick a time</p>
            {slots === null ? (
              <div className="mt-2 h-12 animate-pulse rounded-2xl bg-white/50" aria-label="Loading times" />
            ) : slots.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No free times on this date. Try another day.</p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Time">
                {slots.map((sl) => (
                  <button key={sl.startTime} type="button" role="radio" aria-checked={startTime === sl.startTime} onClick={() => { setStartTime(sl.startTime); setError(null); }} className={`rounded-2xl py-2.5 text-xs font-medium ${startTime === sl.startTime ? "glass-active text-white" : "bg-white/70 text-slate-600"}`}>
                    {clock(sl.startTime)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {startTime && (
          <>
            <label className="block text-sm font-medium">3. Their name
              <input value={friendName} onChange={(e) => setFriendName(e.target.value)} maxLength={40} autoComplete="off" placeholder="Name of the other captain or team" className={input} />
            </label>
            <label className="block text-sm font-medium">Their contact number
              <input value={friendPhone} onChange={(e) => setFriendPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="98XXXXXXXX" className={input} />
              <span className="mt-1 block text-xs font-normal text-slate-400">They must have an account in this app to receive points.</span>
            </label>
            {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={busy || rules?.enabled === false} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <><Loader2 size={18} className="animate-spin" /> Booking…</> : "Confirm booking"}
            </button>
            <p className="text-center text-xs text-slate-400">The slot is booked on your account and paid at the venue. Points are added only after the venue approves. Up to {rules?.perDay ?? 5} a day.</p>
          </>
        )}
        {!startTime && error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
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
