"use client";

import { useState } from "react";
import Link from "next/link";
import { usePoints } from "@/lib/points";
import { Bell, Check, ChevronDown, ChevronRight, Crown, Download, Loader2, LogOut, Pencil, Star, Trophy, UserRound, X } from "lucide-react";
import { downloadPdf } from "@/lib/pdf";
import { signInDemo, signOut, useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { setPref, usePrefs } from "@/lib/prefs";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import { CaptainSummary, ModeToggle } from "@/components/captain/CaptainProfile";
import {
  sampleBookings,
  sampleMatches,
  sampleMembership,
  sampleProfile,
  sampleStats,
  type BookingItem,
  type ProfileData,
} from "@/lib/sample-profile";

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// Dropdown arrow that reveals the older items, next to a button that downloads the full list as a PDF.
function MoreBar({ id, open, onToggle, label, pdfLabel, onPdf, busy }: { id: string; open: boolean; onToggle: () => void; label: string; pdfLabel: string; onPdf: () => void; busy: boolean }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="flex items-center gap-1.5 text-sm font-medium text-brand">
        {label} <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <button type="button" onClick={onPdf} disabled={busy} aria-label={pdfLabel} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-2 text-xs font-medium text-brand disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
      </button>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const input = "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand";

// Registered customers see their profile; guests are asked to sign in.
export default function ProfileView() {
  const session = useSession();
  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;
  if (!session.registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">You&apos;re browsing as a guest</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to see your bookings, membership and points, and to book without typing your details each time.</p>
        <button type="button" onClick={signInDemo} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in (demo)</button>
        <Link href="/book" className="mt-4 text-sm font-medium text-brand">Continue to book as a guest</Link>
      </div>
    );
  }
  return <RegisteredProfile />;
}

function RegisteredProfile() {
  const teams = useTeams();
  const captainMode = teams?.mode === "captain";
  const [profile, setProfile] = useState<ProfileData>(sampleProfile);
  const [draft, setDraft] = useState<ProfileData>(sampleProfile);
  const [editing, setEditing] = useState(false);
  const [bookings, setBookings] = useState<BookingItem[]>(sampleBookings);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [openBookings, setOpenBookings] = useState(false);
  const [openGames, setOpenGames] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const prefs = usePrefs();
  const [lang, setLang] = useState("en");

  // Bookings: show the next game and the last game played; everything else sits under the arrow.
  const upcomingList = bookings.filter((b) => b.upcoming).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const pastList = bookings.filter((b) => !b.upcoming).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const lastGame = pastList.find((b) => b.status === "Completed");
  const primary = [upcomingList[0], lastGame].filter((b): b is BookingItem => Boolean(b));
  const restBookings = [...upcomingList.slice(1), ...pastList.filter((b) => b !== lastGame)];
  const games = sampleMatches; // newest first
  const payments = pastList.concat(upcomingList).filter((b) => b.payment !== "Pay at venue").sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const s = sampleStats;
  const winRate = s.played ? ((s.wins / s.played) * 100).toFixed(1) : "0";
  const { summary: loy } = usePoints();
  const pct = loy.progressPct;
  const m = sampleMembership;
  const phoneOk = /^9\d{9}$/.test(draft.phone);
  const canSave = draft.name.trim().length >= 2 && phoneOk;

  function cancel(id: string) {
    // DEMO: the real API decides refund and fee from the cancellation policy.
    setBookings((all) => all.map((b) => (b.id === id ? { ...b, upcoming: false, status: "Cancelled" } : b)));
    setCancelId(null);
  }

  async function exportPdf(kind: "bookings" | "games" | "payments") {
    setPdfBusy(kind);
    try {
      const who = `${profile.name} · ${profile.phone} · ID ${profile.customerId}`;
      if (kind === "bookings") {
        await downloadPdf({
          filename: "unique-futsal-bookings.pdf",
          title: "My bookings",
          lines: [who],
          columns: [{ header: "Date", width: 85 }, { header: "Time", width: 100 }, { header: "Court", width: 45 }, { header: "Booking ID", width: 105 }, { header: "Amount", width: 55 }, { header: "Payment", width: 60 }, { header: "Status", width: 65 }],
          rows: [...upcomingList, ...pastList].map((b) => [b.date, b.time, b.court, b.id, rs(b.amount), b.payment, b.status]),
        });
      } else if (kind === "games") {
        await downloadPdf({
          filename: "unique-futsal-gameplay.pdf",
          title: "Gameplay stats",
          lines: [who, `Played ${s.played} · Won ${s.wins} · Lost ${s.losses} · Drawn ${s.draws} · Goals ${s.goals} · Assists ${s.assists}`],
          columns: [{ header: "Date", width: 70 }, { header: "Match", width: 215 }, { header: "Score", width: 70 }, { header: "Result", width: 160 }],
          rows: games.map((g) => [g.date, `${g.you} vs ${g.opp}`, `${g.yourScore} - ${g.oppScore}`, g.yourScore > g.oppScore ? "Win" : g.yourScore < g.oppScore ? "Loss" : "Draw"]),
        });
      } else {
        await downloadPdf({
          filename: "unique-futsal-payments.pdf",
          title: "Payment history",
          lines: [who],
          columns: [{ header: "Date", width: 100 }, { header: "Booking ID", width: 150 }, { header: "Amount", width: 100 }, { header: "Status", width: 165 }],
          rows: payments.map((b) => [b.date, b.id, rs(b.amount), b.payment]),
        });
      }
    } finally {
      setPdfBusy(null);
    }
  }

  function renderBooking(b: BookingItem, tag?: string) {
    return (
      <li key={b.id} className="rounded-2xl bg-white/60 p-4 text-sm">
        {tag && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand">{tag}</p>}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{b.date}</p>
            <p className="text-slate-500">{b.time} · {b.court}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${b.status === "Cancelled" ? "bg-rose-500/10 text-rose-500" : b.status === "Completed" ? "bg-slate-200 text-slate-500" : "bg-emerald-500/10 text-emerald-600"}`}>{b.status}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">{b.id}</span>
          <span>{rs(b.amount)} · {b.payment}</span>
        </div>
        {b.upcoming && (
          cancelId === b.id ? (
            <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-700">
              <p>Cancelling may be subject to the cancellation policy. The refund amount is confirmed by the venue.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setCancelId(null)} className="flex-1 rounded-full bg-white py-2 font-medium">Keep booking</button>
                <button type="button" onClick={() => cancel(b.id)} className="flex-1 rounded-full bg-rose-500 py-2 font-medium text-white">Confirm cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCancelId(b.id)} className="mt-3 text-xs font-medium text-rose-500">Cancel booking</button>
          )
        )}
      </li>
    );
  }

  function renderGame(g: (typeof sampleMatches)[number], tag?: string) {
    const r = g.yourScore > g.oppScore ? "WIN" : g.yourScore < g.oppScore ? "LOSS" : "DRAW";
    return (
      <li key={g.id} className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3">
        <span>
          {tag && <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-brand">{tag}</span>}
          <span className="text-xs text-slate-400">{g.date}</span><br />{g.you} vs {g.opp}
        </span>
        <span className="text-right"><b>{g.yourScore} – {g.oppScore}</b><br /><span className={`text-xs font-semibold ${r === "WIN" ? "text-emerald-600" : r === "LOSS" ? "text-rose-500" : "text-slate-400"}`}>{r}</span></span>
      </li>
    );
  }

  function renderPayment(b: BookingItem) {
    return (
      <li key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
        <span><span className="block font-medium">{b.date}</span><span className="font-mono text-[11px] text-slate-400">{b.id}</span></span>
        <span className="text-right"><span className="block font-medium">{rs(b.amount)}</span><span className={`text-[11px] ${b.payment === "Refunded" ? "text-rose-500" : "text-emerald-600"}`}>{b.payment}</span></span>
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Profile</h1>

      {/* Identity */}
      <section className="glass rounded-3xl p-5">
        <div className="flex items-center gap-4">
          <ProfileAvatar name={profile.name} captain={captainMode} size={64} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-medium">{profile.name}</p>
            <p className="text-sm text-slate-500">{profile.phone}</p>
            <p className="text-xs text-slate-400">ID {profile.customerId} · Since {profile.registered}</p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => { setDraft(profile); setEditing(true); }}
              aria-label="Edit profile"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-brand"
            >
              <Pencil size={18} />
            </button>
          )}
        </div>

        {editing && (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (canSave) { setProfile({ ...draft, name: draft.name.trim() }); setEditing(false); } }}
          >
            <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Full name" aria-label="Full name" />
            <div>
              <input className={input} value={draft.phone} inputMode="numeric" onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="Mobile number" aria-label="Mobile number" />
              {!phoneOk && <p className="mt-1 text-xs text-rose-500">Enter a 10-digit mobile number starting with 9.</p>}
            </div>
            <input className={input} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" aria-label="Email" />
            <input className={input} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Location" aria-label="Location" />
            <select className={input} value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} aria-label="Preferred position">
              {["Goalkeeper", "Defender", "Midfielder", "Forward"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600"><X size={16} /> Cancel</button>
              <button type="submit" disabled={!canSave} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-brand py-3 text-sm font-medium text-white disabled:opacity-50"><Check size={16} /> Save</button>
            </div>
          </form>
        )}
      </section>

      <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-700">
        Demo mode: sample data is shown and changes aren&apos;t saved. Sign-in and the customer API come next.
      </p>

      <ModeToggle />
      {captainMode && <CaptainSummary />}

      {!captainMode && (<>
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[["Games", s.played], ["Win rate", `${winRate}%`], ["Points", loy.remaining]].map(([k, v]) => (
          <div key={k} className="glass rounded-2xl py-4">
            <p className="text-xl font-semibold">{v}</p>
            <p className="text-[11px] text-slate-400">{k}</p>
          </div>
        ))}
      </div>

      {/* Membership */}
      <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm text-white/70"><Crown size={16} /> Membership</p>
            <p className="mt-1 text-lg font-medium">{m.plan}</p>
            <p className="text-xs text-white/60">{m.id}</p>
          </div>
          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-300">{m.status}</span>
        </div>
        <p className="mt-4 text-xs text-white/70">Valid {m.validFrom} – {m.validUntil}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {m.benefits.map((b) => <li key={b} className="rounded-full bg-white/15 px-3 py-1 text-[11px]">{b}</li>)}
        </ul>
        <Link href="/member" className="glass-btn mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white">Renew / manage</Link>
      </section>

      {/* Loyalty */}
      <Card title="Loyalty points" action={<Link href="/points" className="flex items-center text-sm text-brand">View <ChevronRight size={16} /></Link>}>
        <div className="flex items-end justify-between">
          <p className="flex items-center gap-2 text-2xl font-semibold"><Star className="fill-amber-400 text-amber-400" size={22} /> {loy.remaining}</p>
          <p className="text-xs text-slate-400">{loy.toNext} to next free game</p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next reward">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {/* Bookings: the next game and the last game; everything else is under the arrow */}
      <Card title="My bookings">
        {primary.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No bookings yet.</p>
        ) : (
          <ul className="space-y-3">{primary.map((b) => renderBooking(b, b.upcoming ? "Next game" : "Last game"))}</ul>
        )}
        {restBookings.length > 0 && (
          <>
            <MoreBar id="more-bookings" open={openBookings} onToggle={() => setOpenBookings((o) => !o)} label={`All bookings (${bookings.length})`} pdfLabel="Download bookings as PDF" onPdf={() => exportPdf("bookings")} busy={pdfBusy === "bookings"} />
            {openBookings && <ul id="more-bookings" className="mt-3 space-y-3">{restBookings.map((b) => renderBooking(b))}</ul>}
          </>
        )}
      </Card>

      {/* Gameplay: the most recent game; season totals and earlier games are under the arrow */}
      <Card title="Gameplay stats" action={<Trophy size={18} className="text-amber-500" />}>
        {games[0] ? <ul className="text-sm">{renderGame(games[0], "Last game")}</ul> : <p className="py-6 text-center text-sm text-slate-400">No games yet.</p>}
        <MoreBar id="more-games" open={openGames} onToggle={() => setOpenGames((o) => !o)} label={games.length > 1 ? "Season totals and earlier games" : "Season totals"} pdfLabel="Download gameplay stats as PDF" onPdf={() => exportPdf("games")} busy={pdfBusy === "games"} />
        {openGames && (
          <div id="more-games" className="mt-3 space-y-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[["Played", s.played], ["Wins", s.wins], ["Losses", s.losses], ["Draws", s.draws], ["Goals", s.goals], ["Assists", s.assists]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/60 py-3">
                  <dd className="text-lg font-semibold">{v}</dd>
                  <dt className="text-[11px] text-slate-400">{k}</dt>
                </div>
              ))}
            </dl>
            {games.length > 1 && <ul className="space-y-2 text-sm">{games.slice(1).map((g) => renderGame(g))}</ul>}
          </div>
        )}
      </Card>

      {/* Payment history: the two most recent transactions; the rest is under the arrow */}
      <Card title="Payment history">
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-white/70 text-sm">{payments.slice(0, 2).map((b) => renderPayment(b))}</ul>
        )}
        {payments.length > 2 && (
          <>
            <MoreBar id="more-payments" open={openPay} onToggle={() => setOpenPay((o) => !o)} label={`All transactions (${payments.length})`} pdfLabel="Download payment history as PDF" onPdf={() => exportPdf("payments")} busy={pdfBusy === "payments"} />
            {openPay && <ul id="more-payments" className="mt-3 divide-y divide-white/70 text-sm">{payments.slice(2).map((b) => renderPayment(b))}</ul>}
          </>
        )}
      </Card>

      </>)}

      {/* Settings */}
      <Card title="Settings" action={<Bell size={18} className="text-slate-400" />}>
        <ul className="space-y-4 text-sm">
          <li className="flex items-center justify-between gap-4"><span>Pop-up reminder<span className="block text-xs text-slate-400">Full-screen slider 1 hour before your game, to tell the venue &ldquo;I&apos;m coming&rdquo;</span></span><Switch checked={prefs.popup} onChange={(v) => setPref("popup", v)} label="Pop-up reminder, 1 hour before your game" /></li>
          <li className="flex items-center justify-between gap-4"><span>Booking reminders (SMS)<span className="block text-xs text-slate-400">1 hour before your game</span></span><Switch checked={prefs.reminders} onChange={(v) => setPref("reminders", v)} label="Booking reminders" /></li>
          <li className="flex items-center justify-between gap-4"><span>Promotional notifications<span className="block text-xs text-slate-400">Offers and tournaments</span></span><Switch checked={prefs.promos} onChange={(v) => setPref("promos", v)} label="Promotional notifications" /></li>
          <li className="flex items-center justify-between gap-4"><label htmlFor="lang">Language</label>
            <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-xl bg-white/70 px-3 py-2 text-sm outline-none ring-1 ring-white/80">
              <option value="en">English</option><option value="ne">नेपाली</option>
            </select>
          </li>
        </ul>
        <button type="button" onClick={signOut} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white/70 py-3 text-sm font-medium text-rose-500"><LogOut size={16} /> Sign out</button>
      </Card>
    </div>
  );
}
