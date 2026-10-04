"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Tag, Copy, Loader2, Sparkles } from "lucide-react";
import { useSettings } from "@/lib/hooks";



export default function Promotions({ light = false }: { light?: boolean }) {
  const { data: settingsData, isLoading } = useSettings();
  
  const activeCodes = (settingsData?.settings.promoCodes || [])
    .filter(p => p.isActive !== false)
    .map(p => ({
      ...p,
      discount: p.type === 'percent' ? `${p.value}% OFF` : `RS. ${p.value} OFF`,
      isExpired: p.expiryDate ? new Date(p.expiryDate) < new Date() : false
    }))
    .filter(p => !p.isExpired);

  const displayCodes = activeCodes;

  const [copied, setCopied] = useState(false);
  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number) => {
    if (displayCodes.length <= 1) return;
    setCopied(false);
    setPage([page + newDirection, newDirection]);
  };

  const index = displayCodes.length > 0 ? Math.abs(page % displayCodes.length) : 0;
  const currentPromo = displayCodes[index];

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 500 : -500,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 500 : -500,
      opacity: 0,
      scale: 0.95
    }),
  };

  if (isLoading) {
    return (
      <div className="mx-4 my-10 md:mx-6 md:my-28 flex items-center justify-center min-h-[300px] md:min-h-[560px]">
        <Loader2 className="h-12 w-12 animate-spin text-[#0c0b5d]" />
      </div>
    );
  }

  /* ── No active promos: show a teaser banner ── */
  if (!currentPromo) {
    return (
      <section className="mx-4 my-10 md:mx-6 md:my-28 relative">
        <div
          className={`relative w-full overflow-hidden rounded-[32px] md:rounded-[60px] transition-all duration-700 ${
            light
              ? "bg-white/60 backdrop-blur-xl border border-white/20 shadow-[0_40px_100px_-20px_rgba(12,11,93,0.1)]"
              : "shadow-[0_40px_100px_-20px_rgba(12,11,93,0.6)]"
          }`}
          style={!light ? { background: "linear-gradient(108deg, #050426 0%, #0c0b5d 35%, #FA6400 100%)" } : {}}
        >
          {/* Dot grid */}
          <div
            className="absolute inset-0 z-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: `radial-gradient(circle, ${light ? '#0c0b5d' : 'white'} 1px, transparent 1px)`, backgroundSize: '40px 40px' }}
          />
          <div className="relative z-10 flex flex-col items-center justify-center gap-6 px-6 py-16 md:py-24 text-center">
            <div className={`inline-flex items-center gap-2 rounded-full px-5 py-2 border backdrop-blur-md ${
              light ? "bg-[#0c0b5d]/5 border-[#0c0b5d]/10 text-[#0c0b5d]" : "bg-white/10 border-white/20 text-white"
            }`}>
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Promotions</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight ${light ? "text-[#0c0b5d]" : "text-white"}`}>
              Stay tuned for upcoming deals!
            </h2>
            <p className={`max-w-md text-base md:text-lg font-medium ${light ? "text-slate-500" : "text-white/70"}`}>
              Exclusive promo codes and flash sales are on their way. Check back soon to unlock big savings on bookings and memberships.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-3 my-10 sm:mx-4 md:mx-6 md:my-28 relative group">
      <div 
        className={`relative w-full overflow-hidden rounded-[32px] md:rounded-[60px] transition-all duration-700 ${
          light 
            ? "bg-white/60 backdrop-blur-xl border border-white/20 shadow-[0_40px_100px_-20px_rgba(12,11,93,0.1)]" 
            : "shadow-[0_40px_100px_-20px_rgba(12,11,93,0.6)]"
        }`}
        style={!light ? { background: "linear-gradient(108deg, #050426 0%, #0c0b5d 35%, #FA6400 100%)" } : {}}
      >
        {/* Navigation arrow – hidden on very small screens, shown from sm upward */}
        {displayCodes.length > 1 && (
          <div className="hidden sm:flex absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-4">
            <button 
              onClick={() => paginate(1)}
              className={`group/btn flex items-center justify-center h-12 w-12 md:h-16 md:w-16 rounded-full border transition-all duration-500 shadow-2xl ${
                light 
                  ? "bg-[#0c0b5d]/5 backdrop-blur-xl border-[#0c0b5d]/10 text-[#0c0b5d] hover:bg-[#0c0b5d] hover:text-white" 
                  : "bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white hover:text-[#0c0b5d]"
              }`}
            >
              <ChevronRight className={`h-6 w-6 md:h-8 md:w-8 transition-transform group-hover/btn:translate-x-1 ${light ? "text-[#0c0b5d]" : "text-white"}`} />
            </button>
            <div className="flex flex-col gap-2">
              {displayCodes.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 rounded-full transition-all duration-500 ${
                    i === index 
                      ? light ? 'h-6 bg-[#0c0b5d]' : 'h-6 bg-white' 
                      : light ? 'h-1.5 bg-[#0c0b5d]/20' : 'h-1.5 bg-white/30'
                  }`} 
                /> 
              ))}
            </div>
          </div>
        )}

        {/* Decorative Background */}
        <div className={`absolute inset-0 z-0 opacity-10 pointer-events-none ${light ? "bg-slate-50/50" : ""}`} 
          style={{ backgroundImage: `radial-gradient(circle, ${light ? '#0c0b5d' : 'white'} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} 
        />
        <div className={`absolute -left-20 -bottom-20 h-96 w-96 rounded-full blur-[100px] ${light ? "bg-blue-50/50" : "bg-white/5"}`} />

        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={page}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="relative flex h-auto w-full flex-col items-center justify-center gap-8 px-5 py-10
                        sm:px-8 sm:py-14
                        md:flex-row md:items-center md:justify-between md:gap-0 md:px-16 md:py-16
                        lg:px-24 lg:min-h-[560px]"
          >
            {/* Left Info */}
            <div className="z-10 flex flex-col gap-6 w-full md:max-w-2xl md:gap-10 sm:pr-16 md:pr-0">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`inline-flex items-center gap-2 w-fit rounded-full px-4 py-2 border backdrop-blur-md sm:px-6 ${
                  light 
                    ? "bg-[#0c0b5d]/5 border-[#0c0b5d]/10 text-[#0c0b5d]" 
                    : "bg-white/10 border-white/20 text-white"
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">
                  {currentPromo.appliedTo === 'membership' ? 'Member Perk' : 
                   currentPromo.appliedTo === 'booking' ? 'Booking Special' : 
                   'Flash Sale'}
                </span>
              </motion.div>
              
              <div className="space-y-3 md:space-y-4">
                <h2 className={`text-4xl sm:text-5xl font-black leading-tight md:text-7xl lg:text-[100px] tracking-tight ${
                  light ? "text-[#0c0b5d]" : "text-white"
                }`}>
                  {currentPromo.title}
                </h2>
                <div className="space-y-3 md:space-y-6">
                  <p className={`max-w-xl text-base sm:text-lg md:text-xl font-medium leading-relaxed ${
                    light ? "text-slate-500" : "text-white/80"
                  }`}>
                    {currentPromo.description}
                  </p>
                  {(() => {
                    const promo = currentPromo as unknown;
                    const days =
                      typeof promo === "object" && promo !== null
                        ? (promo as { days?: string[]; validDays?: string[] }).days ||
                          (promo as { days?: string[]; validDays?: string[] }).validDays
                        : undefined;
                    if (!days || days.length === 0) return null;
                    return (
                    <div className={`font-black uppercase text-xs tracking-[0.2em] flex items-center gap-2 ${
                      light ? "text-[#0c0b5d]/60" : "text-white/60"
                    }`}>
                      {days.join(" & ")} only
                    </div>
                    );
                  })()}
                </div>
              </div>

              <div className="w-full sm:w-64 md:w-80">
                <button 
                  className={`group/btn w-full py-4 px-6 rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-2xl flex items-center justify-center gap-3 ${
                    light 
                      ? "bg-[#0c0b5d] text-white hover:bg-[#FA6400]" 
                      : "bg-[#050426] text-white hover:bg-white hover:text-[#0c0b5d]"
                  }`}
                >
                  View more Discounts
                  <ChevronRight className="h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Right Discount Badge */}
            <div className="z-10 flex flex-col items-center justify-center md:pr-24 lg:pr-32">
              <div className="relative isolate">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-white/10 blur-[80px] rounded-full -z-10 animate-pulse" />
                
                {/* Discount Amount Display */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center pt-4 md:pt-8">
                    {currentPromo.discount.includes('RS.') ? (
                      <div className="flex flex-col items-center">
                        <div className="flex items-baseline gap-1 md:gap-2">
                          <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white/50">RS.</span>
                          <span className="text-[72px] sm:text-[100px] md:text-[140px] lg:text-[180px] font-black leading-none tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                            {currentPromo.discount.split(' ')[1]}
                          </span>
                        </div>
                        <span className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black tracking-[0.5em] -mt-3 md:-mt-6 text-white drop-shadow-md">OFF</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="flex items-start">
                          <span className="text-[80px] sm:text-[110px] md:text-[140px] lg:text-[200px] font-black leading-[0.8] tracking-tighter text-white drop-shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                            {currentPromo.discount.split('%')[0]}
                          </span>
                          <div className="flex flex-col pt-4 ml-1 md:pt-6 md:ml-2">
                            <span className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white">%</span>
                            <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-[0.2em] text-white/80 -mt-1 md:-mt-2">OFF</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Code Capsule */}
                  <div className="mt-8 md:mt-12 group/code relative cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(currentPromo.code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <div className="px-6 sm:px-10 py-3 rounded-full bg-white flex items-center gap-3 shadow-[0_15px_30px_rgba(0,0,0,0.2)] transition-all transform hover:scale-105 active:scale-95">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]/40">CODE:</span>
                      <span className="text-sm sm:text-base md:text-lg font-black uppercase tracking-[0.1em] text-[#0c0b5d]">
                        {currentPromo.code}
                      </span>
                      {copied && (
                        <motion.span 
                          initial={{ opacity: 0, x: 10 }} 
                          animate={{ opacity: 1, x: 0 }} 
                          className="text-[10px] font-bold text-green-500"
                        >
                          COPIED!
                        </motion.span>
                      )}
                    </div>
                  </div>

                  {/* Mobile pagination dots */}
                  {displayCodes.length > 1 && (
                    <div className="flex sm:hidden items-center gap-3 mt-6">
                      <button
                        onClick={() => paginate(-1)}
                        className={`flex items-center justify-center h-9 w-9 rounded-full border transition-all ${
                          light
                            ? "bg-[#0c0b5d]/10 border-[#0c0b5d]/20 text-[#0c0b5d]"
                            : "bg-white/10 border-white/20 text-white"
                        }`}
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                      </button>
                      <span className={`text-xs font-bold ${light ? "text-[#0c0b5d]/50" : "text-white/50"}`}>
                        {index + 1} / {displayCodes.length}
                      </span>
                      <button
                        onClick={() => paginate(1)}
                        className={`flex items-center justify-center h-9 w-9 rounded-full border transition-all ${
                          light
                            ? "bg-[#0c0b5d]/10 border-[#0c0b5d]/20 text-[#0c0b5d]"
                            : "bg-white/10 border-white/20 text-white"
                        }`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
