"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronDown, ChevronRight, Crown, Download, Loader2, LogOut, Pencil, Star, Trophy, UserRound, X } from "lucide-react";
import { downloadPdf } from "@/lib/pdf";
import { errorText } from "@/lib/api";
import { openSignIn, signOut, useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import { setPref, usePrefs } from "@/lib/prefs";
import { fmtPts } from "@/lib/points";
import { loyaltyStore, progressPct } from "@/lib/loyalty";
import { POSITIONS, paymentsStore, profileStore, saveProfile, type PaymentItem } from "@/lib/profile";
import { cancelBooking, formatHour, myBookingsStore, parseKey, startsAtMs, type Booking } from "@/lib/booking";
import { cancelGz, myGzStore, type GzBooking } from "@/lib/gamezone";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import { CaptainSummary, ModeToggle } from "@/components/captain/CaptainProfile";

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

// One row in "My bookings": a court booking or a Gamezone session.
interface Item {
  id: string;
  kind: "game" | "gamezone";
  dateKey: string;
  date: string;
  time: string;
  what: string;
  amount: number;
  payment: "Paid" | "Pay at venue" | "Payment pending" | "Free game";
  status: "Pending" | "Confirmed" | "Completed" | "Cancelled";
  upcoming: boolean;
}

const dayLabel = (key: string) => parseKey(key).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const hourOf = (t: string) => parseInt(t.split(":")[0], 10);
const range = (a: number, b: number) => `${formatHour(a)} – ${formatHour(b)}`;
const cap = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)) as Item["status"];

function courtItem(b: Booking, now: number): Item {
  const paid = b.paymentStatus === "completed";
  return {
    id: b.id,
    kind: "game",
    dateKey: b.date,
    date: dayLabel(b.date),
    time: range(hourOf(b.startTime), hourOf(b.startTime) + b.duration),
    what: "Court booking",
    amount: b.totalPrice,
    payment: paid ? (b.totalPrice === 0 ? "Free game" : "Paid") : b.paymentMethod === "venue" ? "Pay at venue" : "Payment pending",
    status: cap(b.status),
    upcoming: b.status !== "cancelled" && b.status !== "completed" && startsAtMs(b) + 3600000 > now,
  };
}

function gzItem(g: GzBooking, now: number): Item {
  const d = parseKey(g.date);
  d.setHours(g.startHour, 0, 0, 0);
  const active = g.status === "confirmed";
  return {
    id: g.code,
    kind: "gamezone",
    dateKey: g.date,
    date: dayLabel(g.date),
    time: range(g.startHour, g.startHour + g.hours),
    what: `PS5 · ${g.game}`,
    amount: g.total,
    payment: g.paymentStatus === "paid" ? "Paid" : g.paymentStatus === "pay_at_venue" ? "Pay at venue" : "Payment pending",
    status: g.status === "cancelled" || g.status === "expired" ? "Cancelled" : d.getTime() + g.hours * 3600000 < now ? "Completed" : "Confirmed",
    upcoming: active && d.getTime() + g.hours * 3600000 > now,
  };
}

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
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in to see your bookings and points, and to book without typing your details each time.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
        <Link href="/book" className="mt-4 text-sm font-medium text-brand">Continue to book as a guest</Link>
      </div>
    );
  }
  return <RegisteredProfile />;
}

