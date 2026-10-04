import { useState } from "react";
import { ChevronDown, Calendar as CalendarIcon, Info, Plus, RefreshCw } from "lucide-react";
import BookingCard from "./BookingCard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Button } from "@/components/ui/button";
import { MembershipSubscription } from "@/lib/api/membership";
import Link from "next/link";
import { useRenewSubscription } from "@/lib/hooks/membership";
import { toast } from "sonner";

interface BookingDisplay {
  id: string;
  status: string;
  date: string;       // formatted display string e.g. "Today, 5:00 PM"
  rawDate: string;    // YYYY-MM-DD for date filtering
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  paymentStatus: string;
  paymentMethod: string;
  notes?: string;
}

interface BookingTimelineProps {
  bookings: BookingDisplay[];
  membershipHistory: MembershipSubscription[];
  filter: string;
  setFilter: (filter: string) => void;
}

export default function BookingTimeline({ bookings, membershipHistory, filter, setFilter }: BookingTimelineProps) {
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const renewMutation = useRenewSubscription();

  const filteredBookings = bookings.filter((b) => {
    // Exclude membership-related bookings from normal history
    if (b.notes?.includes("MEMBERSHIP_PAYMENT") || b.paymentMethod === "membership") return false;

    // Status filter — map "upcoming" to pending/confirmed
    if (filter === "completed" && b.status !== "completed") return false;
    if (filter === "upcoming" && b.status !== "upcoming" && b.status !== "confirmed" && b.status !== "pending") return false;

    // Date range filter
    if (startDate) {
      const bookingDate = new Date(b.rawDate);
      const from = new Date(startDate);
      from.setHours(0, 0, 0, 0);
      const to = endDate ? new Date(endDate) : new Date(startDate);
      to.setHours(23, 59, 59, 999);
      if (bookingDate < from || bookingDate > to) return false;
    }

    return true;
  });

  const isExpiringSoon = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Red if expired (diffDays < 0) or expiring soon (diffDays < 15)
    return diffDays < 15;
  };

  const handleRenew = async (id: string) => {
    try {
      await renewMutation.mutateAsync(id);
      toast.success("Membership renewal request sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to renew membership");
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-12">
      {/* Normal Booking History */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Booking History</h2>
            <p className="text-sm text-slate-500 font-medium">Manage and track your court sessions</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
              {["all", "completed", "upcoming"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    filter === f
                      ? "bg-[#0c0b5d] text-white shadow-md shadow-blue-900/20"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />

            <div className="relative">
              <DatePicker
                selectsRange={true}
                startDate={startDate ?? undefined}
                endDate={endDate ?? undefined}
                onChange={(update) => setDateRange(update)}
                isClearable={true}
                placeholderText="Pick a date range"
                customInput={
                  <Button
                    variant="outline"
                    className="w-full sm:w-[280px] justify-start text-left font-normal border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate overflow-hidden">
                      {startDate
                        ? endDate
                          ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                          : startDate.toLocaleDateString()
                        : "Pick a date range"}
                    </span>
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative pl-10 md:pl-12 flex flex-col gap-8">
          <div
            className="absolute left-5 md:left-6 top-0 bottom-0 w-[2px]"
            style={{ background: "rgba(12, 11, 93, 0.1)" }}
          />

          {filteredBookings.length === 0 ? (
            <p className="text-slate-400 font-medium text-sm pl-2 py-4">No bookings match your filter.</p>
          ) : (
            filteredBookings.map((booking) => (
              <div key={booking.id} className="relative transition-all duration-300">
                <div
                  className={`absolute -left-10 md:-left-12 top-4 h-4 w-4 rounded-full border-4 border-[#F0F4FA] z-10 ${
                    booking.status === "upcoming" || booking.status === "confirmed" || booking.status === "pending"
                      ? "bg-[#0c0b5d]"
                      : booking.status === "rescheduled"
                      ? "bg-[#FA6400]"
                      : "bg-[#94A3B8]"
                  }`}
                />
                <BookingCard booking={booking} />
              </div>
            ))
          )}

          {filteredBookings.length > 0 && (
            <div className="flex justify-center pt-2">
              <button className="flex items-center gap-2 text-[#FA6400] text-sm font-bold hover:brightness-110 transition-all py-2 cursor-pointer">
                Load older bookings
                <ChevronDown size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Membership History Section */}
      <div className="flex flex-col gap-8 pt-8 border-t border-slate-100">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Membership History</h2>
          <p className="text-sm text-slate-500 font-medium">Your active plans and subscription history</p>
        </div>

        {membershipHistory.length === 0 ? (
          <div className="bg-slate-50 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
            <div className="bg-white p-4 rounded-2xl w-fit mx-auto mb-4 shadow-sm">
               <Info className="text-[#0c0b5d]" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Ufff… You don’t have active registered Membership yet.</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-8">
              Join our membership program to enjoy exclusive perks, fixed slots, and great discounts on your favorite sessions.
            </p>
            <Link 
              href="/membership"
              className="inline-flex items-center gap-2 bg-[#0c0b5d] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#FA6400] transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
               <Plus size={20} />
               Activate Membership
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Membership Title</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Plan</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Registered Date</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Expires On</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {membershipHistory.map((sub) => {
                    const expiring = isExpiringSoon(sub.endDate);
                    const canRenew = sub.status === 'active' && expiring;
                    
                    // Simplified Plan duration
                    const duration = sub.chosenDuration?.replace('_', ' ') || "Monthly";

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{sub.plan.name}</td>
                        <td className="px-6 py-4 text-slate-600 capitalize">
                           {duration}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                           {new Date(sub.startDate).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-3 py-1 rounded-lg font-bold ${expiring ? 'bg-red-500 text-white shadow-md shadow-red-200' : 'text-slate-500'}`}>
                              {new Date(sub.endDate).toLocaleDateString("en-GB")}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <button
                             onClick={() => handleRenew(sub.id)}
                             disabled={!canRenew || renewMutation.isPending}
                             className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                               canRenew 
                                 ? 'bg-[#0c0b5d] text-white hover:bg-[#FA6400] shadow-md active:scale-95' 
                                 : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                             }`}
                           >
                             {renewMutation.isPending && renewMutation.variables === sub.id ? (
                               <RefreshCw size={14} className="animate-spin" />
                             ) : (
                               <RefreshCw size={14} />
                             )}
                             Renew
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Membership Perks & Status</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {membershipHistory.slice(0, 3).map(sub => (
                   <div key={sub.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-black text-[#0c0b5d] uppercase tracking-tighter bg-blue-50 px-2 py-1 rounded-md">
                            {sub.plan.name}
                         </span>
                         <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                           sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                         }`}>
                            {sub.status}
                         </span>
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-2">
                         {sub.plan.description || "Premium membership access with exclusive member benefits."}
                      </div>
                      <div className="pt-2 border-t border-slate-50 flex items-center justify-between">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Deadline</span>
                         <span className={`text-xs font-black ${isExpiringSoon(sub.endDate) ? 'text-red-500' : 'text-slate-700'}`}>
                            {new Date(sub.endDate).toLocaleDateString("en-GB")}
                         </span>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

