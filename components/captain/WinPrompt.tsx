"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { getOtherTeam, useTeams } from "@/lib/teams";

const KEY = "uf-winprompt-v1"; // { [challengeId]: true } once the captain has seen the popup

function seen(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...seen(), [id]: true }));
  } catch {
    // storage blocked: it may show again on the next page load
  }
}

// Shown to a captain once the venue has confirmed payment for their challenge game. In production
// BOTH captains get it, each on their own phone, when the admin approves the payment.
export default function WinPrompt() {
  const router = useRouter();
  const session = useSession();
  const state = useTeams();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const isCaptain = Boolean(session?.registered && state?.mode === "captain" && state.team);
  const game =
    isCaptain && state
      ? state.challenges.find(
          (c) =>
            c.status === "accepted" &&
            c.venuePaidAt &&
            !dismissed.includes(c.id) &&
            !seen()[c.id] &&
            // nothing to ask once a score is already uploaded or confirmed
            !state.results.some((r) => r.challengeId === c.id && r.status !== "disputed"),
        )
      : undefined;

  useEffect(() => {
    if (!game) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  if (!game || !state) return null;
  const opponent = getOtherTeam(state, game.teamId)?.name ?? "your opponent";

  function close() {
    if (!game) return;
    markSeen(game.id);
    setDismissed((d) => [...d, game.id]);
  }

  function update() {
    if (!game) return;
    const id = game.id;
    close();
    router.push(`/opponent?report=${id}`);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-6" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-title"
        aria-describedby="win-body"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-[0_24px_60px_rgba(12,11,93,0.35)] outline-none"
      >
        <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
          <X size={18} />
        </button>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/20 text-amber-600">
          <Trophy size={32} />
        </span>
        <h2 id="win-title" className="mt-4 text-2xl font-semibold">Did you win?</h2>
        <p id="win-body" className="mt-2 text-sm text-slate-500">
          Payment for your game against {opponent} is confirmed. Update your score in your dashboard and increase your visibility to the public.
        </p>
        <button type="button" onClick={update} className="glass-btn mt-6 w-full rounded-full py-3.5 text-sm font-semibold text-white">Update score</button>
        <button type="button" onClick={close} className="mt-3 w-full py-2 text-sm text-slate-400">Not now</button>
      </div>
    </div>
  );
}
