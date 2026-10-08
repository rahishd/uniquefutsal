"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Top navigation for desktop mode (see the `desk:` variant in globals.css). On phones and portrait tablets the
// bottom bar is used instead, so this is hidden there.
const LINKS = [
  { label: "Home", href: "/" },
  { label: "Book now", href: "/book", cta: true },
  { label: "Opponent", href: "/opponent" },
  { label: "Gamezone", href: "/gamezone" },
  { label: "Membership", href: "/member" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Points", href: "/points" },
  { label: "Profile", href: "/profile" },
];

export default function DeskNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav aria-label="Main" className="ml-auto hidden items-center gap-1 desk:flex">
      {LINKS.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              l.cta
                ? "glass-btn ml-1 whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold text-white desk:max-xl:px-4 desk:max-xl:text-[13px]"
                : `whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors desk:max-xl:px-2.5 desk:max-xl:text-[13px] ${active ? "bg-white text-brand" : "text-white/80 hover:bg-white/10 hover:text-white"}`
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
