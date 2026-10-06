"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarPlus, Check, ChevronLeft, Gift, Loader2, Tag, X } from "lucide-react";
import PaymentMethodPicker from "@/components/payment/PaymentMethodPicker";
import PaymentQr from "@/components/payment/PaymentQr";
import { errorText } from "@/lib/api";
import { fmtPts } from "@/lib/points";
import { loyaltyStore } from "@/lib/loyalty";
import { METHOD_LABEL, isOnline, type PayMethod } from "@/lib/payment";
import { openSignIn, useSession } from "@/lib/session";
import {
  MAX_ADVANCE_DAYS,
  checkoutBooking,
  dateKey,
  fetchQuote,
  fetchSlots,
  formatHour,
  formatRs,
  myBookingsStore,
  parseKey,
  type Booking,
  type CheckoutResult,
  type Quote,
  type Slot,
} from "@/lib/booking";

const noop = () => () => {};
const nowKey = () => String(Math.floor(Date.now() / 60000)); // changes each minute
const PERIODS = ["Morning", "Day", "Evening"] as const;

function weekday(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function longDate(key: string) {
  return parseKey(key).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const hourOf = (t: string) => parseInt(t.split(":")[0], 10);

function downloadIcs(b: Booking) {
  const d = parseKey(b.date);
  const fmt = (h: number) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}0000`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Unique Futsal//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@uniquefutsal`,
    `DTSTAMP:${fmt(0)}`,
    `DTSTART:${fmt(hourOf(b.startTime))}`,
    `DTEND:${fmt(hourOf(b.startTime) + b.duration)}`,
    `SUMMARY:Futsal at Unique Futsal (${b.code ?? b.id})`,
    "LOCATION:Unique Futsal\\, Manigram Tilottama-05\\, Rupandehi",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${b.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function Steps({ step }: { step: number }) {
  const labels = ["Choose slot", "Review & pay", "Done"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col gap-1.5">
          <span className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-slate-200"}`} />
          <span className={i <= step ? "font-medium text-brand" : "text-slate-400"}>{l}</span>
        </li>
      ))}
    </ol>
  );
}

// Free slots for a date, from the server. `version` re-asks (for example after a slot was just taken).
function useSlots(date: string, version: number) {
  const [state, setState] = useState<{ key: string; slots: Slot[]; error: string | null } | null>(null);
  const key = `${date}|${version}`;
  useEffect(() => {
    let off = false;
    fetchSlots(date)
      .then((slots) => !off && setState({ key, slots, error: null }))
      .catch((e) => !off && setState({ key, slots: [], error: errorText(e) }));
    return () => {
      off = true;
    };
  }, [date, key]);
  const ready = state?.key === key;
  return { slots: ready ? state!.slots : null, error: ready ? state!.error : null };
}

