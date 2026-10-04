"use client";

import { useEffect, useState } from "react";
import { DollarSign, Save, Clock, Info, Loader2 } from "lucide-react";

import { formatTimeTo12h } from "@/lib/utils/time";
import {
  getSettings,
  HourlyPricingSlot,
} from "@/lib/api/settings";
import { toast } from "sonner";
import { useUpdateSettings } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";

// Generate default hours from 05:00 to 22:00 (Last slot 9PM-10PM)
const generateDefaultPricing = (): HourlyPricingSlot[] => {
  return Array.from({ length: 17 }, (_, i) => {
    const hour = i + 5;
    const hourStr = (h: number) => {
      const normalizedH = h % 24;
      const p = normalizedH >= 12 ? "PM" : "AM";
      const rs = normalizedH % 12 || 12;
      return `${rs.toString().padStart(2, "0")}:00 ${p}`;
    };
    const timeStr = `${hourStr(hour)} - ${hourStr(hour + 1)}`;
    const defaultPrice = (hour >= 5 && hour < 9) || hour >= 17 ? 1500 : 1000;

    return {
      id: `ts-${hour}`,
      time: timeStr,
      price: defaultPrice,
      isPeak: defaultPrice >= 1500,
    };
  });
};

export default function PricingManagement() {
  const [pricing, setPricing] = useState<HourlyPricingSlot[]>(
    generateDefaultPricing(),
  );
  const [error, setError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings", "detail"] as const,
    queryFn: () => getSettings(),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
  const updateSettingsMutation = useUpdateSettings();

  useEffect(() => {
    const p = settingsQuery.data?.settings.hourlyPricing;
    if (!p || p.length === 0) return;
    setPricing(p);
    setError(null);
  }, [settingsQuery.data?.settings.hourlyPricing]);

  const handlePriceChange = (id: string, newPrice: string) => {
    const numPrice = parseInt(newPrice) || 0;
    setPricing(
      pricing.map((item) =>
        item.id === id ? { ...item, price: numPrice } : item,
      ),
    );
  };

  const handlePeakToggle = (id: string, isPeak: boolean) => {
    setPricing(
      pricing.map((item) => (item.id === id ? { ...item, isPeak } : item)),
    );
  };

  const handleSave = async () => {
    try {
      setError(null);

      await updateSettingsMutation.mutateAsync({ hourlyPricing: pricing });
      toast.success("Pricing schedule updated successfully!");
    } catch (err) {
      console.error("Error saving pricing:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save pricing");
    }
  };

  if (settingsQuery.isLoading || settingsQuery.isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#0c0b5d] animate-spin" />
          <p className="text-slate-500 font-medium">Loading pricing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Dynamic <span className="text-[#FA6400]">Pricing</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Set custom hourly rates to maximize revenue during peak and off-peak
            hours.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
          className="flex items-center gap-2 bg-[#FA6400] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#FA6400]/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-70 disabled:hover:scale-100"
        >
          {updateSettingsMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save Changes
        </button>
      </div>

      <div className="relative z-10 w-full">
        {/* Main Pricing Section - Expanded to Full Width */}
        <div className="bg-white/95 backdrop-blur-md rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
          <div className="p-8 md:p-10 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-wide flex items-center gap-3">
                <Clock size={24} className="text-[#FA6400]" /> Hourly Rates Schedule
              </h3>
              <p className="text-xs font-bold text-slate-400">Configure your daily pricing strategy across 18 time slots.</p>
            </div>
            
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em]">
              <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FA6400] animate-pulse" />
                <span className="text-[#0c0b5d]">Peak Hours</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-slate-400">Off-Peak</span>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...pricing].sort((a, b) => {
                 const getHour = (id: string) => parseInt(id.replace('ts-', '')) || 0;
                 return getHour(a.id) - getHour(b.id);
              }).map((slot) => (
                <div
                  key={slot.id}
                  className={`relative flex flex-col gap-6 p-6 rounded-[32px] border transition-all duration-300 group hover:shadow-xl hover:-translate-y-1 ${
                    slot.isPeak 
                      ? "bg-orange-50/30 border-orange-100" 
                      : "bg-white border-slate-100 hover:border-blue-100"
                  }`}
                >
                  {/* Slot Header: Clean Stacking Time */}
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-black text-[#0c0b5d] tracking-tighter">
                          {formatTimeTo12h(slot.time).split(' - ')[0]}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold italic px-1">
                          to
                        </span>
                        <span className="text-[13px] font-black text-[#0c0b5d] tracking-tighter">
                          {formatTimeTo12h(slot.time).split(' - ')[1]}
                        </span>
                      </div>
                      <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400/50">
                        Hourly Session
                      </span>
                    </div>
                    
                    <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-inner ${
                      slot.isPeak ? "bg-[#FA6400] text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      <Clock size={16} />
                    </div>
                  </div>

                  {/* Price Input Section */}
                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-100/50">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-[10px]">
                        NPR
                      </span>
                      <input
                        type="number"
                        value={slot.price}
                        onChange={(e) =>
                          handlePriceChange(slot.id, e.target.value)
                        }
                        className="w-full bg-white border border-slate-100 rounded-xl py-2.5 pl-12 pr-4 text-sm font-black text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/5 focus:border-[#0c0b5d]/20 outline-none transition-all shadow-sm"
                      />
                    </div>

                    <label className={`flex items-center justify-center gap-2 py-2 rounded-xl border transition-all cursor-pointer ${
                      slot.isPeak 
                        ? "bg-[#FA6400] border-[#FA6400] text-white shadow-md shadow-[#FA6400]/20" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={slot.isPeak}
                        onChange={(e) =>
                          handlePeakToggle(slot.id, e.target.checked)
                        }
                        className="hidden"
                      />
                      <span className="text-[9px] font-black uppercase tracking-widest text-center px-1">
                        {slot.isPeak ? "Peak Active" : "Set Peak"}
                      </span>
                    </label>
                  </div>

                  {/* Decorative corner accent */}
                  {slot.isPeak && (
                    <div className="absolute top-0 right-0 p-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#FA6400] animate-ping" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
