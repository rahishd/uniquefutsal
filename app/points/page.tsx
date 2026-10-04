import { Star } from "lucide-react";
import Link from "next/link";

// Placeholder: loyalty balance/rewards need new backend endpoints (FRD-001 sections 19-21).
export default function PointsPage() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center bg-[#0b0b10] px-6 text-center text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#c8f135]/15 text-[#c8f135]">
        <Star size={30} />
      </span>
      <h1 className="font-heading mt-5 text-3xl font-bold">Loyalty Points</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-400">
        Your points, rewards and history. Coming soon. Your current loyalty progress is on your dashboard.
      </p>
      <Link href="/dashboard" className="mt-6 rounded-full bg-[#c8f135] px-6 py-3 font-heading text-sm font-bold text-black">
        Open Dashboard
      </Link>
    </main>
  );
}
