"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CalendarDays, CircleHelp, Search, SlidersHorizontal, Swords, Tag, X } from "lucide-react";
import { MAX_ADVANCE_DAYS, dateKey, formatHour, parseKey } from "@/lib/booking";
import { helpTopics } from "@/lib/help";
import { promosStore } from "@/lib/promos";
import { rankingStore } from "@/lib/teams";

type Kind = "slots" | "offers" | "teams" | "pages" | "help";
type Hit = { key: string; kind: Kind; title: string; sub?: string; href: string };

const KINDS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "slots", label: "Slots" }, { id: "offers", label: "Offers" }, { id: "teams", label: "Teams" }, { id: "pages", label: "Pages" }, { id: "help", label: "Help" },
];
const ICON: Record<Kind, typeof Search> = { slots: CalendarDays, offers: Tag, teams: Swords, pages: Search, help: CircleHelp };

// Pages a customer may look for, with the words they might type
const PAGES: { title: string; href: string; words: string }[] = [
  { title: "Book a slot", href: "/book", words: "book booking slot game court play reserve" },
  { title: "Membership", href: "/member", words: "membership member plan monthly renew" },
  { title: "Opponent and teams", href: "/opponent", words: "opponent challenge team captain ranking" },
  { title: "Loyalty points", href: "/points", words: "points loyalty reward free game voucher" },
  { title: "Promos", href: "/promos", words: "promo offer discount code deal" },
  { title: "My stats and bookings", href: "/profile", words: "profile stats history payment bookings account" },
  { title: "Tournaments", href: "/tournaments", words: "tournament cup competition" },
  { title: "Gamezone (PS5)", href: "/gamezone", words: "gamezone ps5 playstation console fifa gta" },
  { title: "Complaints", href: "/complaints", words: "complaint problem issue feedback" },
  { title: "Children's Academy", href: "/academy", words: "academy children kids class coaching" },
  { title: "Refer and Earn", href: "/refer", words: "refer earn friend referral" },
  { title: "Help", href: "/help", words: "help support faq contact" },
];

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Reads "tomorrow 7pm", "friday evening", "19:00", "today": returns a date and/or an hour for the booking page.
function readSlot(q: string): { date?: string; hour?: number; text: string } | null {
  const s = q.toLowerCase();
  const today = new Date();
  let date: Date | undefined;
  let text = "";
  if (/\btoday\b/.test(s)) { date = today; text = "Today"; }
  else if (/\btomorrow\b|\btmrw\b/.test(s)) { date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1); text = "Tomorrow"; }
  else {
    const d = DAYS.findIndex((n) => new RegExp(`\\b${n.slice(0, 3)}[a-z]*\\b`).test(s));
    if (d >= 0) {
      const ahead = (d - today.getDay() + 7) % 7;
      date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
      text = ahead === 0 ? "Today" : DAYS[d][0].toUpperCase() + DAYS[d].slice(1);
    }
  }
  let hour: number | undefined;
  const t = s.match(/\b(\d{1,2})(?::00)?\s*(am|pm)\b/) ?? s.match(/\b([01]?\d|2[0-3]):00\b/);
  if (t) {
    let h = Number(t[1]);
    if (t[2] === "pm" && h < 12) h += 12;
    if (t[2] === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23) hour = h;
  } else if (/\bmorning\b/.test(s)) hour = 7;
  else if (/\bevening\b|\bnight\b/.test(s)) hour = 20;
  else if (/\bafternoon\b|\bday\b/.test(s)) hour = 13;
  if (!date && hour === undefined) return null;
  if (date && (date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000 > MAX_ADVANCE_DAYS) return null;
  return { date: date ? dateKey(date) : undefined, hour, text };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
const matches = (q: string, ...fields: (string | undefined)[]) => {
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hay = norm(fields.filter(Boolean).join(" "));
  return words.length > 0 && words.every((w) => hay.includes(w));
};

// The Home search box: finds a slot (type a day and time), an offer or promo code, a team, a page or a help topic. The filter button narrows the kind.
export default function HomeSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [filters, setFilters] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const promos = promosStore.use().data;
  const teams = rankingStore.use().data;

  const hits = useMemo<Hit[]>(() => {
    const query = q.trim();
    if (!query) return [];
    const out: Hit[] = [];
    const slot = readSlot(query);
    if (slot) {
      const params = new URLSearchParams();
      if (slot.date) params.set("date", slot.date);
      if (slot.date && slot.hour !== undefined) params.set("hour", String(slot.hour));
      const when = [slot.text || (slot.date ? parseKey(slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : ""), slot.hour !== undefined ? formatHour(slot.hour) : ""].filter(Boolean).join(", ");
      out.push({ key: "slot", kind: "slots", title: `Book ${when}`, sub: slot.date ? "Open this day in the booking page" : "Open the booking page and pick a date", href: `/book${params.size ? `?${params}` : ""}` });
    }
    for (const p of promos ?? []) if (p.status === "active" && matches(query, p.code, p.title, p.description, p.discount)) out.push({ key: `promo-${p.code}`, kind: "offers", title: `${p.code}: ${p.discount}`, sub: p.title, href: "/promos" });
    for (const t of teams ?? []) if (matches(query, t.name, t.area)) out.push({ key: `team-${t.id}`, kind: "teams", title: t.name, sub: `${t.area}${t.rank ? ` · rank ${t.rank}` : ""} · ${t.players} players`, href: `/opponent/team/${t.id}` });
    for (const p of PAGES) if (matches(query, p.title, p.words)) out.push({ key: `page-${p.href}`, kind: "pages", title: p.title, href: p.href });
    for (const h of helpTopics) if (matches(query, h.title, h.summary, h.points.join(" "))) out.push({ key: `help-${h.id}`, kind: "help", title: h.title, sub: h.summary, href: `/help#help-${h.id}` });
    return out;
  }, [q, promos, teams]);

  const shown = hits.filter((h) => kind === "all" || h.kind === kind).slice(0, 6);
  const counts = (k: Kind | "all") => (k === "all" ? hits.length : hits.filter((h) => h.kind === k).length);
  const showPanel = open && (filters || q.trim().length > 0);

  return (
    <div ref={box} className="relative mt-4" onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setTimeout(() => setOpen(false), 100); }}>
      <div className="flex gap-3">
        <label className="glass flex flex-1 items-center gap-2 rounded-2xl px-4 py-3.5">
          <input
            type="search" value={q} placeholder="Search a slot, offer or team…" aria-label="Search" autoComplete="off" enterKeyHint="search"
            onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); } }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="text-slate-500"><X size={20} /></button> : <Search size={20} className="text-slate-500" />}
        </label>
        <button type="button" aria-label="Filters" aria-pressed={filters} onClick={() => { setFilters((f) => !f); setOpen(true); }}
          className={`glass flex h-[52px] w-[52px] items-center justify-center rounded-2xl ${filters || kind !== "all" ? "text-brand" : "text-slate-600"}`}>
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          {filters && (
            <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Search filters">
              {KINDS.map((k) => (
                <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${kind === k.id ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>
                  {k.label}{q.trim() ? ` (${counts(k.id)})` : ""}
                </button>
              ))}
            </div>
          )}
          {q.trim() === "" ? (
            <p className="px-1 py-2 text-xs text-slate-500">Type a day and time (like &quot;tomorrow 7pm&quot;), a promo code, a team name or a feature.</p>
          ) : shown.length === 0 ? (
            <p className="px-1 py-3 text-sm text-slate-500">Nothing found for &quot;{q.trim()}&quot;. Try &quot;tomorrow 7pm&quot;, &quot;points&quot; or a team name.</p>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((h) => {
                const Icon = ICON[h.kind];
                return (
                  <li key={h.key}>
                    <Link href={h.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-100">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-brand"><Icon size={18} /></span>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{h.title}</span>{h.sub && <span className="block truncate text-xs text-slate-500">{h.sub}</span>}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
