"use client";

import { useMemo } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface DateSelectorProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  light?: boolean;
}

export default function DateSelector({ selectedDate, onSelectDate, light = false }: DateSelectorProps) {
  const dates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(new Date(), i));
  }, []);

  const isDateInWeek = dates.some(d => isSameDay(d, selectedDate));

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-2xl border p-2 transition-colors duration-300 ${
      light ? "border-gray-200 bg-white" : "border-white/10 bg-[#050426]"
    }`}>
      {/* 7-Day Quick Selection */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {dates.map((date) => {
          const isSelected = isSameDay(date, selectedDate);
          return (
            <button
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              className={`flex min-w-[64px]  cursor-pointer flex-col items-center justify-center rounded-xl px-3 py-2 transition-all active:scale-95 ${
                isSelected 
                  ? "bg-[#FA6400] text-white shadow-md shadow-orange-500/20" 
                  : light 
                    ? "text-[#0c0b5d] hover:bg-gray-100" 
                    : "text-white hover:bg-white/5"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-orange-100" : light ? "text-slate-400" : "text-slate-400"}`}>
                {format(date, "EEE")}
              </span>
              <span className="text-lg font-black">{format(date, "d")}</span>
            </button>
          );
        })}
      </div>

      <div className={`w-px h-10 mx-1 ${light ? "bg-gray-200" : "bg-white/10"}`} />

      {/* Calendar Popover for Beyond 1 Week */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={`flex  cursor-pointer flex-col items-center justify-center rounded-xl px-4 py-2 transition-all hover:scale-105 active:scale-95 border ${
            !isDateInWeek 
              ? "bg-[#0c0b5d] text-white border-transparent shadow-md shadow-blue-900/20" 
              : light 
                ? "bg-gray-50 text-[#0c0b5d] border-gray-200 hover:bg-gray-100" 
                : "bg-white/5 text-white border-white/10 hover:bg-white/10"
          }`}>
            <CalendarIcon size={20} className="mb-1" />
            <span className="text-[10px]  font-bold uppercase tracking-wider">More</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onSelectDate(date)}
            initialFocus
            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
