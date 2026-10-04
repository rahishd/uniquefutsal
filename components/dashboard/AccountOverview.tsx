"use client";

import { Calendar, Clock, TrendingUp, TrendingDown, Minus, Gift } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { type Booking } from "@/lib/api/bookings";

interface Props {
  bookings: Booking[];
  freeMatches?: number;
}

function computeStats(bookings: Booking[]) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth(); // 0-indexed

  const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;

  // Filter only non-cancelled and non-membership bookings for totals
  const active = bookings.filter((b) => 
    b.status !== "cancelled" && 
    !b.notes?.includes("MEMBERSHIP_PAYMENT") && 
    b.paymentMethod !== "membership"
  );

  const thisMonthBookings = active.filter((b) => {
    const d = new Date(b.date);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  });

  const lastMonthBookings = active.filter((b) => {
    const d = new Date(b.date);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });

  // 1hr booking = 1 match, 3hr booking = 3 matches (sum duration, not count records)
  const totalBookings = active.reduce((s, b) => s + (b.duration || 1), 0);
  const totalHours = active.reduce((s, b) => s + (b.duration || 0), 0);

  const thisMonthCount = thisMonthBookings.reduce((s, b) => s + (b.duration || 1), 0);
  const lastMonthCount = lastMonthBookings.reduce((s, b) => s + (b.duration || 1), 0);

  const thisMonthHours = thisMonthBookings.reduce((s, b) => s + (b.duration || 0), 0);
  const lastMonthHours = lastMonthBookings.reduce((s, b) => s + (b.duration || 0), 0);

  const bookingDiff = thisMonthCount - lastMonthCount;
  const hoursDiff = thisMonthHours - lastMonthHours;

  return {
    totalBookings,
    totalHours,
    thisMonthCount,
    lastMonthCount,
    thisMonthHours,
    lastMonthHours,
    bookingDiff,
    hoursDiff,
  };
}

function TrendBadge({ diff, suffix = "" }: { diff: number; suffix?: string }) {
  if (diff === 0) {
    return (
      <div className="flex items-center gap-1 mt-3 text-xs font-bold text-slate-400">
        <Minus size={12} />
        <span>Same as last month</span>
      </div>
    );
  }
  const positive = diff > 0;
  return (
    <div
      className={`flex items-center gap-1 mt-3 text-xs font-bold ${
        positive ? "text-green-600" : "text-red-500"
      }`}
    >
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span>
        {positive ? "+" : ""}
        {diff}
        {suffix} this month
      </span>
    </div>
  );
}

