"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Swords, User } from "lucide-react";

const TABS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Book", href: "/book", icon: CalendarDays },
  { label: "Challenges", href: "/opponent", icon: Swords },
  { label: "Profile", href: "/profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 px-5"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
    >
      <ul className="glass mx-auto flex max-w-sm items-center justify-between rounded-full px-4 py-3">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
                  active ? "glass-active text-white" : "bg-white/40 text-brand"
                }`}
              >
                <Icon size={24} strokeWidth={active ? 2.2 : 1.9} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
