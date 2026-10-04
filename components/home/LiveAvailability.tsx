"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isAfter } from "date-fns";
import Link from "next/link";
import { BRAND } from "@/constants";
import AvailabilitySlot from "./AvailabilitySlot";
import DateSelector from "./DateSelector";

import { Booking } from "@/lib/api/bookings";
import { useBookings } from "@/lib/hooks";
import { format as formatBtn } from "date-fns";

const PEAK_HOURS = ["16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];

export default function LiveAvailability() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateStr = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);
  const bookingsQuery = useBookings(
    { date: dateStr },
    { refetchIntervalMs: 30_000 },
  );
  const bookings: Booking[] = bookingsQuery.data || [];
  const isLoading = bookingsQuery.isLoading || bookingsQuery.isFetching;

  const displayHours = useMemo(() => {
    if (typeof window === "undefined") return PEAK_HOURS;
    const saved = localStorage.getItem("futsal_pricing_data");
    if (!saved) return PEAK_HOURS;
    try {
      const pricing = JSON.parse(saved) as unknown;
      if (!Array.isArray(pricing)) return PEAK_HOURS;
      const peak = pricing
        .filter(
          (item): item is { isPeak?: boolean; time?: string } =>
            typeof item === "object" && item !== null,
        )
        .filter((item) => item.isPeak && typeof item.time === "string")
        .map((item) => item.time?.split(" - ")[0] ?? "")
        .filter(Boolean);
      return peak.length > 0 ? peak : PEAK_HOURS;
    } catch {
      return PEAK_HOURS;
    }
  }, [dateStr]);

  const slots = useMemo(() => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const isToday = dateStr === today;
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    return displayHours.map((hour) => {
      const slotHour = parseInt(hour.split(":")[0] || "0");
      const isPast =
        isToday &&
        (slotHour < currentHour ||
          (slotHour === currentHour && currentMinutes > 0));

      const isBooked = bookings.some((b) => {
        if (b.status === "cancelled") return false;
        const bStart = parseInt(b.startTime.split(":")[0] || "0");
        const currentH = parseInt(hour.split(":")[0] || "0");
        return currentH >= bStart && currentH < bStart + b.duration;
      });

      let status = "AVAILABLE";
      if (isBooked) status = "BOOKED";
      else if (isPast) status = "EXPIRED";

      return { time: hour, status };
    });
  }, [bookings, dateStr, displayHours]);

  return (
    <section 
      className="relative flex flex-col gap-16 border-y border-gray-100/10 px-6 py-28 md:px-20 overflow-hidden bg-white/40 backdrop-blur-sm"
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 h-[500px] w-[500px] bg-orange-50/50 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] bg-blue-50/50 blur-[100px] rounded-full pointer-events-none" />

      {/* Header Container */}
      <div className="relative z-10 flex w-full flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
             <div className="h-2 w-2 animate-pulse rounded-full bg-[#FA6400]" />
             <span className="text-xs font-black uppercase tracking-[0.3em] text-[#FA6400]">Real-time Availability</span>
          </div>
          <h2 className="text-5xl font-black uppercase text-[#0c0b5d] tracking-tight md:text-7xl">
            Play <span className="text-[#FA6400]">{format(selectedDate, "MMMM d")}</span>
          </h2>
          <p className="max-w-xl text-lg font-medium text-slate-500 leading-relaxed">
            Instant booking for your game. Grab your spot before it&apos;s gone.
          </p>
        </div>
        
        {/* Date Selector Wrapper */}
        <div className="bg-gray-50  p-4 rounded-3xl border border-gray-100 backdrop-blur-xl shadow-sm">
          <DateSelector 
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            light={true}
          />
        </div>
      </div>

      {/* Slots Grid */}
      <div className="relative z-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6 min-h-[300px]">
        {isLoading ? (
          // Skeleton Loading State
          Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={i} 
              className="h-[140px] md:h-[160px] w-full rounded-[24px] border border-gray-100 bg-white/50 animate-pulse flex flex-col items-center justify-center gap-4"
            >
              <div className="h-8 w-24 bg-gray-100 rounded-lg" />
              <div className="h-6 w-16 bg-gray-50 rounded-full" />
            </div>
          ))
        ) : (
          slots.map((slot, index) => (
            <AvailabilitySlot key={index} slot={slot} date={selectedDate} light={true} />
          ))
        )}
      </div>

      {/* Interactive Footer for the section */}
      <div className="relative z-10 mt-8 flex justify-center">
        <p className="text-sm font-medium text-slate-500 bg-white/60 px-6 py-3 rounded-2xl border border-gray-200 shadow-sm backdrop-blur-md">
           These are peak hours shown here. For other timings, please <Link href="/booking" className="text-[#FA6400] font-bold hover:underline underline-offset-4 decoration-2 transition-all">visit the booking page</Link>.
        </p>
      </div>
    </section>
  );
}
