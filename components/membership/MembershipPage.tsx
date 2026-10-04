"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Crown, Loader2, Sparkles, Tag, X } from "lucide-react";
import PaymentMethodPicker from "@/components/payment/PaymentMethodPicker";
import PaymentQr from "@/components/payment/PaymentQr";
import { addNotice } from "@/lib/notifications";
import { dateKey } from "@/lib/booking";
import { METHOD_LABEL, isOnline, remarksFor, type PayMethod } from "@/lib/payment";
import {
  BILLINGS,
  BILLING_LABEL,
  EXPIRING_SOON_DAYS,
  PLANS,
  daysLeft,
  fmtDate,
  formatRs,
  isRenewal,
  priceOf,
  savings,
  purchaseMembership,
  sampleCurrent,
  statusOf,
  validateMemberPromo,
  type Billing,
  type MemberPromoResult,
  type MemberStatus,
  type Membership,
  type Plan,
  type PurchaseResult,
} from "@/lib/membership";
import { sampleProfile } from "@/lib/sample-profile";

const noop = () => () => {};
const nowKey = () => dateKey(new Date());

const STATUS_STYLE: Record<MemberStatus, string> = {
  Active: "bg-emerald-400/20 text-emerald-300",
  "Expiring soon": "bg-amber-400/25 text-amber-200",
  Expired: "bg-rose-400/25 text-rose-200",
  Suspended: "bg-rose-400/25 text-rose-200",
  Pending: "bg-sky-400/25 text-sky-200",
};

const field = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

function planOf(id: string) {
  return PLANS.find((p) => p.id === id);
}

