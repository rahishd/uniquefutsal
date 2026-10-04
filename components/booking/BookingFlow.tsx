"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Gift, ChevronLeft, Loader2, Tag, X } from "lucide-react";
import { addNotice, scheduleReminder } from "@/lib/notifications";
import PaymentMethodPicker from "@/components/payment/PaymentMethodPicker";
import { signInDemo, useSession } from "@/lib/session";
import { pointsForGame, spendVoucher, useVouchers } from "@/lib/points";
import PaymentQr from "@/components/payment/PaymentQr";
import { METHOD_LABEL, isOnline, remarksFor } from "@/lib/payment";
import {
  MAX_ADVANCE_DAYS,
  COURTS,
  createBooking,
  dateKey,
  formatHour,
  formatRs,
  getSlots,
  parseKey,
  validatePromo,
  type BookingConfirmation,
  type PaymentMethod,
  type PromoResult,
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

function downloadIcs(c: BookingConfirmation) {
  const d = parseKey(c.request.dateKey);
  const fmt = (h: number) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}0000`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Unique Futsal//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${c.id}@uniquefutsal`,
    `DTSTAMP:${fmt(0)}`,
    `DTSTART:${fmt(c.request.hour)}`,
    `DTEND:${fmt(c.request.hour + 1)}`,
    `SUMMARY:Futsal at Unique Futsal (${c.id})`,
    "LOCATION:Unique Futsal\\, Manigram Tilottama-05\\, Rupandehi",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// Notices for a new booking, plus the 1-hour reminder before kick-off.
// "Payment received" is raised only when the server has reported the order as paid.
function notifyBooking(c: BookingConfirmation) {
  const when = `${longDate(c.request.dateKey)} · ${formatHour(c.request.hour)} – ${formatHour(c.request.hour + 1)}`;
  addNotice({ id: `booking-${c.id}`, type: "booking", title: "Booking confirmed", body: `${when}. ID ${c.id}.`, href: "/profile" });
  addNotice({
    id: `payment-${c.id}`,
    type: "payment",
    title: c.paymentStatus === "paid" ? "Payment received" : c.paymentStatus === "pay_at_venue" ? "Pay at the venue" : "Payment pending",
    body:
      c.paymentStatus === "paid"
        ? `${formatRs(c.total)} received for booking ${c.id}.`
        : c.paymentStatus === "pay_at_venue"
          ? `Please pay ${formatRs(c.total)} when you arrive.`
          : `${formatRs(c.total)} is awaiting payment confirmation for ${c.id}.`,
    href: "/profile",
  });
  const start = parseKey(c.request.dateKey);
  start.setHours(c.request.hour, 0, 0, 0);
  scheduleReminder(c.id, start.getTime(), COURTS.find((x) => x.id === c.request.courtId)?.name);
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

export default function BookingFlow({ initialDate, initialHour }: { initialDate?: string; initialHour?: number }) {
  const tick = useSyncExternalStore(noop, nowKey, () => "");
  const now = useMemo(() => (tick ? new Date() : null), [tick]);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selDate, setSelDate] = useState<string | null>(initialDate ?? null);
  const [selHour, setSelHour] = useState<number | null>(initialHour ?? null);
  const [selCourt, setSelCourt] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoResult | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("esewa");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<BookingConfirmation | null>(null);
  const [qr, setQr] = useState<{ booking: BookingConfirmation; heldAt: number } | null>(null);
  const session = useSession();
  const vouchers = useVouchers(); // free games claimed on the Loyalty Points page
  const [useFree, setUseFree] = useState(false);
  const [freeId, setFreeId] = useState<string | null>(null);

  if (!now || !session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const today = dateKey(now);
  const days = Array.from({ length: MAX_ADVANCE_DAYS + 1 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { key: dateKey(d), d };
  });
  // A pre-selected date (e.g. from Quick Rebook) is only honoured inside the booking window.
  const wanted = selDate ?? today;
  const activeDate = days.some((d) => d.key === wanted) ? wanted : today;
  const slots = getSlots(activeDate, now);
  const slot: Slot | undefined = slots.find((s) => s.hour === selHour && s.status !== "booked" && s.status !== "past");
  const court = selCourt ?? slot?.freeCourts[0] ?? null;
  const openSlots = slots.filter((s) => s.status === "available" || s.status === "almost");
  const base = slot?.price ?? 0;
  const discount = promo?.ok ? promo.discount : 0;
  // A free-game voucher covers a regular booking in full (it never applies to challenge games).
  const registeredNow = session.registered;
  const voucher = slot ? vouchers.find((v) => v.period === slot.period) : undefined;
  const free = registeredNow && useFree && Boolean(voucher);
  const total = free ? 0 : Math.max(0, base - discount);
  const phoneOk = /^9\d{9}$/.test(phone);
  // Registered customers are recognised automatically. Only guests type their details,
  // and guests must pay in full online (no "pay at venue").
  const registered = session.registered;
  const effMethod: PaymentMethod = free ? "venue" : !registered && method === "venue" ? "esewa" : method;
  const custName = session.registered ? session.name : name.trim();
  const custPhone = session.registered ? session.phone : phone;
  const canPay = Boolean(slot && court && (registered || (name.trim().length >= 2 && phoneOk)));

  function pickDate(k: string) {
    setSelDate(k);
    setSelHour(null);
    setSelCourt(null);
    setPromo(null);
  }

  function pickSlot(s: Slot) {
    if (s.status === "booked" || s.status === "past") return;
    setSelHour(s.hour);
    setSelCourt(s.freeCourts[0]);
    setPromo(null);
  }

  function applyPromo() {
    if (selHour === null) return;
    setPromo(validatePromo(promoInput, { dateKey: activeDate, hour: selHour, base, today }));
  }

  async function confirm() {
    if (!canPay || selHour === null || !court) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createBooking(
        { dateKey: activeDate, hour: selHour, courtId: court, promoCode: promo?.ok ? promo.code : undefined, method: effMethod, name: custName, phone: custPhone, guest: !registered },
        { base, discount, total },
      );
      if (free) {
        // Nothing to pay: the voucher covers it. The server must verify and spend the voucher itself.
        if (!slot || !spendVoucher(slot.period, res.id)) throw new Error("no voucher");
        const paid = { ...res, paymentStatus: "paid" as const };
        setFreeId(paid.id);
        notifyBooking(paid);
        setDone(paid);
        setStep(2);
      } else if (isOnline(res.request.method)) {
        // The booking is held; the customer pays with the QR and the screen detects the payment.
        setQr({ booking: res, heldAt: res.createdAt });
      } else {
        notifyBooking(res);
        setDone(res);
        setStep(2);
      }
    } catch {
      setError("Sorry, we couldn't complete your booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Step 2b: pay with the QR (eSewa / Fonepay) ---------- */
  if (qr && !done && isOnline(qr.booking.request.method)) {
    return (
      <div className="space-y-5">
        <Steps step={1} />
        <PaymentQr
          method={qr.booking.request.method}
          orderId={qr.booking.id}
          amount={qr.booking.total}
          remarks={remarksFor("game", qr.booking.id)}
          heldAt={qr.heldAt}
          onBack={() => setQr(null)}
          onPaid={() => {
            // Called automatically when the server reports this booking as paid.
            const paid = { ...qr.booking, paymentStatus: "paid" as const };
            notifyBooking(paid);
            setDone(paid);
            setQr(null);
            setStep(2);
          }}
        />
      </div>
    );
  }

  /* ---------- Step 3: confirmation ---------- */
  if (step === 2 && done) {
    const court = COURTS.find((c) => c.id === done.request.courtId)?.name;
    const venue = done.paymentStatus === "pay_at_venue";
    const paid = done.paymentStatus === "paid";
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
          <p className="font-mono text-lg font-semibold tracking-wide">{done.id}</p>
        </div>

        <dl className="glass space-y-3 rounded-3xl p-5 text-sm">
          {[
            ["Date", longDate(done.request.dateKey)],
            ["Time", `${formatHour(done.request.hour)} – ${formatHour(done.request.hour + 1)}`],
            ["Court", court ?? ""],
            ["Payment", paid ? (done.id === freeId ? "Free game (loyalty points)" : `Paid via ${METHOD_LABEL[done.request.method]}`) : venue ? "Pay at venue" : "Awaiting payment confirmation"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-slate-400">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/60 pt-3 text-base">
            <dt className="font-medium">Total</dt>
            <dd className="font-semibold">{formatRs(done.total)}</dd>
          </div>
        </dl>

        <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-700">
          Demo mode: this booking was not saved and no payment was taken. Real bookings need the backend API.
        </p>

        <button type="button" onClick={() => downloadIcs(done)} className="glass flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium text-brand">
          <CalendarPlus size={18} /> Add to calendar
        </button>
        <Link href="/profile" className="glass-btn block rounded-full py-3.5 text-center text-sm font-medium text-white">
          View my bookings
        </Link>
      </div>
    );
  }

  /* ---------- Step 2: review & pay ---------- */
  if (step === 1 && slot && court) {
    const courtName = COURTS.find((c) => c.id === court)?.name;
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
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Court</dt>
              <dd className="flex gap-2">
                {COURTS.filter((c) => slot.freeCourts.includes(c.id)).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelCourt(c.id)}
                    aria-pressed={court === c.id}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${court === c.id ? "glass-active text-white" : "bg-white/60 text-slate-600"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </dd>
            </div>
            <div className="flex justify-between"><dt className="text-slate-400">Base price</dt><dd>{formatRs(base)}</dd></div>
            {discount > 0 && promo?.ok && (
              <div className="flex justify-between text-emerald-600"><dt>Promo {promo.code}</dt><dd>− {formatRs(discount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-white/60 pt-3 text-base"><dt className="font-medium">Total</dt><dd className="font-semibold">{formatRs(total)}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">{courtName} · final price is confirmed by the server.</p>
          {registered && !free && total > 0 && (
            <p className="mt-3 rounded-2xl bg-amber-400/15 px-3 py-2 text-xs text-amber-700">You&apos;ll earn {pointsForGame(total)} loyalty points after this game.</p>
          )}
        </section>

        {registered && voucher && (
          <button
            type="button"
            onClick={() => setUseFree((v) => !v)}
            aria-pressed={free}
            className={`flex w-full items-center justify-between gap-3 rounded-3xl p-4 text-left ${free ? "glass-active text-white" : "glass"}`}
          >
            <span className="flex items-center gap-2 text-sm font-medium"><Gift size={18} className={free ? "text-orange-300" : "text-orange-500"} /> Use a free game voucher</span>
            <span className={`text-xs ${free ? "text-white/70" : "text-slate-400"}`}>{slot?.period} shift · {free ? "Applied" : "Tap to apply"}</span>
          </button>
        )}

        {!free && <section className="glass rounded-3xl p-5">
          <label htmlFor="promo" className="flex items-center gap-2 text-sm font-medium"><Tag size={16} className="text-brand" /> Promo code</label>
          <div className="mt-3 flex gap-2">
            <input
              id="promo"
              value={promoInput}
              onChange={(e) => { setPromoInput(e.target.value); setPromo(null); }}
              placeholder="e.g. DASHAIN83"
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-2xl bg-white/70 px-4 py-3 text-sm uppercase outline-none ring-1 ring-white/80 focus:ring-brand"
            />
            <button type="button" onClick={applyPromo} className="rounded-2xl bg-brand px-5 text-sm font-medium text-white">Apply</button>
          </div>
          {promo && (
            <p role="status" className={`mt-2 flex items-center gap-1 text-xs ${promo.ok ? "text-emerald-600" : "text-rose-500"}`}>
              {promo.ok ? <Check size={14} /> : <X size={14} />}
              {promo.ok ? `Promo applied: ${promo.label} (− ${formatRs(promo.discount)})` : promo.message}
            </p>
          )}
        </section>}

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
        {initialHour !== undefined && selHour === initialHour && !slot && (
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
        {/* Only bookable slots are listed: booked and past ones are hidden. */}
        {openSlots.length === 0 ? (
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
                      <span className={`text-[11px] ${active ? "text-white/70" : s.status === "almost" ? "text-orange-500" : "text-emerald-600"}`}>
                        {s.status === "almost" ? "Almost full" : "Available"} · {formatRs(s.price)}
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