export default function AccountOverview({ bookings, freeMatches = 0 }: Props) {
  const router = useRouter();
  const stats = computeStats(bookings);

  // Loyalty Calculation: 10 matches in 5 months
  const now = new Date();
  const completedLoyalBookings = [...bookings]
    .filter(b => {
      const matchStart = new Date(`${b.date}T${b.startTime || '00:00'}:00`);
      const matchEnd = new Date(matchStart.getTime() + (b.duration || 1) * 60 * 60 * 1000);
      return (b.status === "completed" || (b.status === "confirmed" && matchEnd < now)) &&
        !b.notes?.includes("MEMBERSHIP_PAYMENT") &&
        b.paymentMethod !== "membership" &&
        b.loyaltyEnabled;
    })
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  let totalLoyaltyPoints = 0;
  let oldestDateFor10: Date | null = null;
  let newestDateFor10: Date | null = null;
  let pointsSoFar = 0;
  let freeMatchesRedeemed = 0;

  for (const b of completedLoyalBookings) {
    if (b.notes?.includes("FREE_MATCH")) {
      freeMatchesRedeemed++;
    }
    if (pointsSoFar === 0) newestDateFor10 = new Date(b.date);
    pointsSoFar += (b.duration || 1);
    if (pointsSoFar >= 10 && !oldestDateFor10) {
      oldestDateFor10 = new Date(b.date);
    }
    totalLoyaltyPoints += (b.duration || 1);
  }

  let effectivePoints = Math.max(0, totalLoyaltyPoints - (freeMatchesRedeemed * 10));

  let loyaltyCount = 0;
  let isEligible = false;

  // If admin has granted a free match, counter resets to 0
  if (freeMatches > 0) {
    loyaltyCount = 0;
    isEligible = false;
  } else if (effectivePoints >= 10 && oldestDateFor10 && newestDateFor10) {
     const diffMs = newestDateFor10.getTime() - oldestDateFor10.getTime();
     const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); 
     if (diffMonths <= 5) isEligible = true;
     loyaltyCount = isEligible ? 10 : (effectivePoints % 10);
  } else {
     loyaltyCount = effectivePoints;
  }

  const cards = [
    {
      label: "Total Bookings",
      value: stats.totalBookings.toString(),
      icon: <Calendar className="text-blue-500" />,
      diff: stats.bookingDiff,
      suffix: "",
    },
    {
      label: "Hours Played",
      value: `${stats.totalHours}h`,
      icon: <Clock className="text-orange-500" />,
      diff: stats.hoursDiff,
      suffix: "h",
    },
  ];

  return (
    <div className="flex-1 flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Account Overview</h2>
        <p className="text-slate-500 font-medium">
          Welcome back! Here&apos;s what&apos;s happening with your account.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-xl group-hover:scale-110 transition-transform">
                {stat.icon}
              </div>
              <div className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {bookings.length > 0 ? "Active" : "No Data"}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-sm font-medium">{stat.label}</span>
              <span className="text-3xl font-black text-slate-900 mt-1">{stat.value}</span>
              <TrendBadge diff={stat.diff} suffix={stat.suffix} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Loyalty Program Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#0c0b5d] rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute -right-10 -bottom-10 text-white/5 rotate-12 transition-transform group-hover:scale-110">
          <Calendar size={200} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
           <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                 <div className="bg-[#FA6400] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Loyalty Rewards
                 </div>
                 {freeMatches > 0 && (
                   <span className="text-[#FA6400] text-xs font-black animate-pulse bg-white px-3 py-1 rounded-full">
                      {freeMatches} FREE MATCH AVAILABLE
                   </span>
                 )}
              </div>
              <h3 className="text-2xl font-black italic uppercase italic tracking-tighter">
                 Road to <span className="text-[#FA6400]">Free Match</span>
              </h3>
              <p className="text-indigo-200/70 text-sm font-medium leading-relaxed max-w-md">
                 Complete 10 games within a 5-month window to unlock a complimentary booking. 
                 Current streak: <span className="text-white font-bold">{loyaltyCount} games</span>.
              </p>
           </div>

           <div className="w-full md:w-64 flex flex-col gap-3">
              <div className="flex justify-between items-end text-xs font-black uppercase tracking-widest text-indigo-200">
                 <span>Progress</span>
                 <span>{loyaltyCount}/10</span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden border border-white/5">
                 <div 
                   className="h-full bg-gradient-to-r from-blue-400 to-[#FA6400] transition-all duration-1000"
                   style={{ width: `${(loyaltyCount / 10) * 100}%` }}
                 />
              </div>
              {freeMatches > 0 && (
                <button
                  onClick={() => router.push('/booking')}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#FA6400] hover:bg-[#ff7a21] text-white font-black uppercase tracking-widest text-[11px] rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-orange-900/30 cursor-pointer"
                >
                  <Gift size={14} />
                  Claim Free Match
                </button>
              )}
           </div>
        </div>
      </motion.div>

      {/* This Month Summary */}
      {bookings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-sm"
        >
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">
            This Month
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-400">Sessions</span>
              <span className="text-2xl font-black text-slate-900">{stats.thisMonthCount}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-400">Hours</span>
              <span className="text-2xl font-black text-slate-900">{stats.thisMonthHours}h</span>
            </div>
          </div>
        </motion.div>
      )}

      {bookings.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/40 rounded-2xl p-8 border border-slate-100 text-center"
        >
          <Calendar className="mx-auto mb-3 text-slate-300" size={40} />
          <p className="text-slate-500 font-medium">No bookings yet.</p>
          <p className="text-xs text-slate-400 mt-1">Book your first session to see stats here.</p>
        </motion.div>
      )}
    </div>
  );
}
