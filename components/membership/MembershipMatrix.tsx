"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Clock, Calendar, Zap } from "lucide-react";
import { MembershipPlan } from "@/lib/api/membership";

interface MembershipMatrixProps {
  plan: MembershipPlan;
  selectedDuration: string;
  selectedCategory: string;
  onSelect: (duration: string, category: string, price: number) => void;
}

export default function MembershipMatrix({
  plan,
  selectedDuration,
  selectedCategory,
  onSelect,
}: MembershipMatrixProps) {
  const durations = [
    { id: "3_days", label: "3 Days/ Week" },
    { id: "1_month", label: "1 Month" },
    { id: "3_months", label: "3 Months" },
  ];

  const categories = [
    { id: "morning", label: "Morning", time: "6 AM - 12 PM", icon: "🌅" },
    { id: "day", label: "Day", time: "12 PM - 4 PM", icon: "☀️" },
    { id: "evening", label: "Evening", time: "8 PM - 10 PM", icon: "🌙" },
  ];

  const getBasePrice = (duration: string, category: string): number => {
    if (duration === "3_days") {
      if (category === "morning") return plan.price3DaysMorning || 0;
      if (category === "day") return plan.price3DaysDay || 0;
      if (category === "evening") return plan.price3DaysEvening || 0;
    }
    if (duration === "1_month") {
      if (category === "morning") return plan.price1MonthMorning || 0;
      if (category === "day") return plan.price1MonthDay || 0;
      if (category === "evening") return plan.price1MonthEvening || 0;
    }
    if (duration === "3_months") {
      if (category === "morning") return plan.price3MonthsMorning || 0;
      if (category === "day") return plan.price3MonthsDay || 0;
      if (category === "evening") return plan.price3MonthsEvening || 0;
    }
    return 0;
  };

  const getDiscount = (duration: string, category: string): number => {
    if (duration === "3_days") {
      if (category === "morning") return plan.discount3DaysMorning || 0;
      if (category === "day") return plan.discount3DaysDay || 0;
      if (category === "evening") return plan.discount3DaysEvening || 0;
    }
    if (duration === "1_month") {
      if (category === "morning") return plan.discount1MonthMorning || 0;
      if (category === "day") return plan.discount1MonthDay || 0;
      if (category === "evening") return plan.discount1MonthEvening || 0;
    }
    if (duration === "3_months") {
      if (category === "morning") return plan.discount3MonthsMorning || 0;
      if (category === "day") return plan.discount3MonthsDay || 0;
      if (category === "evening") return plan.discount3MonthsEvening || 0;
    }
    return 0;
  };

  const calculateFinalPrice = (base: number, discount: number) => {
    return Math.round(base * (1 - discount / 100));
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 md:gap-6 mt-0 bg-white/40 backdrop-blur-md p-2 sm:p-4 md:p-6 lg:p-8 rounded-xl sm:rounded-2xl lg:rounded-[40px] border border-white shadow-xl shadow-orange-500/5">
      
      {/* Mobile Card Layout */}
      <div className="md:hidden flex flex-col gap-3">
        {categories.map((c) => (
          <div key={c.id} className="bg-white/80 rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
            <div className="bg-slate-50/50 p-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">{c.icon}</span>
                <p className="text-sm font-black uppercase tracking-wide text-[#0c0b5d]">{c.label}</p>
              </div>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2">
              {durations.map((d) => {
                const basePrice = getBasePrice(d.id, c.id);
                const discount = getDiscount(d.id, c.id);
                const finalPrice = calculateFinalPrice(basePrice, discount);
                const isSelected = selectedDuration === d.id && selectedCategory === c.id;
                
                return (
                  <button
                    type="button"
                    key={`${d.id}-${c.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect(d.id, c.id, finalPrice);
                      setTimeout(() => {
                        document.getElementById('next-steps-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                    className={`relative p-2.5 rounded-xl border-2 transition-all touch-manipulation select-none active:scale-95 ${
                      isSelected 
                        ? 'bg-[#0c0b5d] border-[#0c0b5d] text-white shadow-lg scale-105' 
                        : 'bg-white border-slate-200 hover:border-[#FA6400] active:bg-orange-50'
                    }`}
                  >
                    <div className="flex flex-col gap-1 items-center pointer-events-none">
                      <span className="text-[7px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap">
                        {d.label.split('/')[0].trim()}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[7px] font-bold line-through ${isSelected ? 'text-white/40' : 'text-slate-300'}`}>
                          {basePrice.toLocaleString()}
                        </span>
                        <span className={`text-[6px] font-black px-1 py-0.5 rounded uppercase ${isSelected ? 'bg-white/10 text-white' : 'bg-green-100 text-green-600'}`}>
                          -{discount}%
                        </span>
                      </div>
                      <span className={`text-sm font-black italic tracking-tight ${isSelected ? 'text-white' : 'text-[#0c0b5d]'}`}>
                        Rs. {(finalPrice / 1000).toFixed(1)}k
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#FA6400] rounded-full flex items-center justify-center shadow-lg pointer-events-none">
                        <CheckCircle2 size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block overflow-x-auto rounded-2xl sm:rounded-3xl lg:rounded-[32px] border border-slate-100 bg-white/80 shadow-2xl shadow-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="p-2 sm:p-3 md:p-4 lg:p-6 border-b border-r border-slate-100 w-[100px] sm:w-auto"></th>
              {durations.map((d) => (
                <th
                  key={d.id}
                  className="p-2 sm:p-3 md:p-4 lg:p-6 border-b border-slate-100 text-center align-bottom"
                >
                  <div className="flex flex-col gap-0.5 sm:gap-1 items-center justify-end h-full">
                    <div className="w-0.5 sm:w-1 h-4 sm:h-6 md:h-8 bg-[#FA6400]/20 rounded-full mb-1" />
                    <span className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] text-slate-400 whitespace-nowrap">
                      {d.label}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {categories.map((c) => (
              <tr key={c.id} className="group transition-colors">
                <td className="p-2 sm:p-3 md:p-4 lg:p-6 border-r border-slate-100 bg-slate-50/20">
                  <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
                    <span className="text-base sm:text-xl md:text-2xl drop-shadow-sm">
                      {c.icon}
                    </span>
                    <div className="flex flex-col">
                      <p className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs font-black uppercase tracking-wide sm:tracking-wider md:tracking-widest text-[#0c0b5d] whitespace-nowrap">
                        {c.label}
                      </p>
                      {/* <p className="text-[9px] text-[#FA6400] font-bold uppercase tracking-tight">{c.time}</p> */}
                    </div>
                  </div>
                </td>
                {durations.map((d) => {
                  const basePrice = getBasePrice(d.id, c.id);
                  const discount = getDiscount(d.id, c.id);
                  const finalPrice = calculateFinalPrice(basePrice, discount);
                  const isSelected =
                    selectedDuration === d.id && selectedCategory === c.id;

                  return (
                    <td
                      key={`${d.id}-${c.id}`}
                      onClick={() => {
                        onSelect(d.id, c.id, finalPrice);
                        setTimeout(() => {
                          document
                            .getElementById("next-steps-section")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                        }, 100);
                      }}
                      className={`p-2 sm:p-3 md:p-4 lg:p-6 text-center cursor-pointer relative transition-all duration-300 isolate group ${
                        isSelected
                          ? "bg-[#0c0b5d] text-white"
                          : "hover:bg-orange-50/50"
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="active-cell"
                          className="absolute inset-0 bg-[#0c0b5d] -z-10"
                          initial={false}
                          transition={{
                            type: "spring",
                            bounce: 0.2,
                            duration: 0.6,
                          }}
                        />
                      )}

                      <div className="flex flex-col items-center gap-0.5 sm:gap-1 md:gap-2">
                        <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 flex-wrap justify-center">
                          <span
                            className={`text-[7px] sm:text-[8px] md:text-[9px] font-bold line-through whitespace-nowrap ${isSelected ? "text-white/40" : "text-slate-300"}`}
                          >
                            Rs. {basePrice.toLocaleString()}
                          </span>
                          <span
                            className={`text-[6px] sm:text-[7px] md:text-[8px] font-black px-1 sm:px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${isSelected ? "bg-white/10 text-white" : "bg-green-100 text-green-600"}`}
                          >
                            -{discount}%
                          </span>
                        </div>
                        <span
                          className={`text-sm sm:text-base md:text-lg lg:text-xl font-black italic tracking-tighter whitespace-nowrap ${isSelected ? "text-white" : "text-[#0c0b5d]"}`}
                        >
                          Rs. {finalPrice.toLocaleString()}
                        </span>
                      </div>

                      <div
                        className={`absolute top-0.5 right-0.5 sm:top-1 sm:right-1 md:top-2 md:right-2 transition-opacity duration-300 ${isSelected ? "opacity-100" : "opacity-0"}`}
                      >
                        <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-[#FA6400] rounded-full flex items-center justify-center shadow-lg shadow-orange-500/40">
                          <CheckCircle2
                            size={8}
                            className="text-white sm:w-2.5 sm:h-2.5 md:w-3 md:h-3"
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 lg:gap-6 mt-1 sm:mt-2">
        <div className="bg-[#0c0b5d] p-2.5 sm:p-3 md:p-5 lg:p-6 rounded-xl sm:rounded-2xl lg:rounded-[32px] flex items-start gap-2 sm:gap-3 md:gap-4 shadow-xl shadow-indigo-500/10">
          <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-white/10 rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
            <Clock className="text-white w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] mb-0.5 sm:mb-1">
              Venue Policy: Peak Hours
            </p>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] text-white/60 leading-relaxed font-medium">
              Standard memberships exclude peak slots (4 PM - 8 PM). These hours
              are reserved exclusively for venue bookings.
            </p>
          </div>
        </div>
        <div className="bg-white/60 backdrop-blur-md p-2.5 sm:p-3 md:p-5 lg:p-6 rounded-xl sm:rounded-2xl lg:rounded-[32px] border border-white flex items-start gap-2 sm:gap-3 md:gap-4 shadow-lg">
          <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-[#FA6400]/10 rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
            <Calendar className="text-[#FA6400] w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] font-black text-[#0c0b5d] uppercase tracking-[0.1em] sm:tracking-[0.15em] md:tracking-[0.2em] mb-0.5 sm:mb-1">
              Membership Lifecycle
            </p>
            <p className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-500 leading-relaxed font-medium">
              Monthly plans follow a 30-day fixed cycle from your chosen start
              date. 3-Month plans extend to a full 90-day period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
