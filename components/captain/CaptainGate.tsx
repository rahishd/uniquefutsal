"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserRound } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { createTeam, setMode, useTeams, type MyTeam } from "@/lib/teams";

// Everything captain-only sits behind this: registered account, Captain mode on, and a team.
export default function CaptainGate({ children }: { children: (team: MyTeam) => React.ReactNode }) {
  const session = useSession();
  const state = useTeams();
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const r = await fn();
    if (!r.ok) setError(r.error ?? "Something went wrong");
    setBusy(false);
  }

  if (!session || state === undefined) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  if (!session.registered) {
    return (
      <Notice icon={<UserRound size={34} />} title="Sign in to use Captain mode" text="Captains are registered players. Sign in, then switch to your Captain profile.">
        <button type="button" onClick={openSignIn} className="glass-btn rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </Notice>
    );
  }

  if (!state || state.mode !== "captain") {
    return (
      <Notice icon={<ShieldCheck size={34} />} title="Captain mode is off" text="Only a captain can build a team and challenge opponents. Any registered player can switch to Captain mode.">
        <button type="button" disabled={busy} onClick={() => run(() => setMode("captain"))} className="glass-btn rounded-full px-8 py-3.5 text-sm font-semibold text-white disabled:opacity-60">Switch to Captain mode</button>
        {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
        <Link href="/profile" className="mt-3 text-sm font-medium text-brand">Back to profile</Link>
      </Notice>
    );
  }

  if (!state.team) {
    const ok = teamName.trim().length >= 2;
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">Create your team</h1>
          <p className="text-sm text-slate-500">Name your team to start as captain. You can add up to 11 more players.</p>
        </header>
        <form
          className="glass space-y-4 rounded-3xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) void run(() => createTeam(teamName.trim()));
          }}
        >
          <label htmlFor="team-name" className="text-sm font-medium">Team name</label>
          <input id="team-name" value={teamName} onChange={(e) => setTeamName(e.target.value.slice(0, 30))} placeholder="e.g. Tilottama Strikers" className="w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand" />
          {error && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</p>}
          <button type="submit" disabled={!ok || busy} className="glass-btn w-full rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">Create team</button>
        </form>
      </div>
    );
  }

  return <>{children(state.team)}</>;
}

function Notice({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand">{icon}</span>
      <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">{text}</p>
      <div className="mt-6 flex flex-col items-center">{children}</div>
    </div>
  );
}
