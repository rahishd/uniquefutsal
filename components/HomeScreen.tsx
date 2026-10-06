import Link from "next/link";
import { CalendarDays } from "lucide-react";
import HeaderInfo from "@/components/HeaderInfo";
import HomeSearch from "@/components/HomeSearch";
import NotificationBell from "@/components/NotificationBell";
import UserBadge from "@/components/UserBadge";
import QuickRebook from "@/components/QuickRebook";
import PopularGrid from "@/components/PopularGrid";
import PromoCodes from "@/components/PromoCodes";
import TournamentSection from "@/components/TournamentSection";
import KidSkills from "@/components/KidSkills";
import WhatsAppChat from "@/components/WhatsAppChat";
import AdStrip from "@/components/ads/AdStrip";
import GallerySection from "@/components/ads/GallerySection";

export default function HomeScreen() {
  return (
    <div>
      {/* Header: user info left, notifications right */}
      <header className="flex items-center justify-between">
        <UserBadge />
        <NotificationBell />
      </header>

      <HeaderInfo />

      <HomeSearch />

      <QuickRebook />

      {/* Promo banner */}
      <section className="relative mt-5 overflow-hidden min-h-[230px] rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
        <div className="relative z-10 max-w-[56%]">
          <p className="text-xs font-medium text-orange-300">Up to 25% off today</p>
          <h2 className="mt-1 text-xl font-medium leading-snug">Exclusive deals on your next game</h2>
          <Link href="/book" className="glass-btn mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white">
            <CalendarDays size={16} /> Book now
          </Link>
        </div>
        <KidSkills className="pointer-events-none absolute bottom-0 right-0 h-[230px] w-auto" />
      </section>

      <PopularGrid />

      <div className="mt-5 empty:hidden"><AdStrip placement="inline" /></div>

      <PromoCodes />
      <TournamentSection />
      <GallerySection />
      <WhatsAppChat />
    </div>
  );
}