export default function MembershipPage() {
  const today = useSyncExternalStore(noop, nowKey, () => "");

  const [active] = useState<Membership | null>(sampleCurrent);
  // A purchase stays pending until the server verifies the payment; it never replaces an active plan.
  const [pending, setPending] = useState<Membership | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [step, setStep] = useState<"browse" | "review" | "qr" | "done">("browse");
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [name, setName] = useState(sampleProfile.name);
  const [phone, setPhone] = useState(sampleProfile.phone);
  const [method, setMethod] = useState<PayMethod>("esewa");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<MemberPromoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PurchaseResult | null>(null); // the created order (held while the QR is shown)
  const [txnRef, setTxnRef] = useState<string | null>(null);

  if (!today) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  const phoneOk = /^9\d{9}$/.test(phone);
  const canPay = Boolean(chosen && name.trim().length >= 2 && phoneOk);
  const current = active ?? pending; // what the dashboard card shows
  const curPlan = current ? planOf(current.planId) : undefined;
  const pendingPlan = pending ? planOf(pending.planId) : undefined;
  const status = current ? statusOf(current, today) : null;

  function choose(p: Plan) {
    setChosen(p);
    setError(null);
    setPromo(null);
    setPromoInput("");
    setStep("review");
    window.scrollTo({ top: 0 });
  }

  function finish(res: PurchaseResult, plan: Plan) {
    const venue = method === "venue";
    setOrder(res);
    setPending(res.membership);
    addNotice({
      id: `membership-${res.membership.id}`,
      type: "membership",
      title: venue ? "Membership reserved" : "Membership payment submitted",
      body: venue
        ? `${plan.name} (${BILLING_LABEL[billing]}) · pay ${formatRs(res.total)} at the venue to activate it.`
        : `${plan.name} (${BILLING_LABEL[billing]}) · ${formatRs(res.total)}. We'll activate it once the payment is verified.`,
      href: "/member",
    });
    setStep("done");
    window.scrollTo({ top: 0 });
  }

  function applyPromo(base: number, renewing: boolean) {
    setPromo(validateMemberPromo(promoInput, { renewing, base, today }));
  }

  async function pay() {
    if (!chosen || !canPay) return;
    setBusy(true);
    setError(null);
    try {
      const res = await purchaseMembership(
        { planId: chosen.id, billing, method, promoCode: promo?.ok ? promo.code : undefined, name: name.trim(), phone },
        active,
        today,
      );
      setOrder(res);
      if (isOnline(method)) {
        setStep("qr"); // show the QR for the final amount; the customer pays, then taps "I've paid"
        window.scrollTo({ top: 0 });
      } else {
        finish(res, chosen);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not be completed. Your membership has not been activated.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- pay with the QR (eSewa / Fonepay) ---------- */
  if (step === "qr" && order && chosen && isOnline(method)) {
    return (
      <PaymentQr
        method={method}
        amount={order.total}
        remarks={remarksFor(order.renewing ? "renew" : "purchase", order.membership.id)}
        heldAt={order.createdAt}
        onBack={() => { setOrder(null); setStep("review"); }}
        onPaid={(ref) => {
          setTxnRef(ref ?? null); // DEMO: the real API receives this to match the payment faster
          finish(order, chosen);
        }}
      />
    );
  }

  /* ---------- confirmation ---------- */
  if (step === "done" && order && chosen) {
    const venue = method === "venue";
    return (
      <div className="space-y-5">
        <div className="glass rounded-3xl p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/15 text-sky-600">
            <Check size={34} />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">{venue ? "Membership reserved" : "Payment submitted"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {venue ? "Pay at the venue to activate your membership." : "Your membership activates as soon as the payment is verified."}
          </p>
          <p className="mt-4 text-xs text-slate-400">Membership ID</p>
          <p className="font-mono text-lg font-semibold tracking-wide">{order.membership.id}</p>
        </div>

        <dl className="glass space-y-3 rounded-3xl p-5 text-sm">
          {[
            ["Plan", `${chosen.name} · ${BILLING_LABEL[order.membership.billing]}`],
            ["Valid", `${fmtDate(order.membership.startKey)} – ${fmtDate(order.membership.endKey)}`],
            ["Payment", METHOD_LABEL[method]],
            ["Status", venue ? "Awaiting payment at venue" : "Pending verification"],
            ...(txnRef ? [["Transaction ID", txnRef]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-slate-400">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
          {order.discount > 0 && <div className="flex justify-between text-emerald-600"><dt>Promo</dt><dd>− {formatRs(order.discount)}</dd></div>}
          <div className="flex justify-between border-t border-white/60 pt-3 text-base"><dt className="font-medium">Total</dt><dd className="font-semibold">{formatRs(order.total)}</dd></div>
        </dl>

        <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-700">
          Demo mode: no payment was taken and nothing was saved. Real memberships need the backend and payment gateway.
        </p>

        <button type="button" onClick={() => { setStep("browse"); setChosen(null); setOrder(null); setTxnRef(null); }} className="glass-btn block w-full rounded-full py-3.5 text-center text-sm font-medium text-white">
          View my membership
        </button>
      </div>
    );
  }

  /* ---------- review & pay ---------- */
  if (step === "review" && chosen) {
    const base = priceOf(chosen, billing);
    const renewing = isRenewal(active, chosen.id, today);
    const discount = promo?.ok ? promo.discount : 0;
    const total = Math.max(0, base - discount);
    return (
      <div className="space-y-5">
        <button type="button" onClick={() => setStep("browse")} className="flex items-center gap-1 text-sm text-brand"><ChevronLeft size={18} /> Back to plans</button>
        <h1 className="text-2xl font-semibold">{renewing ? "Renew membership" : "Confirm membership"}</h1>

        <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
          <p className="flex items-center gap-2 text-sm text-white/70"><Crown size={16} /> {chosen.name} · {BILLING_LABEL[billing]}</p>
          <p className="mt-1 text-3xl font-semibold">{formatRs(total)}</p>
          {discount > 0 && <p className="text-xs text-emerald-300">Was {formatRs(base)} · promo saves {formatRs(discount)}</p>}
          <p className="text-xs text-white/60">{renewing ? "Renewal continues from your current end date." : "Starts when your payment is verified."}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {chosen.benefits.map((b) => <li key={b} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-300" /> {b}</li>)}
          </ul>
        </section>

        <section className="glass rounded-3xl p-5">
          <label htmlFor="mpromo" className="flex items-center gap-2 text-sm font-medium"><Tag size={16} className="text-brand" /> Promo code</label>
          <div className="mt-3 flex gap-2">
            <input id="mpromo" value={promoInput} onChange={(e) => { setPromoInput(e.target.value); setPromo(null); }} placeholder="e.g. MEMBER10" autoCapitalize="characters" className="min-w-0 flex-1 rounded-2xl bg-white/70 px-4 py-3 text-sm uppercase outline-none ring-1 ring-white/80 focus:ring-brand" />
            <button type="button" onClick={() => applyPromo(base, Boolean(renewing))} className="rounded-2xl bg-brand px-5 text-sm font-medium text-white">Apply</button>
          </div>
          {promo && (
            <p role="status" className={`mt-2 flex items-center gap-1 text-xs ${promo.ok ? "text-emerald-600" : "text-rose-500"}`}>
              {promo.ok ? <Check size={14} /> : <X size={14} />}
              {promo.ok ? `Promo applied: ${promo.label} (− ${formatRs(promo.discount)})` : promo.message}
            </p>
          )}
        </section>

        <section className="glass space-y-3 rounded-3xl p-5">
          <h2 className="text-sm font-medium">Your details</h2>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" autoComplete="name" />
          <div>
            <input className={field} value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Mobile number (98XXXXXXXX)" aria-label="Mobile number" autoComplete="tel" />
            {phone.length > 0 && !phoneOk && <p className="mt-1 text-xs text-rose-500">Enter a 10-digit mobile number starting with 9.</p>}
          </div>
        </section>

        <PaymentMethodPicker value={method} onChange={setMethod} />

        {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="button" onClick={pay} disabled={!canPay || busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-4 text-base font-semibold text-white disabled:opacity-50">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Processing…</> : method === "venue" ? `Reserve · ${formatRs(total)}` : `Continue to ${METHOD_LABEL[method]} QR · ${formatRs(total)}`}
        </button>
      </div>
    );
  }

  /* ---------- browse: current membership + plans ---------- */
  const left = current ? daysLeft(current.endKey, today) : 0;
  const total = current ? Math.max(1, daysLeft(current.endKey, current.startKey)) : 1;
  const elapsedPct = current ? Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100))) : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Membership</h1>
        <p className="text-sm text-slate-500">Member pricing, priority booking and extra rewards.</p>
      </header>

      {active && pending && pendingPlan && (
        <p role="status" className="rounded-2xl bg-sky-500/10 px-4 py-3 text-sm text-sky-800">
          <b>{pendingPlan.name} · {BILLING_LABEL[pending.billing]}</b> payment submitted ({pending.id}). It activates once we verify it; your current plan stays in place until then.
        </p>
      )}

      {current && curPlan && status ? (
        <section aria-label="Your membership" className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-white/70"><Crown size={16} /> Your membership</p>
              <p className="mt-1 text-xl font-semibold">{curPlan.name} · {BILLING_LABEL[current.billing]}</p>
              <p className="font-mono text-xs text-white/60">{current.id}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>
          </div>

          <p className="mt-4 text-xs text-white/70">Valid {fmtDate(current.startKey)} – {fmtDate(current.endKey)}</p>
          {status !== "Pending" && (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Membership period used" aria-valuenow={elapsedPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-orange-400" style={{ width: `${elapsedPct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-white/70">
                {left < 0 ? "Expired" : left === 0 ? "Ends today" : `${left} day${left === 1 ? "" : "s"} left`}
                {status === "Expiring soon" && ` · renews within ${EXPIRING_SOON_DAYS} days`}
              </p>
            </>
          )}
          {status === "Pending" && <p className="mt-2 text-xs text-sky-200">We&apos;re verifying your payment. Benefits start once it&apos;s confirmed.</p>}

          <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm">
            <div className="flex justify-between"><span className="text-white/70">Member-priced games this month</span><b>{current.usedThisMonth} / {curPlan.monthlyAllowance}</b></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Monthly usage" aria-valuenow={current.usedThisMonth} aria-valuemin={0} aria-valuemax={curPlan.monthlyAllowance}>
              <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(100, (current.usedThisMonth / curPlan.monthlyAllowance) * 100)}%` }} />
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-2">
            {curPlan.benefits.map((b) => <li key={b} className="rounded-full bg-white/15 px-3 py-1 text-[11px]">{b}</li>)}
          </ul>

          {status !== "Suspended" && status !== "Pending" && (
            <button type="button" onClick={() => choose(curPlan)} className="glass-btn mt-5 rounded-full px-6 py-3 text-sm font-medium text-white">
              {status === "Expired" ? "Renew membership" : "Renew early"}
            </button>
          )}
          {status === "Suspended" && <p className="mt-4 rounded-2xl bg-rose-500/20 px-4 py-3 text-xs text-rose-100">Your membership is suspended. Please contact the venue.</p>}
        </section>
      ) : (
        <section className="glass flex items-center gap-4 rounded-3xl p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Sparkles size={22} /></span>
          <div>
            <p className="font-medium">Become a member</p>
            <p className="text-sm text-slate-500">Pick a plan below to unlock member pricing.</p>
          </div>
        </section>
      )}

      <section aria-label="Membership plans">
        <h2 className="text-lg font-medium">{active ? "Plans" : "Choose a plan"}</h2>
        <div role="radiogroup" aria-label="Plan length" className="mt-3 grid grid-cols-3 rounded-full bg-white/60 p-1 text-sm font-medium">
          {BILLINGS.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={billing === b} onClick={() => setBilling(b)} className={`rounded-full py-2 ${billing === b ? "glass-active text-white" : "text-slate-500"}`}>
              {BILLING_LABEL[b]}
            </button>
          ))}
        </div>
        {billing !== "monthly" && <p className="mt-2 text-xs text-emerald-600">Longer plans cost less per month.</p>}

        <ul className="mt-4 space-y-4">
          {PLANS.map((p) => {
            const isCurrent = active?.planId === p.id && status !== "Expired";
            return (
              <li key={p.id} className={`glass relative rounded-3xl p-5 ${p.popular ? "ring-2 ring-brand/60" : ""}`}>
                {p.popular && <span className="absolute -top-3 right-5 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white shadow">Most popular</span>}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg font-semibold">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.tagline}</p>
                  </div>
                  <p className="text-right"><span className="text-2xl font-semibold">{formatRs(priceOf(p, billing))}</span><span className="block text-[11px] text-slate-400">{billing === "monthly" ? "per month" : `for ${BILLING_LABEL[billing].toLowerCase()}`}</span>{savings(p, billing) > 0 && <span className="block text-[11px] font-medium text-emerald-600">Save {formatRs(savings(p, billing))}</span>}</p>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {p.benefits.map((b) => <li key={b} className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {b}</li>)}
                </ul>
                <button type="button" onClick={() => choose(p)} className={`mt-5 w-full rounded-full py-3.5 text-sm font-semibold ${isCurrent ? "bg-white/70 text-brand" : "glass-btn text-white"}`}>
                  {isCurrent ? "Renew this plan" : active ? `Switch to ${p.name}` : "Choose plan"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-center text-xs text-slate-400">
        Questions about plans? <Link href="/" className="text-brand">Contact the venue</Link> from the home screen.
      </p>
    </div>
  );
}
