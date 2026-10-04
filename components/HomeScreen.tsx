import Link from "next/link";
import { CalendarDays, Search, SlidersHorizontal } from "lucide-react";
import HeaderInfo from "@/components/HeaderInfo";
import NotificationBell from "@/components/NotificationBell";
import UserBadge from "@/components/UserBadge";
import QuickRebook from "@/components/QuickRebook";
import PopularGrid from "@/components/PopularGrid";
import PromoCodes from "@/components/PromoCodes";
import TournamentSection from "@/components/TournamentSection";

export default function HomeScreen() {
  return (
    <div>
      {/* Header: user info left, notifications right */}
      <header className="flex items-center justify-between">
        <UserBadge />
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

      <PopularGrid />

      <PromoCodes />
      <TournamentSection />
    </div>
  );
}
