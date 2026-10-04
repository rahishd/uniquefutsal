"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";

// Top-left of the home header: the signed-in customer, or "Guest".
export default function UserBadge() {
  const session = useSession();
  const name = session?.registered ? session.name : "Guest";

  return (
    <Link href="/profile" className="flex items-center gap-3">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#2a2a9c] to-brand text-lg font-semibold text-white shadow-md ring-2 ring-white">
        {session ? name.slice(0, 1).toUpperCase() : ""}
      </span>
      <span>
        <span className="block text-sm text-slate-400">
          Hello <span aria-hidden>👋</span>
        </span>
        <span className="block min-h-8 text-2xl font-medium leading-tight">{session ? name : ""}</span>
      </span>
    </Link>
  );
}
