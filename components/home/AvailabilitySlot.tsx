"use client";

import { BRAND } from "@/constants";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { formatTimeTo12h } from "@/lib/utils/time";

interface AvailabilitySlotProps {
  slot: {
    time: string;
    status: string;
  };
  date?: Date;
  light?: boolean;
}

export default function AvailabilitySlot({ slot, date = new Date(), light = false }: AvailabilitySlotProps) {
  const isAvailable = slot.status === "AVAILABLE";

  const Content = (
    <div 
      className={`group relative flex h-[140px] md:h-[160px] w-full flex-col items-center justify-center gap-4 rounded-[24px] border transition-all duration-300 ${
        isAvailable 
          ? light
            ? "border-gray-100 bg-white hover:bg-white hover:border-[#0c0b5d]/30 hover:-translate-y-1 shadow-[0_10px_30px_-15px_rgba(12,11,93,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(12,11,93,0.15)]"
            : "border-white/5 bg-[#161B22]/40 hover:bg-[#0c0b5d]/10 hover:border-[#0c0b5d]/50 hover:-translate-y-1 shadow-[0_10px_30px_-15_rgba(0,0,0,0.3)] hover:shadow-[0_20px_40px_-15px_rgba(12,11,93,0.3)]" 
          : light
            ? "bg-gray-50 border-gray-100 opacity-60 grayscale cursor-not-allowed"
            : "bg-black/20 border-white/5 opacity-40 grayscale cursor-not-allowed"
      }`}
    >
      {/* Time Display */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-baseline gap-1">
          <span 
            className={`text-2xl md:text-3xl font-black transition-colors ${
              isAvailable 
                ? light ? "text-[#0c0b5d] group-hover:text-[#FA6400]" : "text-white group-hover:text-[#FA6400]" 
                : "text-gray-400 line-through"
            }`}
          >
            {formatTimeTo12h(slot.time)}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-50">
          <Clock size={10} className={light ? "text-slate-400" : "text-gray-400"} />
          <span className={`text-[10px] font-bold uppercase tracking-tighter ${light ? "text-slate-400" : "text-gray-400"}`}>
            {format(date, "MMM d")}
          </span>
        </div>
      </div>

      {/* Status & Icon */}
      <div className="flex flex-col items-center gap-2">
        <div 
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
            isAvailable 
              ? "bg-[#FA6400]/10 text-[#FA6400] group-hover:bg-[#FA6400] group-hover:text-white" 
              : slot.status === "EXPIRED"
                ? light ? "bg-slate-100 text-slate-400" : "bg-gray-800 text-gray-400"
                : light ? "bg-red-50 text-red-500" : "bg-red-900/20 text-red-400"
          }`}
        >
          {slot.status === "AVAILABLE" ? <CheckCircle2 size={12} /> : slot.status === "EXPIRED" ? <Clock size={12} /> : <XCircle size={12} />}
          {slot.status}
        </div>
      </div>

      {/* Subtle Overlay for Hover in light mode */}
      {isAvailable && light && (
        <div className="absolute inset-0 rounded-[24px] bg-gradient-to-tr from-blue-50/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
      {/* Glossy Overlay for Available in dark mode */}
      {isAvailable && !light && (
        <div className="absolute inset-0 rounded-[24px] bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
        </div>
  );

  if (isAvailable) {
    return (
      <Link href={`/booking?time=${slot.time}`} className="block w-full">
        {Content}
      </Link>
    );
  }

  return Content;
}