export default function BookingFlow({ initialDate, initialHour }: { initialDate?: string; initialHour?: number }) {
  const tick = useSyncExternalStore(noop, nowKey, () => "");
  const now = useMemo(() => (tick ? new Date() : null), [tick]);
  const session = useSession();
  const loyalty = loyaltyStore.use().data ?? null;

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selDate, setSelDate] = useState<string | null>(initialDate ?? null);
  const [selHour, setSelHour] = useState<number | null>(initialHour ?? null);
  const [version, setVersion] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [quote, setQuote] = useState<{ key: string; q: Quote | null; error: string | null } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PayMethod>("esewa");
  const [useFree, setUseFree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);
  const [freeBooking, setFreeBooking] = useState(false);
  const [qr, setQr] = useState<CheckoutResult | null>(null);

  const today = now ? dateKey(now) : "";
  const days = now
    ? Array.from({ length: MAX_ADVANCE_DAYS + 1 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        return { key: dateKey(d), d };
      })
    : [];
  // A pre-selected date (e.g. from Quick Rebook) is only honoured inside the booking window.
  const wanted = selDate ?? today;
  const activeDate = days.some((d) => d.key === wanted) ? wanted : today;
  const { slots, error: slotsError } = useSlots(activeDate || "1970-01-01", version);
  const slot = slots?.find((s) => s.hour === selHour);

  const registered = Boolean(session?.registered);
  const voucher = slot && registered ? loyalty?.vouchers.find((v) => v.period === slot.period) : undefined;
  const free = Boolean(voucher) && useFree;
  const promoCode = !free && appliedCode ? appliedCode : undefined;

  // The server prices the slot (promo and voucher included). Asked again when the slot, code or voucher changes.
  const quoteKey = slot ? `${activeDate}|${slot.startTime}|${promoCode ?? ""}|${free ? voucher?.id : ""}` : "";
  useEffect(() => {
    if (!slot || !quoteKey) return;
    let off = false;
    fetchQuote({ date: activeDate, startTime: slot.startTime, promoCode, voucherId: free ? voucher?.id : undefined })
      .then((q) => !off && setQuote({ key: quoteKey, q, error: null }))
      .catch((e) => !off && setQuote({ key: quoteKey, q: null, error: errorText(e) }));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);
  const q = quote?.key === quoteKey ? quote.q : null;
  const promo = q?.promo ?? null;

  if (!now || !session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const base = slot?.price ?? 0;
  const total = q ? q.total : base;
  const phoneOk = /^9\d{9}$/.test(phone);
  // Registered customers are recognised automatically. Only guests type their details,
  // and guests must pay in full online (no "pay at venue").
  const effMethod: PayMethod = free ? "venue" : !registered && method === "venue" ? "esewa" : method;
  const canPay = Boolean(slot && q && (registered || (name.trim().length >= 2 && phoneOk)));
  const openSlots = slots ?? [];

  function pickDate(k: string) {
    setSelDate(k);
    setSelHour(null);
    setAppliedCode("");
    setPromoInput("");
    setError(null);
  }

  function pickSlot(s: Slot) {
    setSelHour(s.hour);
    setAppliedCode("");
    setPromoInput("");
    setError(null);
  }

  async function confirm() {
    if (!canPay || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await checkoutBooking({
        date: activeDate,
        startTime: slot.startTime,
        method: effMethod,
        promoCode: promo?.ok ? promo.code : undefined,
        voucherId: free ? voucher?.id : undefined,
        guest: registered ? undefined : { name: name.trim(), phone },
      });
      if (registered) {
        void myBookingsStore.refresh();
        void loyaltyStore.refresh();
      }
      if (res.payment && isOnline(effMethod)) {
        // The slot is held; the customer pays with the QR and the screen detects the payment.
        setQr(res);
      } else {
        setFreeBooking(free);
        setDone(res.booking);
        setStep(2);
      }
    } catch (e) {
      setError(errorText(e));
      setVersion((v) => v + 1); // the slot may have just been taken: refresh the list
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Step 2b: pay with the QR (eSewa / Fonepay) ---------- */
  if (qr && qr.payment && !done) {
    const pay = qr.payment;
    return (
      <div className="space-y-5">
        <Steps step={1} />
        <PaymentQr
          method={pay.method}
          orderId={pay.orderCode}
          amount={pay.amount}
          remarks={pay.remarks}
          payload={pay.qrPayload}
          expiresAt={pay.expiresAt}
          guestPhone={registered ? undefined : phone}
          onBack={() => {
            setQr(null);
            setVersion((v) => v + 1);
          }}
          onPaid={() => {
            // Called automatically when the server reports this booking as paid.
            setDone({ ...qr.booking, paymentStatus: "completed", status: "confirmed" });
            setQr(null);
            setStep(2);
            if (registered) void myBookingsStore.refresh();
          }}
        />
      </div>
    );
  }

  /* ---------- Step 3: confirmation ---------- */
  if (step === 2 && done) {
    const venue = done.paymentMethod === "venue" && done.paymentStatus !== "completed";
    const paid = done.paymentStatus === "completed";
    return (
      <div className="space-y-5">
        <Steps step={2} />
        <div className="glass rounded-3xl p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Check size={34} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">{paid ? "Booking confirmed!" : venue ? "Booking reserved!" : "Booking created!"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {paid ? "Payment received. See you on the pitch!" : venue ? "Please pay at the venue when you arrive." : "Your slot is held until payment is verified."}
          </p>
          <p className="mt-4 text-xs text-slate-400">Booking ID</p>
          <p className="font-mono text-lg font-semibold tracking-wide">{done.code ?? done.id}</p>
        </div>

        <dl className="glass space-y-3 rounded-3xl p-5 text-sm">
          {[
            ["Date", longDate(done.date)],
            ["Time", `${formatHour(hourOf(done.startTime))} – ${formatHour(hourOf(done.startTime) + done.duration)}`],
            ["Payment", freeBooking ? "Free game voucher" : paid ? `Paid via ${METHOD_LABEL[(done.paymentMethod === "full" ? "esewa" : done.paymentMethod) as PayMethod] ?? "online"}` : venue ? "Pay at venue" : "Awaiting payment confirmation"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-slate-400">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/60 pt-3 text-base">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold">{formatRs(done.totalPrice)}</dd>
          </div>
        </dl>

        <button type="button" onClick={() => downloadIcs(done)} className="glass flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium text-brand">
          <CalendarPlus size={18} /> Add to calendar
        </button>
        <Link href={registered ? "/profile" : "/"} className="glass-btn block rounded-full py-3.5 text-center text-sm font-medium text-white">
          {registered ? "View my bookings" : "Back to home"}
        </Link>
      </div>
    );
  }

  /* ---------- Step 2: review & pay ---------- */
  if (step === 1 && slot) {
    return (
      <div className="space-y-5">
        <Steps step={1} />
        <button type="button" onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-brand">
          <ChevronLeft size={18} /> Change slot
        </button>

        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-medium">Booking summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Date</dt><dd className="font-medium">{longDate(activeDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Time</dt><dd className="font-medium">{formatHour(slot.hour)} – {formatHour(slot.hour + 1)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Base price</dt><dd>{formatRs(q ? q.basePrice : base)}</dd></div>
            {q && q.discount > 0 && (
              <div className="flex justify-between text-emerald-600"><dt>{free ? "Free game voucher" : q.vip ? q.vip.label : `Promo ${promo?.code ?? ""}`}</dt><dd>− {formatRs(q.discount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-white/60 pt-3 text-base"><dt className="font-medium">Total</dt><dd className="font-semibold">{formatRs(total)}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">The final price is set by the server.</p>
          {registered && !free && q && q.earnPoints > 0 && (
            <p className="mt-3 rounded-2xl bg-amber-400/15 px-3 py-2 text-xs text-amber-700">You&apos;ll earn {fmtPts(q.earnPoints)} loyalty points after this game.</p>
          )}
          {quote?.key === quoteKey && quote.error && <p role="alert" className="mt-3 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{quote.error}</p>}
        </section>

        {registered && voucher && (
          <button
            type="button"
            onClick={() => setUseFree((v) => !v)}
            aria-pressed={free}
            className={`flex w-full items-center justify-between gap-3 rounded-3xl p-4 text-left ${free ? "glass-active text-white" : "glass"}`}
          >
            <span className="flex items-center gap-2 text-sm font-medium"><Gift size={18} className={free ? "text-orange-300" : "text-orange-500"} /> Use a free game voucher</span>
            <span className={`text-xs ${free ? "text-white/70" : "text-slate-400"}`}>{slot.period} shift · {free ? "Applied" : "Tap to apply"}</span>
          </button>
        )}

        {!free && (
          <section className="glass rounded-3xl p-5">
            <label htmlFor="promo" className="flex items-center gap-2 text-sm font-medium"><Tag size={16} className="text-brand" /> Promo code</label>
            <div className="mt-3 flex gap-2">
              <input
                id="promo"
                value={promoInput}
                onChange={(e) => { setPromoInput(e.target.value); setAppliedCode(""); }}
                placeholder="e.g. DASHAIN83"
                autoCapitalize="characters"
                className="min-w-0 flex-1 rounded-2xl bg-white/70 px-4 py-3 text-sm uppercase outline-none ring-1 ring-white/80 focus:ring-brand"
              />
              <button type="button" onClick={() => setAppliedCode(promoInput.trim())} className="rounded-2xl bg-brand px-5 text-sm font-medium text-white">Apply</button>
            </div>
            {q?.vip && (!appliedCode || !promo?.ok) && (
              <p role="status" className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                <Check size={14} /> {q.vip.label} applied to every game (− {formatRs(q.discount)})
              </p>
            )}
            {appliedCode && promo && (
              <p role="status" className={`mt-2 flex items-center gap-1 text-xs ${promo.ok ? "text-emerald-600" : "text-rose-500"}`}>
                {promo.ok ? <Check size={14} /> : <X size={14} />}
                {promo.ok ? `Promo applied: ${promo.label} (− ${formatRs(q?.discount ?? 0)})` : promo.message}
              </p>
            )}
          </section>
        )}

        {session.registered ? (
          <p className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="text-slate-500">Booking as</span>
            <span className="text-right font-medium">{session.name} · {session.phone}</span>
          </p>
        ) : (
          <section className="glass space-y-3 rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Guest details</h2>
              <button type="button" onClick={openSignIn} className="text-xs font-medium text-brand">Have an account? Sign in</button>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" autoComplete="name" className="w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand" />
            <div>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="Mobile number (98XXXXXXXX)" aria-label="Mobile number" autoComplete="tel" className="w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand" />
              {phone.length > 0 && !phoneOk && <p className="mt-1 text-xs text-rose-500">Enter a 10-digit mobile number starting with 9.</p>}
            </div>
          </section>
        )}

        {!free && <PaymentMethodPicker value={effMethod} onChange={setMethod} allowVenue={registered} />}

        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button
          type="button"
          onClick={confirm}
          disabled={!canPay || submitting}
          className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {submitting ? <><Loader2 size={18} className="animate-spin" /> Processing…</> : free ? "Book free game" : effMethod === "venue" ? `Reserve · ${formatRs(total)}` : `Continue to ${METHOD_LABEL[effMethod]} QR · ${formatRs(total)}`}
        </button>
      </div>
    );
  }

  /* ---------- Step 1: choose date, slot ---------- */
  return (
    <div className="space-y-6">
      <Steps step={0} />
      <header>
        <h1 className="text-2xl font-semibold">Book a court</h1>
        <p className="text-sm text-slate-500">Pick a date and a one-hour slot. Bookings open up to {MAX_ADVANCE_DAYS} days in advance.</p>
        {initialHour !== undefined && selHour === initialHour && slots && !slot && (
          <p role="status" className="mt-2 rounded-xl bg-amber-400/15 px-3 py-2 text-xs text-amber-700">Your usual slot isn&apos;t available on this date. Please pick another time.</p>
        )}
      </header>

      <section aria-label="Select date">
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
          {days.map(({ key, d }, i) => {
            const active = key === activeDate;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickDate(key)}
                aria-pressed={active}
                className={`flex w-16 shrink-0 flex-col items-center rounded-2xl py-3 transition ${active ? "glass-active text-white" : "glass"}`}
              >
                <span className={`text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{i === 0 ? "Today" : i === 1 ? "Tmrw" : weekday(d)}</span>
                <span className="text-xl font-semibold">{d.getDate()}</span>
                <span className={`text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{d.toLocaleDateString("en-US", { month: "short" })}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Select time slot" className="space-y-5">
        {slots === null ? (
          <div className="space-y-3" aria-label="Loading slots">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/40" />)}
          </div>
        ) : slotsError ? (
          <p role="alert" className="glass rounded-2xl px-4 py-6 text-center text-sm text-rose-600">{slotsError}</p>
        ) : openSlots.length === 0 ? (
          <p className="glass rounded-2xl px-4 py-6 text-center text-sm text-slate-500">
            No slots available on this date. Please pick another day.
          </p>
        ) : (
          PERIODS.filter((p) => openSlots.some((s) => s.period === p)).map((p) => (
            <div key={p}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{p}</h2>
              <div className="grid grid-cols-2 gap-3">
                {openSlots.filter((s) => s.period === p).map((s) => {
                  const active = s.hour === selHour;
                  return (
                    <button
                      key={s.hour}
                      type="button"
                      onClick={() => pickSlot(s)}
                      aria-pressed={active}
                      className={`rounded-2xl px-3 py-3 text-left transition ${active ? "glass-active text-white" : "glass"}`}
                    >
                      <span className="block text-sm font-medium">{formatHour(s.hour)}</span>
                      <span className={`text-[11px] ${active ? "text-white/70" : "text-emerald-600"}`}>
                        Available · {formatRs(s.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      <button
        type="button"
        disabled={!slot}
        onClick={() => setStep(1)}
        className="glass-btn flex w-full items-center justify-center rounded-full py-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {slot ? `Continue · ${formatHour(slot.hour)} · ${formatRs(slot.price)}` : "Select a slot to continue"}
      </button>
    </div>
  );
}
