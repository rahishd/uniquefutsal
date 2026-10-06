"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, GraduationCap, Loader2, UserRound } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { errorText } from "@/lib/api";
import { markReadByTypes } from "@/lib/notifications";
import { STATUS_TEXT, cancelEnrollment, clock, dayLabel, enroll, loadInfo, loadMine, type AcademyInfo, type Enrollment } from "@/lib/academy";

const input = "mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand";

const EMPTY = { guardianName: "", guardianPhone: "", emergencyPhone: "", address: "", childName: "", childAge: "", healthStatus: "healthy" as "healthy" | "condition", healthNotes: "", sessionId: "", accept: false };

export default function AcademyPage() {
  const session = useSession();
  const registered = session?.registered === true;
  const [info, setInfo] = useState<AcademyInfo | null>(null);
  const [mine, setMine] = useState<Enrollment[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Enrollment | null>(null);
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const loadAll = useCallback(() => loadInfo().then((i) => { setInfo(i); setLoadErr(false); }).catch(() => setLoadErr(true)), []);
  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!registered) return;
    loadMine().then(setMine).catch(() => setMine([]));
    markReadByTypes(["academy"]); // opening this page clears the academy badge
  }, [registered]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!info) return;
    setError(null);
    if (!f.sessionId) return setError("Choose a class time.");
    if (!f.accept) return setError("Please accept the Terms and Conditions.");
    setBusy(true);
    try {
      const e = await enroll({ ...f, childAge: Number(f.childAge), acceptTerms: f.accept, termsVersion: info.terms.version });
      setDone(e);
      setF((p) => ({ ...p, childName: "", childAge: "", healthStatus: "healthy", healthNotes: "", sessionId: "", accept: false }));
      loadMine().then(setMine).catch(() => {});
      loadAll();
    } catch (e) {
      setError(errorText(e));
      loadAll(); // seats or terms may have changed
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this class for your child?")) return;
    try {
      await cancelEnrollment(id);
      loadMine().then(setMine).catch(() => {});
      loadAll();
    } catch (e) {
      setError(errorText(e));
    }
  }

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  if (!registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Children&apos;s Academy</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in as the guardian to book a class for your child (ages 10 to 14).</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={38} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Class confirmed</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">
          {done.childName} is booked for {dayLabel(done.session.date)}, {clock(done.session.startTime)} to {clock(done.session.endTime)}. Your code is <strong className="font-mono text-slate-700">{done.code}</strong>.
        </p>
        <button type="button" onClick={() => setDone(null)} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Done</button>
      </div>
    );
  }

  const open = info?.sessions ?? [];
  return (
    <div className="space-y-6 pb-4">
      <header>
        <h1 className="text-2xl font-semibold">Children&apos;s Academy</h1>
        <p className="text-sm text-slate-500">Football classes for children aged {info?.minAge ?? 10} to {info?.maxAge ?? 14}. Guardians confirm the class here.</p>
      </header>

      <form onSubmit={submit} className="glass space-y-6 rounded-3xl p-5" aria-label="Enrol a child">
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold">1. Guardian</legend>
          <label className="block text-sm font-medium">Guardian name
            <input value={f.guardianName} onChange={(e) => set("guardianName", e.target.value)} maxLength={60} autoComplete="name" className={input} />
          </label>
          <label className="block text-sm font-medium">Guardian contact number
            <input value={f.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="98XXXXXXXX" autoComplete="tel" className={input} />
          </label>
          <label className="block text-sm font-medium">Emergency contact number
            <input value={f.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="A different person we can call" className={input} />
          </label>
          <label className="block text-sm font-medium">Address
            <input value={f.address} onChange={(e) => set("address", e.target.value)} maxLength={200} autoComplete="street-address" className={input} />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-base font-semibold">2. Child</legend>
          <label className="block text-sm font-medium">Child&apos;s name
            <input value={f.childName} onChange={(e) => set("childName", e.target.value)} maxLength={60} className={input} />
          </label>
          <label className="block text-sm font-medium">Age ({info?.minAge ?? 10} to {info?.maxAge ?? 14})
            <input value={f.childAge} onChange={(e) => set("childAge", e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" className={input} />
          </label>
          <div>
            <p className="text-sm font-medium">Health status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {([["healthy", "Healthy"], ["condition", "Has a condition or allergy"]] as const).map(([v, l]) => (
                <button type="button" key={v} aria-pressed={f.healthStatus === v} onClick={() => set("healthStatus", v)}
                  className={`rounded-full px-4 py-2 text-sm ${f.healthStatus === v ? "bg-brand font-semibold text-white" : "bg-white/60 text-slate-600"}`}>{l}</button>
              ))}
            </div>
            {f.healthStatus === "condition" && (
              <textarea value={f.healthNotes} onChange={(e) => set("healthNotes", e.target.value)} rows={3} maxLength={500} placeholder="Tell us about it, for example asthma, an allergy, an old injury." className={input} aria-label="Health details" />
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-base font-semibold">3. Class time</legend>
          {!info && !loadErr && <div className="h-20 animate-pulse rounded-2xl bg-white/40" aria-label="Loading" />}
          {loadErr && <p className="text-sm text-rose-600">Could not load the classes. Check your connection and try again.</p>}
          {info && open.length === 0 && <p className="rounded-2xl bg-white/60 px-4 py-4 text-sm text-slate-500">No classes are open right now. The venue adds new times regularly, so please check back soon.</p>}
          <div className="space-y-2">
            {open.map((c) => {
              const full = c.seatsLeft === 0;
              const on = f.sessionId === c.id;
              return (
                <button type="button" key={c.id} disabled={full} aria-pressed={on} onClick={() => set("sessionId", c.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm disabled:opacity-50 ${on ? "bg-brand text-white" : "bg-white/60"}`}>
                  <span>
                    <span className="block font-semibold">{dayLabel(c.date)}, {clock(c.startTime)} to {clock(c.endTime)}</span>
                    <span className={`block text-xs ${on ? "text-white/80" : "text-slate-500"}`}>{c.title}{c.coach ? ` · Coach ${c.coach}` : ""}</span>
                  </span>
                  <span className={`text-xs font-medium ${on ? "text-white" : full ? "text-rose-600" : "text-emerald-600"}`}>{full ? "Full" : `${c.seatsLeft} left`}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-base font-semibold">4. Terms and Conditions</legend>
          <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-600" tabIndex={0} aria-label="Terms and Conditions">{info?.terms.text ?? "Loading…"}</div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={f.accept} onChange={(e) => set("accept", e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand" />
            <span>I am the child&apos;s guardian and I accept these Terms and Conditions.</span>
          </label>
        </fieldset>

        {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={busy || !info} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Confirming…</> : "Confirm class"}
        </button>
      </form>

      <section aria-label="My enrolments" className="space-y-3">
        <h2 className="text-lg font-medium">My children&apos;s classes</h2>
        {mine === null && <div className="h-20 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />}
        {mine?.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-8 text-center text-sm text-slate-500">
            <GraduationCap size={28} className="text-slate-400" /> No classes booked yet.
          </div>
        )}
        <ul className="space-y-3">
          {mine?.map((e) => {
            const st = STATUS_TEXT[e.status];
            return (
              <li key={e.id} className="glass space-y-1 rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{e.childName} <span className="font-normal text-slate-500">(age {e.childAge})</span></p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>
                </div>
                <p className="text-sm text-slate-600">{dayLabel(e.session.date)}, {clock(e.session.startTime)} to {clock(e.session.endTime)}</p>
                <p className="text-xs text-slate-400"><span className="font-mono">{e.code}</span>{e.session.status === "cancelled" ? " · class cancelled by the venue" : ""}</p>
                {e.canCancel && <button type="button" onClick={() => cancel(e.id)} className="mt-1 text-sm font-medium text-rose-600">Cancel this class</button>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