function RegisteredProfile() {
  const teams = useTeams();
  const captainMode = teams?.mode === "captain";
  const profileState = profileStore.use();
  const profile = profileState.data ?? null;
  const courts = myBookingsStore.use().data;
  const sessions = myGzStore.use().data;
  const paymentsData = paymentsStore.use().data;
  const loy = loyaltyStore.use().data ?? null;
  const prefs = usePrefs();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", location: "", position: "" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [openBookings, setOpenBookings] = useState(false);
  const [openGames, setOpenGames] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const i = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);

  if (profileState.status === "error") return <p role="alert" className="glass rounded-3xl px-4 py-10 text-center text-sm text-rose-600">{profileState.error}</p>;
  if (!profile || !now) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  // Bookings: the next game and the last game played; everything else sits under the arrow.
  const items: Item[] = [...(courts ?? []).map((b) => courtItem(b, now)), ...(sessions ?? []).map((g) => gzItem(g, now))];
  const upcomingList = items.filter((b) => b.upcoming).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const pastList = items.filter((b) => !b.upcoming).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  const lastGame = pastList.find((b) => b.status === "Completed");
  const primary = [upcomingList[0], lastGame].filter((b): b is Item => Boolean(b));
  const restBookings = [...upcomingList.slice(1), ...pastList.filter((b) => b !== lastGame)];
  // Games played: completed bookings. (Win/loss and goals are only recorded for challenge games, shown on the Opponent page.)
  const played = pastList.filter((b) => b.status === "Completed");
  const payments: PaymentItem[] = paymentsData ?? [];
  const registeredSince = new Date(profile.registeredAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const pct = loy ? progressPct(loy) : 0;
  const canSave = draft.name.trim().length >= 2;

  async function cancel(it: Item) {
    setCancelError(null);
    try {
      if (it.kind === "game") await cancelBooking(it.id);
      else await cancelGz(it.id);
      setCancelId(null);
    } catch (e) {
      setCancelError(errorText(e));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile({ name: draft.name.trim(), email: draft.email.trim(), location: draft.location.trim(), position: draft.position });
      setEditing(false);
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf(kind: "bookings" | "games" | "payments") {
    setPdfBusy(kind);
    try {
      const who = `${profile!.name} · ${profile!.phone} · ID ${profile!.customerCode}`;
      if (kind === "bookings") {
        await downloadPdf({
          filename: "unique-futsal-bookings.pdf",
          title: "My bookings",
          lines: [who],
          columns: [{ header: "Date", width: 95 }, { header: "Time", width: 105 }, { header: "What", width: 90 }, { header: "Booking ID", width: 85 }, { header: "Amount", width: 55 }, { header: "Payment", width: 45 }, { header: "Status", width: 40 }],
          rows: [...upcomingList, ...pastList].map((b) => [b.date, b.time, b.what, b.id, rs(b.amount), b.payment, b.status]),
        });
      } else if (kind === "games") {
        await downloadPdf({
          filename: "unique-futsal-games.pdf",
          title: "Games played",
          lines: [who, `Played ${played.length}`],
          columns: [{ header: "Date", width: 120 }, { header: "Time", width: 130 }, { header: "What", width: 170 }, { header: "Booking ID", width: 95 }],
          rows: played.map((b) => [b.date, b.time, b.what, b.id]),
        });
      } else {
        await downloadPdf({
          filename: "unique-futsal-payments.pdf",
          title: "Payment history",
          lines: [who],
          columns: [{ header: "Date", width: 95 }, { header: "Booking ID", width: 180 }, { header: "Amount", width: 95 }, { header: "Status", width: 90 }],
          rows: payments.map((p) => [dayLabel(p.date), p.id, rs(p.amount), p.status]),
        });
      }
    } finally {
      setPdfBusy(null);
    }
  }

  function renderBooking(b: Item, tag?: string) {
    return (
      <li key={b.id} className="rounded-2xl bg-white/60 p-4 text-sm">
        {tag && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand">{tag}</p>}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{b.date}</p>
            <p className="text-slate-500">{b.time} · {b.what}</p>
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
              {cancelError && <p role="alert" className="mt-2 font-medium">{cancelError}</p>}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { setCancelId(null); setCancelError(null); }} className="flex-1 rounded-full bg-white py-2 font-medium">Keep booking</button>
                <button type="button" onClick={() => cancel(b)} className="flex-1 rounded-full bg-rose-500 py-2 font-medium text-white">Confirm cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setCancelId(b.id); setCancelError(null); }} className="mt-3 text-xs font-medium text-rose-500">Cancel booking</button>
          )
        )}
      </li>
    );
  }

  function renderGame(b: Item, tag?: string) {
    return (
      <li key={b.id} className="rounded-2xl bg-white/60 px-4 py-3">
        {tag && <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-brand">{tag}</span>}
        <span className="block font-medium">{b.date}</span>
        <span className="text-xs text-slate-500">{b.time} · {b.what}</span>
      </li>
    );
  }

  function renderPayment(p: PaymentItem) {
    return (
      <li key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
        <span><span className="block font-medium">{dayLabel(p.date)}</span><span className="font-mono text-[11px] text-slate-400">{p.id}</span></span>
        <span className="text-right"><span className="block font-medium">{rs(p.amount)}</span><span className="text-[11px] text-emerald-600">{p.status}</span></span>
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
            <p className="text-xs text-slate-400">ID {profile.customerCode} · Since {registeredSince}</p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => { setDraft({ name: profile.name, email: profile.email ?? "", location: profile.location ?? "", position: profile.position ?? "" }); setSaveError(null); setEditing(true); }}
              aria-label="Edit profile"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60 text-brand"
            >
              <Pencil size={18} />
            </button>
          )}
        </div>

        {editing && (
          <form className="mt-5 space-y-3" onSubmit={save}>
            <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Full name" aria-label="Full name" />
            <input className={`${input} opacity-60`} value={profile.phone} readOnly aria-label="Mobile number (cannot be changed here)" />
            <p className="-mt-1 text-[11px] text-slate-400">To change your mobile number, please contact the venue.</p>
            <input className={input} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" aria-label="Email" />
            <input className={input} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Location" aria-label="Location" />
            <select className={input} value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} aria-label="Preferred position">
              <option value="">Preferred position</option>
              {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {saveError && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{saveError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/70 py-3 text-sm font-medium text-slate-600"><X size={16} /> Cancel</button>
              <button type="submit" disabled={!canSave || saving} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-brand py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save</button>
            </div>
          </form>
        )}
      </section>

      <ModeToggle />
      {captainMode && <CaptainSummary />}

      {!captainMode && (<>
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[["Games", played.length], ["Upcoming", upcomingList.length], ["Points", loy ? fmtPts(loy.remaining) : "–"]].map(([k, v]) => (
          <div key={k} className="glass rounded-2xl py-4">
            <p className="text-xl font-semibold">{v}</p>
            <p className="text-[11px] text-slate-400">{k}</p>
          </div>
        ))}
      </div>

      {/* Membership */}
      <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
        <p className="flex items-center gap-2 text-sm text-white/70"><Crown size={16} /> Membership</p>
        <p className="mt-1 text-sm text-white/80">Memberships are arranged at the venue for now. Online sign-up is coming soon.</p>
        <Link href="/member" className="glass-btn mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-medium text-white">Ask about membership</Link>
      </section>

      {/* Loyalty */}
      <Card title="Loyalty points" action={<Link href="/points" className="flex items-center text-sm text-brand">View <ChevronRight size={16} /></Link>}>
        {loy ? (
          <>
            <div className="flex items-end justify-between">
              <p className="flex items-center gap-2 text-2xl font-semibold"><Star className="fill-amber-400 text-amber-400" size={22} /> {fmtPts(loy.remaining)}</p>
              <p className="text-xs text-slate-400">{loy.toNext === 0 ? "Free game unlocked" : `${fmtPts(loy.toNext)} to a free game`}</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next reward">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <div className="h-12 animate-pulse rounded-2xl bg-white/40" aria-label="Loading" />
        )}
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
            <MoreBar id="more-bookings" open={openBookings} onToggle={() => setOpenBookings((o) => !o)} label={`All bookings (${items.length})`} pdfLabel="Download bookings as PDF" onPdf={() => exportPdf("bookings")} busy={pdfBusy === "bookings"} />
            {openBookings && <ul id="more-bookings" className="mt-3 space-y-3">{restBookings.map((b) => renderBooking(b))}</ul>}
          </>
        )}
      </Card>

      {/* Games played: the most recent; earlier games are under the arrow */}
      <Card title="Games played" action={<Trophy size={18} className="text-amber-500" />}>
        {played[0] ? <ul className="text-sm">{renderGame(played[0], "Last game")}</ul> : <p className="py-6 text-center text-sm text-slate-400">No games yet.</p>}
        {played.length > 0 && (
          <>
            <MoreBar id="more-games" open={openGames} onToggle={() => setOpenGames((o) => !o)} label={played.length > 1 ? `Earlier games (${played.length - 1})` : "Total games"} pdfLabel="Download games as PDF" onPdf={() => exportPdf("games")} busy={pdfBusy === "games"} />
            {openGames && (
              <div id="more-games" className="mt-3 space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl bg-white/60 py-3"><dd className="text-lg font-semibold">{played.length}</dd><dt className="text-[11px] text-slate-400">Games played</dt></div>
                  <div className="rounded-2xl bg-white/60 py-3"><dd className="text-lg font-semibold">{upcomingList.length}</dd><dt className="text-[11px] text-slate-400">Coming up</dt></div>
                </dl>
                {played.length > 1 && <ul className="space-y-2 text-sm">{played.slice(1).map((g) => renderGame(g))}</ul>}
              </div>
            )}
          </>
        )}
        <p className="mt-3 text-[11px] text-slate-400">Team results from challenge games are on the Opponent page (Captain mode).</p>
      </Card>

      {/* Payment history: the two most recent transactions; the rest is under the arrow */}
      <Card title="Payment history">
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-white/70 text-sm">{payments.slice(0, 2).map((p) => renderPayment(p))}</ul>
        )}
        {payments.length > 2 && (
          <>
            <MoreBar id="more-payments" open={openPay} onToggle={() => setOpenPay((o) => !o)} label={`All transactions (${payments.length})`} pdfLabel="Download payment history as PDF" onPdf={() => exportPdf("payments")} busy={pdfBusy === "payments"} />
            {openPay && <ul id="more-payments" className="mt-3 divide-y divide-white/70 text-sm">{payments.slice(2).map((p) => renderPayment(p))}</ul>}
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
            <select id="lang" value={prefs.language} onChange={(e) => setPref("language", e.target.value)} className="rounded-xl bg-white/70 px-3 py-2 text-sm outline-none ring-1 ring-white/80">
              <option value="en">English</option><option value="ne">नेपाली</option>
            </select>
          </li>
        </ul>
        <button type="button" onClick={signOut} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white/70 py-3 text-sm font-medium text-rose-500"><LogOut size={16} /> Sign out</button>
      </Card>
    </div>
  );
}
