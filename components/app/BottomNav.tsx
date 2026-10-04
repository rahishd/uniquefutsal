"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Swords, Star, Tag, User } from "lucide-react";

const TABS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Member", href: "/membership", icon: Users },
  { label: "Opponent", href: "/opponent", icon: Swords },
  { label: "Points", href: "/points", icon: Star },
  { label: "Promos", href: "/promocode", icon: Tag },
  { label: "Profile", href: "/dashboard", icon: User },
];

const HIDDEN_PREFIXES = [
  "/uniquesuperadmin",
  "/login",
  "/signup",
  "/forgot-password",
  "/booking",
];

export default function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {/* spacer so page content is not covered by the fixed bar */}
      <div className="h-24 md:hidden" aria-hidden />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0d0d14]/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg items-end justify-around px-2 pb-2 pt-2">
          {TABS.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={label}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex w-16 flex-col items-center gap-1"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-[#c8f135] text-black" : "text-slate-400"
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                  </span>
                  <span
                    className={`font-heading text-[10px] font-bold uppercase tracking-wider ${
                      active ? "text-[#c8f135]" : "text-slate-500"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
