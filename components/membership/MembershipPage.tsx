"use client";

import { Crown, MessageCircle, Phone, Star } from "lucide-react";
import { MEMBERSHIP_POINTS } from "@/lib/points";
import { site } from "@/lib/site";

// Online membership purchase is not built yet (the owner has not chosen the plan design). Until then the venue
// arranges memberships, so this page says so clearly instead of showing plans that cannot be bought.
export default function MembershipPage() {
  return (
    <div className="space-y-5 pb-4">
      <header>
        <h1 className="text-2xl font-semibold">Membership</h1>
        <p className="text-sm text-slate-500">Member pricing, priority booking and extra rewards.</p>
      </header>

      <section className="rounded-3xl bg-gradient-to-br from-[#0c0b5d] via-[#16167f] to-[#2a2aa8] p-6 text-white shadow-[0_10px_30px_rgba(12,11,93,0.35)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-amber-300"><Crown size={24} /></span>
        <h2 className="mt-4 text-xl font-semibold">Online sign-up is coming soon</h2>
        <p className="mt-2 text-sm text-white/75">
          For now, memberships are arranged at the venue. Call or message us and we&apos;ll set up your plan.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <a href={`tel:${site.phone}`} className="flex items-center justify-center gap-2 rounded-full bg-white/15 py-3 text-sm font-medium"><Phone size={16} /> Call</a>
          <a href={site.whatsapp} target="_blank" rel="noopener noreferrer" className="glass-btn flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white"><MessageCircle size={16} /> WhatsApp</a>
        </div>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Star size={18} className="text-amber-500" /> Loyalty bonus for members</h2>
        <p className="mt-2 text-sm text-slate-600">
          Buying or renewing a 3-month membership earns <b>{MEMBERSHIP_POINTS.quarterly} loyalty points</b> and a 6-month one earns <b>{MEMBERSHIP_POINTS.half} points</b>. Membership points never expire.
        </p>
      </section>
    </div>
  );
}
