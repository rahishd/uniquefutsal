"use client";

import Link from "next/link";
import ProfileAvatar from "@/components/captain/ProfileAvatar";
import { useSession } from "@/lib/session";
import { useTeams } from "@/lib/teams";
import DigitalIdButton from "@/components/digitalid/DigitalIdButton";

// Top-left of the home header: the signed-in customer (with the (C) badge in Captain mode), or "Guest".
export default function UserBadge() {
  const session = useSession();
  const teams = useTeams();
  const name = session?.registered ? session.name : "Guest";
  const captain = Boolean(session?.registered && teams?.mode === "captain");

  return (
    <div className="flex min-w-0 items-center gap-3">
    <Link href="/profile" className="flex items-center gap-3">
      {session ? <ProfileAvatar name={name} captain={captain} size={56} /> : <span className="h-14 w-14 rounded-full bg-white/60" />}
      <span>
        <span className="block text-sm text-slate-400">
          {captain ? "Captain" : "Hello"} <span aria-hidden>👋</span>
        </span>
        <span className="block min-h-8 text-2xl font-medium leading-tight">{session ? name : ""}</span>
      </span>
    </Link>
    <DigitalIdButton />
    </div>
  );
}
