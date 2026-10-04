import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Crown,
  LayoutGrid,
  Radio,
  Search,
  SlidersHorizontal,
  Star,
  Swords,
  Tag,
  Trophy,
  BarChart3,
} from "lucide-react";
import { sampleLive, sampleUpNext } from "@/lib/sample-data";

const TILES = [
  { label: "Book", href: "/book", icon: CalendarDays, tone: "text-brand" },
  { label: "Membership", href: "/member", icon: Crown, tone: "text-amber-500" },
  { label: "Opponent", href: "/opponent", icon: Swords, tone: "text-rose-500" },
  { label: "Points", href: "/points", icon: Star, tone: "text-yellow-500" },
  { label: "Promos", href: "/promos", icon: Tag, tone: "text-emerald-500" },
  { label: "My stats", href: "/profile", icon: BarChart3, tone: "text-indigo-500" },
  { label: "Tournaments", href: "/tournaments", icon: Trophy, tone: "text-orange-500" },
  { label: "More", href: "/profile", icon: LayoutGrid, tone: "text-brand" },
];

export default function HomeScreen() {
  const userName = "Player"; // TODO: from auth once login exists
  const unread = 2; // TODO: from notifications API

  return (
    <div>
      {/* Header: user info left, notifications right */}
      <header className="flex items-center justify-between">
        <Link href="/profile" className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-brand text-lg font-semibold text-white ring-2 ring-white shadow-md">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <span className="block text-sm text-slate-400">
              Hello <span aria-hidden>👋</span>
            </span>
            <span className="block text-2xl font-medium leading-tight">{userName}</span>
          </span>
        </Link>
        <button
          type="button"
          aria-label={`Notifications, ${unread} unread`}
          className="glass relative flex h-12 w-12 items-center justify-center rounded-2xl text-slate-600"
        >
          <Bell size={22} />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
      </header>

      {/* Search */}
      <div className="mt-6 flex gap-3">
        <label className="glass flex flex-1 items-center gap-2 rounded-2xl px-4 py-3.5">
          <input
            type="search"
            placeholder="Search a slot, offer or team…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <Search size={20} className="text-slate-500" />
        </label>
        <button type="button" aria-label="Filters" className="glass flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-slate-600">
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {/* Promo banner */}
      <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-200 via-sky-100 to-blue-200 p-5 shadow-[0_10px_30px_rgba(60,120,200,0.18)]">
        <div className="relative z-10 max-w-[62%]">
          <p className="text-xs font-medium text-orange-500">Up to 25% off today</p>
          <h2 className="mt-1 text-xl font-medium leading-snug">Exclusive deals on your next game</h2>
          <Link href="/book" className="glass-btn mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white">
            <CalendarDays size={16} /> Book now
          </Link>
        </div>
        <span aria-hidden className="absolute -right-2 top-1/2 -translate-y-1/2 text-[120px] leading-none drop-shadow-lg">
          ⚽
        </span>
      </section>

      {/* Popular */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Popular</h2>
          <Link href="/profile" className="flex items-center text-sm text-brand">
            See all <ChevronRight size={16} />
          </Link>
        </div>
        <ul className="mt-4 grid grid-cols-4 gap-x-3 gap-y-5">
          {TILES.map(({ label, href, icon: Icon, tone }) => (
            <li key={label}>
              <Link href={href} className="flex flex-col items-center gap-2">
                <span className="glass flex h-[70px] w-[70px] items-center justify-center rounded-3xl">
                  <Icon size={30} className={tone} />
                </span>
                <span className="text-center text-xs text-slate-600">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Live matches */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Live matches</h2>
          <Link href="/tournaments" className="flex items-center text-sm text-brand">
            See all <ChevronRight size={16} />
          </Link>
        </div>
        <ul className="mt-4 space-y-3">
          {sampleLive.map((m) => (
            <li key={m.id} className="glass flex items-center justify-between rounded-3xl px-5 py-4">
              <div className="text-sm font-medium leading-snug">
                <p>{m.home}</p>
                <p>{m.away}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">
                  {m.homeScore} - {m.awayScore}
                </p>
                <p className="text-xs font-medium text-rose-500">{m.minute}&apos;</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-slate-400">{m.venue}</span>
                <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-500">
                  <Radio size={12} /> Live
                </span>
              </div>
            </li>
          ))}
          <li className="glass flex items-center justify-between rounded-3xl px-5 py-4 text-sm">
            <span className="text-xs font-medium text-brand">UP NEXT · {sampleUpNext.time}</span>
            <span className="font-medium">
              {sampleUpNext.home} <span className="text-brand">vs</span> {sampleUpNext.away}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
