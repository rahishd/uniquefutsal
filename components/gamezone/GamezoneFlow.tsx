"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Gamepad2, Loader2, Minus, Plus } from "lucide-react";
import { MAX_ADVANCE_DAYS, dateKey, formatHour, formatRs, parseKey } from "@/lib/booking";
import { addNotice, scheduleReminder } from "@/lib/notifications";
import { METHOD_LABEL, isOnline, remarksFor, type PayMethod } from "@/lib/payment";
import { signInDemo, useSession } from "@/lib/session";
import { CONSOLES, GAMES, MAX_HOURS, PLANS, createGzBooking, getGzSlots, planOf, priceFor, type GzConfirmation } from "@/lib/gamezone";
import PaymentMethodPicker from "@/components/payment/PaymentMethodPicker";
import PaymentQr from "@/components/payment/PaymentQr";

const noop = () => () => {};
const nowKey = () => String(Math.floor(Date.now() / 60000));

const longDate = (key: string) => parseKey(key).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const field = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

function Steps({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {["Choose time", "Review & pay", "Done"].map((l, i) => (
        <li key={l} className="flex flex-1 flex-col gap-1.5">
          <span className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-slate-200"}`} />
          <span className={i <= step ? "font-medium text-brand" : "text-slate-400"}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

function notify(c: GzConfirmation) {
  const r = c.request;
  const when = `${longDate(r.dateKey)} · ${formatHour(r.hour)} – ${formatHour(r.hour + r.hours)}`;
  addNotice({ id: `booking-${c.id}`, type: "gamezone", title: "Gamezone booked", body: `PS5 · ${r.game} · ${planOf(r.players).label} · ${when}. ID ${c.id}.`, href: "/gamezone" });
  addNotice({
    id: `payment-${c.id}`,
    type: "payment",
    title: c.paymentStatus === "paid" ? "Payment received" : c.paymentStatus === "pay_at_venue" ? "Pay at the venue" : "Payment pending",
    body:
      c.paymentStatus === "paid"
        ? `${formatRs(c.total)} received for ${c.id}.`
        : c.paymentStatus === "pay_at_venue"
          ? `Please pay ${formatRs(c.total)} when you arrive.`
          : `${formatRs(c.total)} is awaiting payment confirmation for ${c.id}.`,
    href: "/gamezone",
  });
  const start = parseKey(r.dateKey);
  start.setHours(r.hour, 0, 0, 0);
  scheduleReminder(c.id, start.getTime(), "PS5 Gamezone");
}

export default function GamezoneFlow() {
  const tick = useSyncExternalStore(noop, nowKey, () => "");
  const now = useMemo(() => (tick ? new Date() : null), [tick]);
  const session = useSession();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [players, setPlayers] = useState<number>(1);
  const [hours, setHours] = useState(1);
  const [selHour, setSelHour] = useState<number | null>(null);
  const [selConsole, setSelConsole] = useState<string | null>(null);
  const [selGame, setSelGame] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PayMethod>("esewa");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<GzConfirmation | null>(null);
  const [qr, setQr] = useState<GzConfirmation | null>(null);

  if (!now || !session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const today = dateKey(now);
  const days = Array.from({ length: MAX_ADVANCE_DAYS + 1 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { key: dateKey(d), d };
  });
  const activeDate = selDate && days.some((d) => d.key === selDate) ? selDate : today;
  const consoleId = selConsole ?? CONSOLES[0].id;
  const slots = getGzSlots(activeDate, now, hours, consoleId);
  const slot = slots.includes(selHour ?? -1) ? { hour: selHour as number } : undefined;
  const plan = planOf(players);
  const total = priceFor(players, hours);
  const registered = session.registered;
  const effMethod: PayMethod = !registered && method === "venue" ? "esewa" : method;
  const phoneOk = /^9\d{9}$/.test(phone);
  const canPay = Boolean(slot && selGame && (registered || (name.trim().length >= 2 && phoneOk)));

  async function confirm() {
    if (!slot || !selGame || !canPay) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createGzBooking({
        dateKey: activeDate, hour: slot.hour, hours, players, game: selGame, consoleId, method: effMethod,
        name: session && session.registered ? session.name : name.trim(),
        phone: session && session.registered ? session.phone : phone,
        guest: !registered,
      });
      if (isOnline(res.request.method)) {
        setQr(res);
      } else {
        notify(res);
        setDone(res);
        setStep(2);
      }
    } catch {
      setError("Sorry, we couldn't complete your booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- pay with QR ---------- */
  if (qr && !done && isOnline(qr.request.method)) {
    return (
      <div className="space-y-5">
        <Steps step={1} />
        <PaymentQr
          method={qr.request.method}
          orderId={qr.id}
          amount={qr.total}
          remarks={remarksFor("gamezone", qr.id)}
          heldAt={qr.createdAt}
          onBack={() => setQr(null)}
          onPaid={() => {
            const paid = { ...qr, paymentStatus: "paid" as const };
            notify(paid);
            setDone(paid);
            setQr(null);
            setStep(2);
          }}
        />
      </div>
    );
  }

  /* ---------- done ---------- */
  if (step === 2 && done) {
    const r = done.request;
    const venue = done.paymentStatus === "pay_at_venue";
    const paid = done.paymentStatus === "paid";
    return (
      <div className="space-y-5">
        <Steps step={2} />
        <div className="glass rounded-3xl p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><Check size={34} /></span>
          <h1 className="mt-4 text-2xl font-semibold">{paid ? "Gamezone booked!" : "Gamezone reserved!"}</h1>
          <p className="mt-1 text-sm text-slate-500">{paid ? "Payment received. See you at the console!" : "Please pay at the venue when you arrive."}</p>
          <p className="mt-4 text-xs text-slate-400">Booking ID</p>
          <p className="font-mono text-lg font-semibold tracking-wide">{done.id}</p>
        </div>
        <dl className="glass space-y-3 rounded-3xl p-5 text-sm">
          {[
            ["Date", longDate(r.dateKey)],
            ["Time", `${formatHour(r.hour)} – ${formatHour(r.hour + r.hours)} (${r.hours} hr)`],
            ["Console", CONSOLES.find((c) => c.id === r.consoleId)?.name ?? ""],
            ["Game", r.game],
            ["Players", planOf(r.players).label],
            ["Payment", paid ? `Paid via ${METHOD_LABEL[r.method]}` : venue ? "Pay at venue" : "Awaiting payment"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-slate-400">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
          <div className="flex justify-between border-t border-white/60 pt-3 text-base"><dt className="font-medium">Total</dt><dd className="font-semibold">{formatRs(done.total)}</dd></div>
        </dl>
        <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-700">Demo mode: this booking was not saved and no payment was taken. Real bookings need the backend API.</p>
        <Link href="/" className="glass-btn block rounded-full py-3.5 text-center text-sm font-medium text-white">Back to home</Link>
      </div>
    );
  }

  /* ---------- review & pay ---------- */
  if (step === 1 && slot && selGame) {
    return (
      <div className="space-y-5">
        <Steps step={1} />
        <button type="button" onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Change session</button>

        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-medium">Session summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Date</dt><dd className="font-medium">{longDate(activeDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Time</dt><dd className="font-medium">{formatHour(slot.hour)} – {formatHour(slot.hour + hours)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Console</dt><dd className="font-medium">{CONSOLES.find((c) => c.id === consoleId)?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Game</dt><dd className="font-medium">{selGame}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Players</dt><dd className="font-medium">{plan.label}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Rate</dt><dd>{formatRs(plan.each)} × {players} {players === 1 ? "player" : "players"} × {hours} hr</dd></div>
            <div className="flex justify-between border-t border-white/60 pt-3 text-base"><dt className="font-medium">Total</dt><dd className="font-semibold">{formatRs(total)}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">Final price is confirmed by the server.</p>
        </section>

        {session.registered ? (
          <p className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="text-slate-500">Booking as</span>
            <span className="text-right font-medium">{session.name} · {session.phone}</span>
          </p>
        ) : (
          <section className="glass space-y-3 rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Guest details</h2>
              <button type="button" onClick={signInDemo} className="text-xs font-medium text-brand">Have an account? Sign in</button>
            </div>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" autoComplete="name" />
            <div>
              <input className={field} value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Mobile number (98XXXXXXXX)" aria-label="Mobile number" autoComplete="tel" />
              {phone.length > 0 && !phoneOk && <p className="mt-1 text-xs text-rose-500">Enter a 10-digit mobile number starting with 9.</p>}
            </div>
          </section>
        )}

        <PaymentMethodPicker value={effMethod} onChange={setMethod} allowVenue={registered} />
        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="button" onClick={confirm} disabled={!canPay || submitting} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-semibold text-white disabled:opacity-50">
          {submitting ? <><Loader2 size={18} className="animate-spin" /> Processing…</> : effMethod === "venue" ? `Reserve · ${formatRs(total)}` : `Continue to ${METHOD_LABEL[effMethod]} QR · ${formatRs(total)}`}
        </button>
      </div>
    );
  }

  /* ---------- choose ---------- */
  return (
    <div className="space-y-6">
      <Steps step={0} />
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Gamepad2 size={26} className="text-brand" /> Gamezone</h1>
        <p className="text-sm text-slate-500">Book a PS5 console by the hour. Bookings open up to {MAX_ADVANCE_DAYS} days ahead.</p>
      </header>

      <section aria-label="Players">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Who&apos;s playing?</h2>
        <div role="radiogroup" aria-label="Number of players" className="grid grid-cols-3 gap-3">
          {PLANS.map((p) => {
            const on = players === p.players;
            return (
              <button key={p.players} type="button" role="radio" aria-checked={on} onClick={() => { setPlayers(p.players); setSelHour(null); }} className={`rounded-2xl px-2 py-3 text-center transition ${on ? "glass-active text-white" : "glass"}`}>
                <span className="block text-sm font-medium">{p.label}</span>
                <span className={`block text-lg font-semibold`}>{formatRs(p.each)}</span>
                <span className={`text-[11px] ${on ? "text-white/70" : "text-slate-400"}`}>{p.players === 1 ? "per hour" : "each / hour"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Hours" className="glass flex items-center justify-between rounded-3xl px-5 py-4">
        <div>
          <p className="text-sm font-medium">How long?</p>
          <p className="text-xs text-slate-500">Up to {MAX_HOURS} hours in one go</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Fewer hours" disabled={hours <= 1} onClick={() => { setHours(hours - 1); setSelHour(null); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-brand disabled:opacity-40"><Minus size={18} /></button>
          <span className="w-14 text-center text-lg font-semibold" aria-live="polite">{hours} hr</span>
          <button type="button" aria-label="More hours" disabled={hours >= MAX_HOURS} onClick={() => { setHours(hours + 1); setSelHour(null); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-brand disabled:opacity-40"><Plus size={18} /></button>
        </div>
      </section>

      <section aria-label="Console">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Console</h2>
        <div role="radiogroup" aria-label="Console" className="grid grid-cols-2 gap-3">
          {CONSOLES.map((c) => {
            const on = consoleId === c.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => { setSelConsole(c.id); setSelHour(null); }} className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition ${on ? "glass-active text-white" : "glass"}`}>
                <Gamepad2 size={18} /> {c.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Each console has its own free times. Switch consoles to see different slots.</p>
      </section>

      <section aria-label="Game">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Choose your game</h2>
        <div role="radiogroup" aria-label="Game" className="grid grid-cols-2 gap-3">
          {GAMES.map((g) => {
            const on = selGame === g;
            return (
              <button key={g} type="button" role="radio" aria-checked={on} onClick={() => setSelGame(g)} className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${on ? "glass-active text-white" : "glass"}`}>
                {g}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Select date">
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
          {days.map(({ key, d }, i) => {
            const active = key === activeDate;
            return (
              <button key={key} type="button" aria-pressed={active} onClick={() => { setSelDate(key); setSelHour(null); }} className={`flex w-16 shrink-0 flex-col items-center rounded-2xl py-3 transition ${active ? "glass-active text-white" : "glass"}`}>
                <span className={`text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                <span className="text-xl font-semibold">{d.getDate()}</span>
                <span className={`text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{d.toLocaleDateString("en-US", { month: "short" })}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Select start time">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Start time</h2>
        {slots.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-slate-500">No {hours}-hour sessions free on this date. Try fewer hours or another day.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {slots.map((hr) => {
              const on = hr === selHour;
              return (
                <button key={hr} type="button" aria-pressed={on} onClick={() => setSelHour(hr)} className={`rounded-2xl px-2 py-3 text-center transition ${on ? "glass-active text-white" : "glass"}`}>
                  <span className="block text-sm font-medium">{formatHour(hr)}</span>
                  <span className={`text-[11px] ${on ? "text-white/70" : "text-emerald-600"}`}>to {formatHour(hr + hours)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <button type="button" disabled={!slot || !selGame} onClick={() => setStep(1)} className="glass-btn flex w-full items-center justify-center rounded-full py-4 text-base font-semibold text-white disabled:opacity-50">
        {!selGame ? "Choose a game to continue" : slot ? `Continue · ${hours} hr · ${formatRs(total)}` : "Select a start time to continue"}
      </button>
    </div>
  );
}
