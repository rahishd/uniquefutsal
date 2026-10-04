import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Crown,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Star,
  Swords,
  Tag,
  Trophy,
  BarChart3,
} from "lucide-react";
import HeaderInfo from "@/components/HeaderInfo";
import NotificationBell from "@/components/NotificationBell";
import QuickRebook from "@/components/QuickRebook";
import PromoCodes from "@/components/PromoCodes";
import TournamentSection from "@/components/TournamentSection";

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

  return (
    <div>
      {/* Header: user info left, notifications right */}
      <header className="flex items-center justify-between">
        <Link href="/profile" className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#2a2a9c] to-brand text-lg font-semibold text-white ring-2 ring-white shadow-md">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <span className="block text-sm text-slate-400">
              Hello <span aria-hidden>👋</span>
            </span>
            <span className="block text-2xl font-medium leading-tight">{userName}</span>
          </span>
        </Link>
        <NotificationBell />
      </header>

      <HeaderInfo />

      {/* Search */}
      <div className="mt-4 flex gap-3">
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

      <QuickRebook />

      {/* Promo banner */}
      <section className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
        <div className="relative z-10 max-w-[62%]">
          <p className="text-xs font-medium text-orange-300">Up to 25% off today</p>
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

      <PromoCodes />
      <TournamentSection />
    </div>
  );
}
