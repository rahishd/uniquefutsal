"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { MAX_ADVANCE_DAYS, OPEN_HOUR, CLOSE_HOUR, dateKey, formatHour, parseKey } from "@/lib/booking";
import { sendChallenge, type ChallengeType, type Team } from "@/lib/teams";

const field = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

// Bottom sheet where a captain challenges another team.
export default function ChallengeSheet({ target, onClose }: { target: Team; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<ChallengeType>("match");
  const [date, setDate] = useState<string | null>(null);
  const [hour, setHour] = useState(19);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Date options start from tomorrow-or-today as soon as the sheet is on screen.
  const days = Array.from({ length: MAX_ADVANCE_DAYS + 1 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return dateKey(d);
  });
  const chosenDate = date ?? days[1];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = sendChallenge({ teamId: target.id, type, date: chosenDate, hour, message });
    if (res.ok) setSent(true);
    else setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/40" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-[2rem] bg-white p-6 pb-8 outline-none"
      >
        <div className="flex items-center justify-between">
          <h2 id="challenge-title" className="text-lg font-semibold">Challenge {target.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><Check size={30} /></span>
            <p className="mt-4 font-semibold">Challenge sent</p>
            <p className="mt-1 text-sm text-slate-500">The {target.name} captain has been notified and can see your team&apos;s stats.</p>
            <button type="button" onClick={onClose} className="glass-btn mt-6 rounded-full px-10 py-3 text-sm font-semibold text-white">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div role="radiogroup" aria-label="Challenge type" className="grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1 text-sm font-medium">
              {(["match", "competition"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={`rounded-full py-2 capitalize ${type === t ? "glass-active text-white" : "text-slate-500"}`}>
                  {t === "match" ? "Friendly match" : "Competition"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ch-date" className="text-xs text-slate-500">Date</label>
                <select id="ch-date" value={chosenDate} onChange={(e) => setDate(e.target.value)} className={field}>
                  {days.map((k, i) => (
                    <option key={k} value={k}>
                      {i === 0 ? "Today" : parseKey(k).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ch-hour" className="text-xs text-slate-500">Time</label>
                <select id="ch-hour" value={hour} onChange={(e) => setHour(Number(e.target.value))} className={field}>
                  {Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i).map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="ch-msg" className="text-xs text-slate-500">Message (optional)</label>
              <textarea id="ch-msg" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 140))} rows={2} placeholder="Let's play!" className={field} />
              <p className="mt-1 text-right text-[11px] text-slate-400">{message.length}/140</p>
            </div>

            <p className="text-xs text-slate-400">The court is booked only after the other captain accepts, so two games can never take the same slot.</p>
            {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}
            <button type="submit" className="glass-btn w-full rounded-full py-3.5 text-sm font-semibold text-white">Send challenge</button>
          </form>
        )}
      </div>
    </div>
  );
}
