"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Copy,
  Check,
  Info,
  Tag,
  Ticket,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { PromoCode } from "@/lib/api/settings";
import { usePromoCodes } from "@/lib/hooks";

interface DisplayPromoCode {
  id: string;
  title: string;
  code: string;
  discount: string;
  description: string;
  expiryDate?: string;
  days?: string[];
  startTime?: string;
  endTime?: string;
  isExpired?: boolean;
}

// Check if promo is expired (kept for backward compatibility in transform function)
const isPromoExpired = (promo: PromoCode): boolean => {
  if (!promo.expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(promo.expiryDate);
  return expiry < today;
};

// Format time for display (convert 24h to 12h)
const formatTime = (time: string | undefined): string => {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// Transform API PromoCode to DisplayPromoCode
const transformPromoCode = (
  promo: PromoCode,
  index: number,
): DisplayPromoCode => {
  const discountText =
    promo.type === "percent" ? `${promo.value}% OFF` : `RS. ${promo.value} OFF`;

  return {
    id: `promo-${index}`,
    title: promo.title || promo.label || promo.code,
    code: promo.code,
    discount: discountText,
    description: promo.description || promo.label || "",
    expiryDate: promo.expiryDate,
    days: promo.validDays,
    startTime: promo.startTime ? formatTime(promo.startTime) : undefined,
    endTime: promo.endTime ? formatTime(promo.endTime) : undefined,
    isExpired: isPromoExpired(promo),
  };
};

export default function PromoCodePage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // TanStack Query: Fetch promo codes (already filtered active/expired)
  const { data: promoData, isLoading, isError } = usePromoCodes();

  // Transform promo codes for display
  const { activePromos, expiredPromos } = useMemo(() => {
    if (!promoData) return { activePromos: [], expiredPromos: [] };
    
    return {
      activePromos: promoData.active.map(transformPromoCode),
      expiredPromos: promoData.expired.map(transformPromoCode),
    };
  }, [promoData]);

  const error = isError ? "Failed to load promo codes. Please try again later." : null;
  const totalPromos = activePromos.length + expiredPromos.length;

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
      <Navbar />

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 md:px-20 pt-32 pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20">
          <div className="space-y-6 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#0c0b5d]/5 border border-[#0c0b5d]/10 text-[#0c0b5d] text-xs font-black uppercase tracking-widest shadow-sm"
            >
              <Tag className="w-3.5 h-3.5 fill-indigo-200" />
              Member Rewards
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl md:text-8xl font-black text-[#0c0b5d] tracking-tighter leading-[0.9] md:leading-[0.85]"
            >
              Unlock <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0c0b5d] to-[#FA6400]">
                The Zone.
              </span>
            </motion.h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col gap-6"
          >
            <p className="text-slate-500 text-xl font-medium max-w-xs md:text-right leading-relaxed">
              Premium rewards for the most dedicated ballers in the city.
            </p>
            <div className="flex md:justify-end gap-3">
              <div className="w-12 h-1 px-1 bg-[#0c0b5d] rounded-full" />
              <div className="w-4 h-1 px-1 bg-slate-200 rounded-full" />
              <div className="w-4 h-1 px-1 bg-slate-100 rounded-full" />
            </div>
          </motion.div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-[#0c0b5d] animate-spin" />
              <p className="text-slate-500 font-medium">
                Loading promo codes...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-8 rounded-3xl text-center">
              <p className="text-lg font-bold mb-2">
                Unable to Load Promo Codes
              </p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : totalPromos === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Ticket size={40} className="text-slate-400" />
            </div>
            <h3 className="text-2xl font-black text-[#0c0b5d] mb-2">
              No Active Promos
            </h3>
            <p className="text-slate-500">
              Check back later for exciting offers!
            </p>
          </div>
        ) : (
          <>
            {/* Active Promos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {activePromos.map((promo, index) => (
                <motion.div
                  key={promo.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index, duration: 0.6 }}
                  whileHover={{ y: -8 }}
                  className="group relative h-full flex flex-col"
                >
                  {/* Main Card */}
                  <div className="flex-1 bg-white rounded-[48px] p-10 shadow-[0_20px_60px_-20px_rgba(12,11,93,0.08)] border border-slate-100/60 transition-all duration-500 group-hover:shadow-[0_40px_100px_-30px_rgba(12,11,93,0.12)] relative overflow-hidden flex flex-col">
                    {/* Background Accent */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#0c0b5d]/[0.02] rounded-full -mr-20 -mt-20 group-hover:bg-[#0c0b5d]/[0.04] transition-colors duration-500" />

                    {/* Top Row: Icon & Actions */}
                    <div className="flex justify-between items-start mb-10 relative z-10">
                      <div className="w-16 h-16 bg-[#0c0b5d] text-white rounded-3xl flex items-center justify-center shadow-lg transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                        <Ticket size={32} />
                      </div>

                      <button
                        onClick={() => copyToClipboard(promo.code)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-300 border cursor-pointer ${
                          copiedCode === promo.code
                            ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20"
                            : "bg-white border-slate-100 text-slate-400 hover:border-[#0c0b5d] hover:text-[#0c0b5d] hover:shadow-md"
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {copiedCode === promo.code ? "Copied" : "Copy Code"}
                        </span>
                        {copiedCode === promo.code ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>

                    {/* Info Section */}
                    <div className="mb-auto pointer-events-none">
                      <h3 className="text-3xl font-black text-[#0c0b5d] mb-4 tracking-tight group-hover:text-[#FA6400] transition-colors duration-300">
                        {promo.title}
                      </h3>

                      <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-[#FA6400] rounded-xl font-black text-xl mb-6 shadow-sm">
                        {promo.discount}
                      </div>

                      <p className="text-slate-500 text-lg leading-relaxed mb-10 font-medium">
                        {promo.description}
                      </p>

                      <div className="space-y-5 mb-10">
                        {promo.days && promo.days.length > 0 && (
                          <div className="flex items-center gap-4 text-slate-400 group-hover:text-slate-600 transition-colors">
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-[#0c0b5d]/5 group-hover:text-[#0c0b5d] transition-colors">
                              <Calendar size={18} />
                            </div>
                            <span className="font-bold text-sm tracking-tight">
                              {promo.days.length === 7
                                ? "All Days"
                                : promo.days.join(", ")}
                            </span>
                          </div>
                        )}

                        {promo.startTime && promo.endTime && (
                          <div className="flex items-center gap-4 text-slate-400 group-hover:text-slate-600 transition-colors">
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-[#0c0b5d]/5 group-hover:text-[#0c0b5d] transition-colors">
                              <Clock size={18} />
                            </div>
                            <span className="font-bold text-sm tracking-tight">
                              {promo.startTime} - {promo.endTime}
                            </span>
                          </div>
                        )}

                        {promo.expiryDate && (
                          <div className="flex items-center gap-4 text-slate-400 group-hover:text-slate-600 transition-colors">
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-[#0c0b5d]/5 group-hover:text-[#0c0b5d] transition-colors">
                              <Info size={18} />
                            </div>
                            <span className="font-bold text-sm tracking-tight capitalize">
                              Until{" "}
                              {new Date(promo.expiryDate).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Voucher Display */}
                    <div className="relative group/voucher pt-6 border-t border-dashed border-slate-200">
                      <div className="absolute -left-14 -top-3 w-8 h-8 bg-[#f8faf7] rounded-full border border-slate-100/50" />
                      <div className="absolute -right-14 -top-3 w-8 h-8 bg-[#f8faf7] rounded-full border border-slate-100/50" />

                      <div className="flex items-center justify-center p-6 bg-slate-50 rounded-[32px] border-2 border-slate-100 border-dashed transition-all duration-300 group-hover:bg-[#0c0b5d]/5 group-hover:border-[#0c0b5d]/20">
                        <span className="text-2xl sm:text-3xl font-black tracking-[0.2em] uppercase text-[#0c0b5d]">
                          {promo.code}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Expired Promos Section */}
            {expiredPromos.length > 0 && (
              <div className="mt-16">
                <h2 className="text-2xl font-black text-slate-400 mb-8 uppercase tracking-widest">
                  Expired Offers
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {expiredPromos.map((promo, index) => (
                    <motion.div
                      key={promo.id}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index, duration: 0.6 }}
                      className="group relative h-full flex flex-col"
                    >
                      <div className="flex-1 bg-white rounded-[48px] p-10 shadow-[0_20px_60px_-20px_rgba(12,11,93,0.08)] border border-slate-100/60 relative overflow-hidden flex flex-col opacity-60 grayscale-[0.5]">
                        <div className="flex justify-between items-start mb-10 relative z-10">
                          <div className="w-16 h-16 bg-slate-400 text-white rounded-3xl flex items-center justify-center shadow-lg">
                            <Ticket size={32} />
                          </div>

                          <span className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-slate-200 shadow-sm">
                            <Info size={14} /> Expired
                          </span>
                        </div>

                        <div className="mb-auto">
                          <h3 className="text-3xl font-black text-slate-400 mb-4 tracking-tight">
                            {promo.title}
                          </h3>

                          <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-black text-xl mb-6">
                            {promo.discount}
                          </div>

                          <p className="text-slate-400 text-lg leading-relaxed mb-10 font-medium">
                            {promo.description}
                          </p>
                        </div>

                        <div className="relative pt-6 border-t border-dashed border-slate-200">
                          <div className="flex items-center justify-center p-6 bg-slate-50 rounded-[32px] border-2 border-slate-100 border-dashed">
                            <span className="text-2xl sm:text-3xl font-black tracking-[0.2em] uppercase text-slate-300 line-through">
                              {promo.code}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Brand Showcase Section */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="mt-32 relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0b5d] to-[#FA6400] rounded-[60px] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-700 -z-10" />

          {/* <div className="bg-[#0c0b5d] rounded-[60px] p-12 md:p-20 flex flex-col lg:flex-row items-center justify-between gap-12 overflow-hidden relative shadow-2xl">
         
            <div
              className="absolute inset-0 z-0 opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
              }}
            />

            <div className="space-y-8 max-w-xl text-center lg:text-left relative z-10">
              <h2 className="text-4xl md:text-6xl font-black text-white leading-tight">
                Don&apos;t Miss <br />A Single Match.
              </h2>
              <p className="text-white/60 text-xl font-medium">
                Join our newsletter and be the first to receive exclusive
                seasonal promo codes directly in your inbox.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 bg-white/5 border border-white/10 rounded-[28px] px-8 py-5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FA6400]/50 transition-all font-bold"
                />
                <button className="bg-[#FA6400] hover:bg-white hover:text-[#0c0b5d] text-white px-10 py-5 rounded-[28px] font-black transition-all duration-300 shadow-xl flex items-center justify-center gap-3 group/btn2 cursor-pointer border-2 border-[#FA6400] hover:border-white">
                  Subscribe
                  <ChevronRight
                    size={20}
                    className="group-hover/btn2:translate-x-1 transition-transform"
                  />
                </button>
              </div>
            </div>

            <div className="relative w-full max-w-sm lg:max-w-md aspect-square z-10">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#FA6400]/20 to-transparent rounded-full blur-2xl animate-pulse" />
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[60px] w-full h-full p-12 flex flex-col justify-center items-center gap-8 shadow-inner group-hover:scale-105 transition-transform duration-700">
                <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl rotate-12 group-hover:rotate-0 transition-transform duration-500">
                  <Tag className="w-12 h-12 text-[#0c0b5d]" />
                </div>
                <div className="text-center space-y-4">
                  <div className="text-white font-black text-5xl">
                    {activePromos.length}
                  </div>
                  <div className="text-white/50 font-black uppercase tracking-[0.3em] text-xs">
                    Active Codes
                  </div>
                </div>
              </div>
            </div>
          </div> */}
        </motion.div>

        {/* Footer info links */}
      </main>

      <Footer />
    </div>
  );
}
