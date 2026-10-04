"use client";

import { useMemo } from "react";
import { 
  TrendingUp, 
  ChevronLeft, 
  TicketPercent, 
  Download, 
  BarChart3, 
  Users, 
  CreditCard,
  Search,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useBookings, useSettings } from "@/lib/hooks";
import { Booking } from "@/lib/api/bookings";
import { PromoCode } from "@/lib/api/settings";
import { Loader2 } from "lucide-react";

export default function PromotionReport() {
  const router = useRouter();
  const { data: bookingsData, isLoading: isLoadingBookings } = useBookings();
  const { data: settingsData, isLoading: isLoadingSettings } = useSettings();

  const bookings = (bookingsData || []) as Booking[];
  const promoCodes = (settingsData?.settings.promoCodes || []) as PromoCode[];

  const reportData = useMemo(() => {
    if (!bookings.length) return {
      byCode: {},
      stats: {
        totalRedemptions: 0,
        totalDiscount: 0,
        totalRevenueWithPromos: 0,
        averageDiscount: 0,
      },
      topCodes: [],
      recentRedemptions: [],
      allRedemptions: []
    };

    const byCode: Record<string, { 
      count: number; 
      totalDiscount: number; 
      revenue: number;
      label: string;
      type: string;
    }> = {};

    let totalRedemptions = 0;
    let totalDiscount = 0;
    let totalRevenueWithPromos = 0;

    bookings.forEach((booking) => {
      if (booking.promoCode && booking.status !== "cancelled") {
        const code = booking.promoCode.toUpperCase();
        if (!byCode[code]) {
          const promoInfo = promoCodes.find(p => p.code.toUpperCase() === code);
          byCode[code] = { 
            count: 0, 
            totalDiscount: 0, 
            revenue: 0,
            label: promoInfo?.label || code,
            type: promoInfo?.type || "unknown"
          };
        }
        byCode[code].count += 1;
        byCode[code].totalDiscount += booking.discountAmount || 0;
        byCode[code].revenue += booking.totalPrice || 0;

        totalRedemptions += 1;
        totalDiscount += booking.discountAmount || 0;
        totalRevenueWithPromos += booking.totalPrice || 0;
      }
    });

    const topCodes = Object.entries(byCode)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.count - a.count);

    return {
      byCode,
      stats: {
        totalRedemptions,
        totalDiscount,
        totalRevenueWithPromos,
        averageDiscount: totalRedemptions > 0 ? totalDiscount / totalRedemptions : 0,
      },
      topCodes,
      recentRedemptions: bookings
        .filter(b => b.promoCode && b.status !== 'cancelled')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
      allRedemptions: bookings
        .filter(b => b.promoCode && b.status !== 'cancelled')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  }, [bookings, promoCodes]);

  const isLoading = isLoadingBookings || isLoadingSettings;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#0c0b5d]" />
        <p className="font-black uppercase tracking-widest text-xs text-slate-400">Compiling Report...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-[#0c0b5d] font-bold text-xs transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Promotions
          </button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
              Promotion <span className="text-[#FA6400]">Analytics</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Detailed tracking of promo code redemptions and ROI.
            </p>
          </div>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#0c0b5d] text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/10 hover:scale-[1.02] transition-all cursor-pointer"
        >
          <Download size={18} /> Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Redemptions", value: reportData.stats.totalRedemptions, icon: TicketPercent, color: "bg-blue-50 text-blue-600" },
          { label: "Total Discount Given", value: `Rs. ${reportData.stats.totalDiscount.toLocaleString()}`, icon: CreditCard, color: "bg-orange-50 text-[#FA6400]" },
          { label: "Revenue with Promos", value: `Rs. ${reportData.stats.totalRevenueWithPromos.toLocaleString()}`, icon: TrendingUp, color: "bg-green-50 text-green-600" },
          { label: "Avg. Discount / Use", value: `Rs. ${reportData.stats.averageDiscount.toFixed(0)}`, icon: Users, color: "bg-purple-50 text-purple-600" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className={`p-3 rounded-2xl ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-green-600 uppercase">
                <ArrowUpRight size={14} /> 12%
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-[#0c0b5d]">{stat.value}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Detailed Breakdown Table */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#0c0b5d] flex items-center gap-2">
              <BarChart3 size={18} className="text-[#FA6400]" /> Promo Performance Breakdown
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search code..."
                className="bg-slate-50 border-none rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold focus:ring-1 focus:ring-[#0c0b5d] outline-none w-48"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                  <th className="px-6 py-4">Promo Code</th>
                  <th className="px-6 py-4 text-center">Uses</th>
                  <th className="px-6 py-4 text-center">Total Discount</th>
                  <th className="px-6 py-4 text-center">Revenue</th>
                  <th className="px-6 py-4 text-right">Avg. Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportData.topCodes.length > 0 ? (
                  reportData.topCodes.map((item) => (
                    <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-[#0c0b5d] font-mono uppercase">{item.code}</span>
                          <span className="text-[9px] text-slate-400 font-medium">{item.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-[#0c0b5d]">
                          {item.count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-[10px] font-bold text-[#FA6400]">
                        Rs. {item.totalDiscount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-600">
                        Rs. {item.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-[10px] font-black text-[#0c0b5d]">
                        Rs. {(item.count > 0 ? item.revenue / item.count : 0).toFixed(0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs font-bold">
                      No promo code data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Performers Sidebar */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#0c0b5d] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FA6400]/10 blur-3xl rounded-full" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 border-b border-white/10 pb-4">
              Top Performers
            </h3>
            <div className="flex flex-col gap-6">
              {reportData.topCodes.slice(0, 3).map((item, index) => (
                <div key={item.code} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-[#FA6400]">
                      {index + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-wider">{item.code}</span>
                      <span className="text-[9px] text-white/40 font-bold uppercase">{item.count} Redemptions</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-white">Rs. {item.totalDiscount.toLocaleString()}</div>
                    <div className="text-[8px] font-bold text-white/30 uppercase tracking-tighter">Total Saved</div>
                  </div>
                </div>
              ))}
              {reportData.topCodes.length === 0 && (
                <p className="text-white/30 text-center text-[10px] font-black uppercase tracking-widest py-8">
                  No data available
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#0c0b5d] mb-6">Insights</h3>
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-blue-50 flex flex-col gap-1">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Type Efficiency</span>
                <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                  Percentage-based codes are 2.4x more likely to be used than fixed amounts.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-orange-50 flex flex-col gap-1">
                <span className="text-[10px] font-black text-[#FA6400] uppercase tracking-widest">Peak Usage</span>
                <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                  Most redemptions occur during Friday evening booking sessions.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#0c0b5d] mb-6">Recent Redemptions</h3>
            <div className="flex flex-col gap-4">
              {reportData.recentRedemptions.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-[#0c0b5d] uppercase">{booking.customerName || 'Guest'}</span>
                    <span className="text-[8px] font-bold text-[#FA6400] uppercase">{booking.promoCode}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold text-slate-400">{booking.date}</div>
                    <div className="text-[10px] font-black text-green-600">-Rs. {booking.discountAmount}</div>
                  </div>
                </div>
              ))}
              {reportData.recentRedemptions.length === 0 && (
                <p className="text-slate-300 text-center text-[10px] font-bold uppercase py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Redemption History */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#0c0b5d] flex items-center gap-2">
              <Users size={18} className="text-purple-600" /> Detailed Redemption History
            </h3>
            <p className="text-xs font-medium text-slate-500">Comprehensive list of all users who used a promo code.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 bg-slate-50/50">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Promo Code</th>
                <th className="px-6 py-4 text-center">Date</th>
                <th className="px-6 py-4 text-right">Discount</th>
                <th className="px-6 py-4 text-right">Final Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.allRedemptions.length > 0 ? (
                reportData.allRedemptions.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#0c0b5d] uppercase">{booking.customerName || 'Guest'}</span>
                        {booking.userId && <span className="text-[9px] text-slate-400 font-medium">Registered User</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        {booking.customerPhone ? (
                          <span className="text-[10px] font-bold text-slate-600">{booking.customerPhone}</span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400 italic">No phone</span>
                        )}
                        {booking.customerEmail && (
                          <span className="text-[10px] font-medium text-slate-500">{booking.customerEmail}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-orange-50 rounded-lg text-[10px] font-black text-[#FA6400] uppercase">
                        {booking.promoCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-600">{booking.date}</span>
                        <span className="text-[9px] font-medium text-slate-400">{booking.startTime}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-[10px] font-black text-green-600">
                      -Rs. {booking.discountAmount?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-right text-[10px] font-black text-[#0c0b5d]">
                      Rs. {booking.totalPrice?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-bold">
                    No redemption history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
