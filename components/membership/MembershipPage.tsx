"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Crown, Loader2, MessageCircle, Phone, Star } from "lucide-react";
import { MEMBERSHIP_POINTS } from "@/lib/points";
import { site } from "@/lib/site";
import { errorText } from "@/lib/api";
import { dateKey, formatRs } from "@/lib/booking";
import { openSignIn, useSession } from "@/lib/session";
import {
  DURATION_LABEL, PEAK_SLOTS, fetchSlots, myMembershipStore, plansStore, requestMembership, timeOfDay,
  type Duration, type MembershipPlan, type MySubscription, type SlotInfo,
} from "@/lib/membership";

const fieldCls = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const hourLabel = (slot: string) => {
  const h = parseInt(slot.split(":")[0], 10);
  const f = (n: number) => `${((n + 11) % 12) + 1} ${n < 12 ? "AM" : "PM"}`;
  return `${f(h)} – ${f(h + 1)}`;
};

function Current({ s }: { s: MySubscription }) {
  const active = s.status === "active";
  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-6 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-amber-300"><Crown size={24} /></span>
      <h2 className="mt-4 text-xl font-semibold">{s.plan} membership</h2>
      <p className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-200"}`}>
        {active ? "Active" : "Waiting for your payment at the venue"}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-white/60">Your hour</dt><dd className="font-medium">{s.timeSlot ? hourLabel(s.timeSlot) : "-"}</dd></div>
        <div><dt className="text-white/60">Period</dt><dd className="font-medium">{day(s.startDate)} – {day(s.endDate)}</dd></div>
        {s.total != null && <div><dt className="text-white/60">Price</dt><dd className="font-medium">{formatRs(s.total)}</dd></div>}
      </dl>
      {!active && <p className="mt-4 text-sm text-white/75">Pay the amount at the venue. The staff will activate your membership and you will get a notice here.</p>}
    </section>
  );
}

function RequestForm({ plans }: { plans: MembershipPlan[] }) {
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return dateKey(d); })();
  const [planId, setPlanId] = useState(plans.find((p) => p.featured)?.id ?? plans[0]?.id ?? "");
  const [duration, setDuration] = useState<Duration>("1_month");
  const [startDate, setStartDate] = useState(tomorrow);
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSlots(startDate)
      .then((s) => { if (alive) { setSlots(s.filter((x) => !PEAK_SLOTS.includes(x.slot))); setSlot(""); } })
      .catch((e) => { if (alive) { setSlots([]); setError(errorText(e)); } });
    return () => { alive = false; };
  }, [startDate]);

  const plan = plans.find((p) => p.id === planId);
  const priceFor = (sl: string) => plan?.prices[duration][timeOfDay(sl)] ?? null;
  const total = slot ? priceFor(slot) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !slot || total === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await requestMembership({ planId: plan.id, timeSlot: slot, duration, startDate });
      setSent(r.total);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent !== null) {
    return (
      <section className="glass rounded-3xl p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto text-emerald-500" size={40} />
        <h2 className="mt-3 text-lg font-semibold">Request received</h2>
        <p className="mt-1 text-sm text-slate-600">Pay {formatRs(sent)} at the venue. The staff will activate your membership.</p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="glass space-y-4 rounded-3xl p-5">
      <h2 className="text-base font-semibold">Get a membership</h2>
      <p className="text-sm text-slate-500">You are signed in, so we use your account. Choose a plan, your fixed hour and a start date.</p>

      <div className="space-y-2" role="radiogroup" aria-label="Plan">
        {plans.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === planId} onClick={() => setPlanId(p.id)}
            className={`w-full rounded-2xl p-4 text-left text-sm ${p.id === planId ? "glass-active text-white" : "bg-white/60"}`}>
            <span className="flex items-center justify-between font-medium">{p.name}{p.featured && <Star size={14} className="text-amber-400" />}</span>
            {p.description && <span className={`mt-0.5 block text-xs ${p.id === planId ? "text-white/75" : "text-slate-500"}`}>{p.description}</span>}
            {p.perks.length > 0 && <span className={`mt-1 block text-xs ${p.id === planId ? "text-white/75" : "text-slate-500"}`}>{p.perks.join(" · ")}</span>}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Period" className="grid grid-cols-2 gap-2 rounded-full bg-white/50 p-1 text-sm">
        {(Object.keys(DURATION_LABEL) as Duration[]).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={duration === d} onClick={() => setDuration(d)} className={`rounded-full py-2 font-medium ${duration === d ? "glass-active text-white" : "text-slate-500"}`}>{DURATION_LABEL[d]}</button>
        ))}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-500">Start date</span>
        <input type="date" className={fieldCls} value={startDate} min={tomorrow} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-500">Your hour (4 PM – 8 PM is kept for regular bookings)</span>
        <select className={fieldCls} value={slot} onChange={(e) => setSlot(e.target.value)} disabled={!slots}>
          <option value="">{slots ? "Choose an hour" : "Loading…"}</option>
          {(slots ?? []).map((s) => {
            const p = priceFor(s.slot);
            return <option key={s.slot} value={s.slot} disabled={!s.available || p === null}>{hourLabel(s.slot)}{!s.available ? " (taken)" : p === null ? " (not offered)" : ` · ${formatRs(p)}`}</option>;
          })}
        </select>
      </label>

      {total !== null && <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm">Total <b>{formatRs(total)}</b> for {DURATION_LABEL[duration]}, paid at the venue.</p>}
      {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}

      <button type="submit" disabled={!slot || total === null || busy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? <><Loader2 size={18} className="animate-spin" /> Please wait…</> : "Request membership"}
      </button>
    </form>
  );
}

