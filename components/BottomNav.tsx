"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, User, Swords, Gamepad2 } from "lucide-react";

const LEFT_TABS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Opponent", href: "/opponent", icon: Swords },
];
const RIGHT_TABS = [
  { label: "Gamezone", href: "/gamezone", icon: Gamepad2 },
  { label: "Profile", href: "/profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const bookActive = isActive("/book");

  const sideTab = ({ label, href, icon: Icon }: (typeof LEFT_TABS)[number]) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className="flex w-14 flex-col items-center gap-1"
      >
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
            active ? "glass-active text-white" : "bg-white/40 text-brand"
          }`}
        >
          <Icon size={20} strokeWidth={active ? 2.2 : 1.9} />
        </span>
        <span className={`text-[10px] font-medium ${active ? "text-brand" : "text-slate-400"}`}>{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 px-5 desk:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
    >
      <div className="glass relative mx-auto flex max-w-md items-center justify-between rounded-full px-4 py-2.5">
        {LEFT_TABS.map((t) => <span key={t.href}>{sideTab(t)}</span>)}

        {/* Spacer keeps the side tabs apart; the Book Now button floats above it */}
        <div className="w-16" aria-hidden />
        <Link
          href="/book"
          aria-label="Book Now"
          aria-current={bookActive ? "page" : undefined}
          className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/3 flex-col items-center"
        >
          {/* outer ring */}
          <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white/80 bg-white/60 shadow-[0_10px_30px_rgba(40,80,140,0.18)] backdrop-blur-xl">
            <span className="glass-btn flex h-[66px] w-[66px] items-center justify-center rounded-full text-white">
              <CalendarDays size={28} />
            </span>
          </span>
          <span className="mt-1 text-[11px] font-semibold text-accent">Book Now</span>
        </Link>

        {RIGHT_TABS.map((t) => <span key={t.href}>{sideTab(t)}</span>)}
      </div>
    </nav>
  );
}
