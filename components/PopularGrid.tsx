"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, ChevronRight, Crown, LayoutGrid, Star, Swords, Tag, Trophy } from "lucide-react";
import { getServerSnapshot, getSnapshot, markReadByTypes, subscribe, type NoticeType } from "@/lib/notifications";
import { useSession } from "@/lib/session";
import { pendingActions, useTeams } from "@/lib/teams";

interface Tile {
  label: string;
  href: string;
  icon: typeof Star;
  tone: string;
  // Unread messages of these types show as the tile's badge. Opening the tile marks them read.
  types?: NoticeType[];
  // The Opponent tile is action based: it counts challenges and results waiting for the captain.
  actions?: boolean;
}

const TILES: Tile[] = [
  { label: "Book", href: "/book", icon: CalendarDays, tone: "text-brand", types: ["booking", "reminder", "payment"] },
  { label: "Membership", href: "/member", icon: Crown, tone: "text-amber-500", types: ["membership"] },
  { label: "Opponent", href: "/opponent", icon: Swords, tone: "text-rose-500", actions: true },
  { label: "Points", href: "/points", icon: Star, tone: "text-yellow-500", types: ["points"] },
  { label: "Promos", href: "/promos", icon: Tag, tone: "text-emerald-500", types: ["promo"] },
  { label: "My stats", href: "/profile", icon: BarChart3, tone: "text-indigo-500" },
  { label: "Tournaments", href: "/tournaments", icon: Trophy, tone: "text-orange-500", types: ["tournament"] },
  { label: "More", href: "/profile", icon: LayoutGrid, tone: "text-brand" },
];

export default function PopularGrid() {
  const notices = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const teams = useTeams();
  const session = useSession();

  function countFor(t: Tile) {
    if (t.actions) {
      // challenges to answer and results to approve; only a registered captain has these
      return session?.registered && teams?.mode === "captain" ? pendingActions(teams) : 0;
    }
    if (!t.types) return 0;
    return notices.filter((n) => !n.read && t.types!.includes(n.type)).length;
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Popular</h2>
        <Link href="/profile" className="flex items-center text-sm text-brand">
          See all <ChevronRight size={16} />
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-4 gap-x-3 gap-y-5">
        {TILES.map((t) => {
          const count = countFor(t);
          const Icon = t.icon;
          return (
            <li key={t.label}>
              <Link
                href={t.href}
                onClick={() => t.types && markReadByTypes(t.types)}
                aria-label={count > 0 ? `${t.label}, ${count} new` : t.label}
                className="flex flex-col items-center gap-2"
              >
                <span className="glass relative flex h-[70px] w-[70px] items-center justify-center rounded-3xl">
                  <Icon size={30} className={t.tone} />
                  {count > 0 && (
                    <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white shadow ring-2 ring-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </span>
                <span className="text-center text-xs text-slate-600">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