export default function MembershipPage() {
  const session = useSession();
  const plans = plansStore.use();
  const mine = myMembershipStore.use().data ?? null;
  const registered = Boolean(session?.registered);

  return (
    <div className="space-y-5 pb-4 desk:grid desk:grid-cols-2 desk:items-start desk:gap-6 desk:space-y-0">
      <header className="desk:col-span-2">
        <h1 className="text-2xl font-semibold">Membership</h1>
        <p className="text-sm text-slate-500">Member pricing, priority booking and extra rewards.</p>
      </header>

      {!session ? (
        <div className="h-48 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />
      ) : !registered ? (
        <section className="glass rounded-3xl p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 text-amber-500"><Crown size={24} /></span>
          <h2 className="mt-3 text-lg font-semibold">Sign in to see your membership</h2>
          <p className="mt-1 text-sm text-slate-500">Use the mobile number you already play with. No new sign-up is needed.</p>
          <button type="button" onClick={openSignIn} className="glass-btn mt-4 rounded-full px-8 py-3 text-sm font-semibold text-white">Sign in</button>
          <Link href="/book" className="mt-3 block text-sm font-medium text-brand">Book a game as a guest</Link>
        </section>
      ) : mine?.current ? (
        <Current s={mine.current} />
      ) : plans.status === "error" ? (
        <p role="alert" className="glass rounded-3xl px-4 py-8 text-center text-sm text-rose-600">{plans.error}</p>
      ) : !plans.data ? (
        <div className="h-48 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />
      ) : plans.data.length === 0 ? (
        <section className="glass rounded-3xl p-6 text-center text-sm text-slate-600">
          No plans are open right now. Call or message us and we&apos;ll set up your plan.
          <span className="mt-4 grid grid-cols-2 gap-3">
            <a href={`tel:${site.phone}`} className="flex items-center justify-center gap-2 rounded-full bg-white/60 py-3 text-sm font-medium"><Phone size={16} /> Call</a>
            <a href={site.whatsapp} target="_blank" rel="noopener noreferrer" className="glass-btn flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white"><MessageCircle size={16} /> WhatsApp</a>
          </span>
        </section>
      ) : (
        <RequestForm plans={plans.data} />
      )}

      <section className="glass rounded-3xl p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Star size={18} className="text-amber-500" /> Loyalty bonus for members</h2>
        <p className="mt-2 text-sm text-slate-600">
          Buying or renewing a 3-month membership earns <b>{MEMBERSHIP_POINTS.quarterly} loyalty points</b> and a 6-month one earns <b>{MEMBERSHIP_POINTS.half} points</b>. Membership points never expire.
        </p>
      </section>
    </div>
  );
}
