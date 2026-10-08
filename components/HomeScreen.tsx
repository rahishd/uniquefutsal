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

// Phone and portrait tablet: one column, in the `order-N` order below.
// Desktop mode (`desk:`, see globals.css): main content on the left, a sticky sidebar on the right (date and
// weather, search, book again, ad, promo codes, tournament). The two wrappers are `display: contents` on mobile so every block stays in
// the one column; each block carries its own mobile order.
export default function HomeScreen() {
  return (
    <div className="flex flex-col desk:grid desk:grid-cols-12 desk:items-start desk:gap-x-10">
      <div className="contents desk:col-span-8 desk:block">
        {/* Header: user info left, notifications right */}
        <header className="order-1 flex items-center justify-between">
          <UserBadge />
          <NotificationBell />
        </header>

        {/* Promo banner */}
        <section className="relative order-5 mt-5 min-h-[230px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-5 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)] desk:mt-6 desk:min-h-[300px] desk:p-10">
          <div className="relative z-10 max-w-[56%] desk:max-w-[52%]">
            <p className="text-xs font-medium text-orange-300 desk:text-sm">Up to 25% off today</p>
            <h2 className="mt-1 text-xl font-medium leading-snug desk:mt-2 desk:text-4xl desk:leading-tight">Exclusive deals on your next game</h2>
            <Link href="/book" className="glass-btn mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white desk:mt-7 desk:px-7 desk:py-3.5 desk:text-base">
              <CalendarDays size={16} /> Book now
            </Link>
          </div>
          <KidSkills className="pointer-events-none absolute bottom-0 right-0 h-[230px] w-auto desk:right-10 desk:h-[300px]" />
        </section>

        <div className="order-[7]"><PopularGrid /></div>
        <div className="order-[11]"><GallerySection /></div>
      </div>

      <aside className="contents desk:sticky desk:top-28 desk:col-span-4 desk:flex desk:flex-col desk:gap-5">
        <div className="order-2 desk:[&>*]:mt-0"><HeaderInfo /></div>
        <div className="order-3 desk:[&>*]:mt-0"><HomeSearch /></div>
        <div className="order-4 empty:hidden desk:[&>*]:mt-0"><QuickRebook /></div>
        <div className="order-[8] mt-5 empty:hidden desk:mt-0"><AdStrip placement="inline" /></div>
        <div className="order-[9] empty:hidden desk:[&>*]:mt-0"><PromoCodes /></div>
        <div className="order-[10] empty:hidden desk:[&>*]:mt-0"><TournamentSection /></div>
      </aside>

      <div className="order-[12]"><WhatsAppChat /></div>
    </div>
  );
}
