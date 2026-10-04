"use client";

import { useState, Suspense, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MembershipPackages from "@/components/home/MembershipPackages";
import MembershipRecapModal from "@/components/membership/MembershipRecapModal";
import { motion, AnimatePresence } from "framer-motion";
import {
  MembershipPlan,
  MembershipSubscription,
  TimeSlotAvailability,
} from "@/lib/api/membership";
import { PromoCode } from "@/lib/api/settings";
import {
  useAvailableTimeSlots,
  useMySubscription,
  useSettings,
  useSubscribe,
  useUpdateSubscription,
} from "@/lib/hooks";
import {
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
  Trophy,
  AlertCircle,
  Calendar,
  Loader2,
  Clock,
  Layers,
  CircleDashed,
  Award,
  Tag,
  X
} from "lucide-react";
import { toast } from "sonner";
import { formatTimeTo12h } from "@/lib/utils/time";

const getWeekdayFromYMD = (ymd: string): string => {
  // ymd is "YYYY-MM-DD" with no timezone. Use UTC for deterministic day-of-week.
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
};

const hhmmToMinutes = (time: string): number => {
  // time is "HH:mm"
  const [hh, mm] = time.split(":").map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
  return hh * 60 + mm;
};

const isTimeWithinPromoWindow = (slotStartTime: string, promoStart?: string, promoEnd?: string): boolean => {
  if (!promoStart || !promoEnd) return true; // no restriction
  const slotMin = hhmmToMinutes(slotStartTime);
  const startMin = hhmmToMinutes(promoStart);
  const endMin = hhmmToMinutes(promoEnd);
  if (!Number.isFinite(slotMin) || !Number.isFinite(startMin) || !Number.isFinite(endMin)) return false;

  // Inclusive both sides (e.g. 17:00 should match promo "17:00" as "between").
  return slotMin >= startMin && slotMin <= endMin;
};

function MembershipContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan");

  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan || "");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<string>("1_month");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [customPrice, setCustomPrice] = useState<number>(0);
  
  const [selectedStartDate, setSelectedStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [dynamicPlans, setDynamicPlans] = useState<MembershipPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoDiscountAmount, setPromoDiscountAmount] = useState(0);

  const { data: settingsData } = useSettings();
  const hasToken = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem("token"));
  }, []);

  const mySubscriptionQuery = useMySubscription({ enabled: hasToken });
  const availableTimeSlotsQuery = useAvailableTimeSlots({
    startDate: selectedStartDate,
  });
  const subscribeMutation = useSubscribe();

  const PROMO_CODES = useMemo(() => {
    if (!settingsData?.settings.promoCodes) return {};
    return settingsData.settings.promoCodes.reduce(
      (acc, promo) => {
        acc[promo.code.toUpperCase()] = promo;
        return acc;
      },
      {} as Record<string, PromoCode>
    );
  }, [settingsData]);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const promo = PROMO_CODES[code];
    if (promo) {
      if (promo.appliedTo !== "both" && promo.appliedTo !== "membership") {
        setPromoError("This promo code is for booking only.");
        return;
      }

      // Expiry validation (if configured)
      if (promo.expiryDate) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const expiry = new Date(promo.expiryDate);
        expiry.setUTCHours(0, 0, 0, 0);
        if (expiry < today) {
          setPromoError("This promo code has expired.");
          return;
        }
      }

      // Valid days validation (if configured)
      if (promo.validDays && promo.validDays.length > 0) {
        const weekday = getWeekdayFromYMD(selectedStartDate);
        const candidateDays = selectedDays.length > 0 ? selectedDays : weekday ? [weekday] : [];
        const hasMatch = candidateDays.some((d) => promo.validDays?.includes(d));
        if (!hasMatch) {
          setPromoError("This promo code is not valid for the selected day.");
          return;
        }
      }

      // Valid time window validation (if configured)
      if (promo.startTime && promo.endTime) {
        if (!selectedTimeSlot) {
          setPromoError("Please select a time slot before applying this promo.");
          return;
        }
        const selectedSlotStart = selectedTimeSlot.split("-")[0]?.trim();
        if (!selectedSlotStart || !isTimeWithinPromoWindow(selectedSlotStart, promo.startTime, promo.endTime)) {
          setPromoError("This promo code is not valid for the selected time slot.");
          return;
        }
      }

      const subtotal = customPrice || selectedTier?.price || 0;
      const disc = promo.type === "percent"
        ? Math.round((subtotal * promo.value) / 100)
        : Math.min(promo.value, subtotal);
      
      setAppliedPromo(code);
      setPromoDiscountAmount(disc);
      setPromoError("");
      setPromoInput("");
      setCustomPrice(subtotal - disc);
    } else {
      setPromoError("Invalid code");
      setAppliedPromo("");
      setPromoDiscountAmount(0);
    }
  };

  const removePromo = () => {
    const subtotal = (customPrice || 0) + promoDiscountAmount;
    setAppliedPromo("");
    setPromoDiscountAmount(0);
    setPromoInput("");
    setPromoError("");
    setCustomPrice(subtotal);
  };

  // Keep promo consistent when user changes schedule inputs.
  useEffect(() => {
    if (!appliedPromo) return;

    const promo = PROMO_CODES[appliedPromo.toUpperCase()];
    if (!promo) {
      removePromo();
      return;
    }

    if (promo.appliedTo !== "both" && promo.appliedTo !== "membership") {
      removePromo();
      return;
    }

    // Expiry validation (if configured)
    if (promo.expiryDate) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const expiry = new Date(promo.expiryDate);
      expiry.setUTCHours(0, 0, 0, 0);
      if (expiry < today) {
        removePromo();
        return;
      }
    }

    if (promo.validDays && promo.validDays.length > 0) {
      const weekday = getWeekdayFromYMD(selectedStartDate);
      const candidateDays = selectedDays.length > 0 ? selectedDays : weekday ? [weekday] : [];
      const hasMatch = candidateDays.some((d) => promo.validDays?.includes(d));
      if (!hasMatch) {
        removePromo();
        return;
      }
    }

    if (promo.startTime && promo.endTime) {
      if (!selectedTimeSlot) {
        removePromo();
        return;
      }
      const selectedSlotStart = selectedTimeSlot.split("-")[0]?.trim();
      if (!selectedSlotStart || !isTimeWithinPromoWindow(selectedSlotStart, promo.startTime, promo.endTime)) {
        removePromo();
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedPromo, selectedTimeSlot, selectedStartDate, selectedDays, PROMO_CODES]);

  const selectedTier = dynamicPlans.find(t => t.name === selectedPlan);

  useEffect(() => {
    setSelectedTimeSlot("");
  }, [selectedStartDate]);

  useEffect(() => {
    if (selectedTier) {
      if (selectedTier.pricingMatrix) {
        setSelectedDuration("1_month");
        setSelectedCategory("");
        setCustomPrice(0);
        setSelectedDays([]);
      } else {
        setCustomPrice(selectedTier.price);
        setSelectedDuration("1_month");
        setSelectedCategory("");
        setSelectedDays([]);
      }
      setSelectedTimeSlot("");
    }
  }, [selectedPlan, selectedTier]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : prev.length < 3 ? [...prev, day] : prev
    );
  };

  const handleSubscribe = async () => {
    if (!selectedTier) return;

    if (selectedTier.pricingMatrix && !selectedCategory) {
      toast.error("Please pick a pricing cell (Duration & Category)", {
        description: "Click a price box in the matrix to continue"
      });
      return;
    }

    if (selectedDuration === "3_days" && selectedDays.length !== 3) {
      toast.error("Please select exactly 3 training days", {
        description: "Choose 3 days from the weekly schedule"
      });
      return;
    }

    if (!selectedTimeSlot) {
      toast.error("Please select a training time slot", {
        description: "A fixed time slot is required"
      });
      return;
    }

    if (!hasToken) {
      toast.error("Login Required", {
        description: "Please login to enroll in a membership",
        action: { label: "Login", onClick: () => router.push("/login?redirect=/membership") }
      });
      return;
    }

    setIsProcessing(true);
    setError(null);

    const startDateObj = new Date(selectedStartDate);
    const endDateObj = new Date(startDateObj);
    const durationDays = selectedDuration === "3_months" ? 90 : 30;
    endDateObj.setDate(endDateObj.getDate() + durationDays);
    const formattedDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    try {
      const subscription = await subscribeMutation.mutateAsync({
        planId: selectedTier.id,
        timeSlot: selectedTimeSlot,
        startDate: selectedStartDate,
        chosenDuration: selectedDuration,
        chosenCategory: selectedCategory,
        totalPrice: customPrice,
        chosenDays: selectedDays,
        promoCode: appliedPromo || undefined,
      });

      // Client-side membership should not use admin payment settlement UI.
      // Keep the normal enroll flow and show a success/pending message.
      setIsRecapModalOpen(false);

      const startDateObj = new Date(subscription.startDate);
      const endDateObj = new Date(subscription.endDate);
      const formattedDate = (d: Date | string) => {
        const date = typeof d === "string" ? new Date(d) : d;
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      };

      setSuccessMessage(
        `Membership request submitted! Reserved slot: ${subscription.timeSlot} (${formattedDate(startDateObj)} - ${formattedDate(endDateObj)}). Your plan will be activated after payment verification by admin.`
      );

      setSelectedPlan("");
      setSelectedTimeSlot("");
      setSelectedDays([]);

      toast.success("Membership submitted successfully!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Enrollment failed. Try again.";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const availableTimeSlots: TimeSlotAvailability[] =
    availableTimeSlotsQuery.data || [];

  const filteredSlots = availableTimeSlots.filter(s => {
    const hour = parseInt(s.slot.split(':')[0]);
    // Global 4 PM - 8 PM restriction for all memberships
    const peakHours = [16, 17, 18, 19];
    if (peakHours.includes(hour)) return false;

    if (selectedTier?.pricingMatrix) {
       if (selectedCategory === "morning") return hour >= 5 && hour < 11;
       if (selectedCategory === "day") return hour >= 11 && hour < 16;
       if (selectedCategory === "evening") return hour === 20;
    }
    return true;
  });

  const durationLabel = selectedDuration === "3_days" ? "per month (3 days/week)" : selectedDuration === "3_months" ? "per 3 months" : "per month";

  return (
    <div className="relative isolate min-h-screen w-full bg-[#0c0b5d]/2 flex flex-col font-sans">
      <Navbar />

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-16 sm:pb-32">
        <div className="flex flex-col gap-8 sm:gap-12 md:gap-16">
          <AnimatePresence>
          {/* Success banner removed in favor of modal success screen */}

          </AnimatePresence>

          {/* Active Subscription Banner */}
          {!mySubscriptionQuery.isLoading && mySubscriptionQuery.data && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0c0b5d] rounded-3xl sm:rounded-[48px] p-1 shadow-2xl overflow-hidden group">
                <div className="bg-white/5 backdrop-blur-xl p-5 sm:p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8 md:gap-10 border border-white/10 rounded-[28px] sm:rounded-[44px]">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                       <div className="px-3 sm:px-4 py-1 sm:py-1.5 bg-green-500 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-green-500/20 animate-pulse">Active Status</div>
                       <div className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">ID: {mySubscriptionQuery.data.id.slice(0,8)}</div>
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-none">{mySubscriptionQuery.data.plan.name} <span className="text-[#FA6400]">Elite</span></h2>
                    <div className="flex flex-wrap gap-2 sm:gap-4 pt-2">
                       {mySubscriptionQuery.data.timeSlot && (
                         <div className="flex items-center gap-2 bg-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl">
                           <Clock size={14} className="text-[#FA6400] sm:w-4 sm:h-4" />
                           <span className="text-xs sm:text-sm font-bold text-white/80">{formatTimeTo12h(mySubscriptionQuery.data.timeSlot || "")}</span>
                         </div>
                       )}
                       <div className="flex items-center gap-2 bg-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl">
                         <Calendar size={14} className="text-[#FA6400] sm:w-4 sm:h-4" />
                         <span className="text-xs sm:text-sm font-bold text-white/80">Expires {new Date(mySubscriptionQuery.data.endDate).toLocaleDateString()}</span>
                       </div>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                     <span className="text-4xl sm:text-5xl md:text-6xl font-black text-white italic tracking-tighter">Rs. {(mySubscriptionQuery.data.totalPrice || mySubscriptionQuery.data.plan.price).toLocaleString()}</span>
                     <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-widest mt-1">Paid {mySubscriptionQuery.data.chosenDuration === "3_months" ? "Quarterly" : "Monthly"}</p>
                  </div>
                </div>
             </motion.div>
          )}

          <div className="flex flex-col gap-4 sm:gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 sm:gap-3">
               <div className="w-1 sm:w-1.5 h-8 sm:h-10 bg-[#FA6400] rounded-full" />
               <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black text-[#0c0b5d] uppercase italic tracking-tighter leading-none">
                 Member <span className="text-[#FA6400]">Elite</span>
               </h1>
            </motion.div>
            <p className="text-base sm:text-lg md:text-xl font-medium text-slate-500 max-w-2xl leading-relaxed">
               {mySubscriptionQuery.data ? "Your arena access is secured. View your profile for match history and rewards." : "Unlock standard venue access with dynamic pricing and dedicated time slots."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:gap-12">
            <div className="w-full flex flex-col gap-8 sm:gap-12">
              <section className="bg-white rounded-3xl sm:rounded-[48px] p-5 sm:p-8 md:p-10 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Trophy size={80} className="sm:w-[120px] sm:h-[120px]" /></div>
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 md:mb-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#0c0b5d] text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20"><Layers size={20} className="sm:w-6 sm:h-6" /></div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-black text-[#0c0b5d] uppercase italic tracking-tight">Pick Your Package</h3>
                </div>
                
                <MembershipPackages 
                  light={true} 
                  compact={true} 
                  selectedPlan={mySubscriptionQuery.data ? mySubscriptionQuery.data.plan.name : selectedPlan}
                  enrolledPlanName={mySubscriptionQuery.data ? mySubscriptionQuery.data.plan.name : undefined}
                  onSelect={mySubscriptionQuery.data ? undefined : (plan) => {
                    setSelectedPlan(plan.name);
                    setIsRecapModalOpen(true);
                  }}
                  onPlansLoaded={setDynamicPlans}
                />
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Recap Modal */}
      <MembershipRecapModal
        isOpen={isRecapModalOpen}
        onClose={() => setIsRecapModalOpen(false)}
        selectedTier={selectedTier}
        selectedDuration={selectedDuration}
        selectedCategory={selectedCategory}
        selectedTimeSlot={selectedTimeSlot}
        selectedDays={selectedDays}
        selectedStartDate={selectedStartDate}
        customPrice={customPrice}
        promoInput={promoInput}
        setPromoInput={setPromoInput}
        appliedPromo={appliedPromo}
        promoError={promoError}
        promoDiscountAmount={promoDiscountAmount}
        applyPromo={applyPromo}
        removePromo={removePromo}
        isProcessing={isProcessing || subscribeMutation.isPending}
        handleSubscribe={handleSubscribe}
        activeSubscription={mySubscriptionQuery.data || null}
        filteredSlots={filteredSlots}
        loadingTimeSlots={availableTimeSlotsQuery.isLoading || availableTimeSlotsQuery.isFetching}
        setSelectedTimeSlot={setSelectedTimeSlot}
        setSelectedStartDate={setSelectedStartDate}
        toggleDay={toggleDay}
        setSelectedDuration={setSelectedDuration}
        setSelectedCategory={setSelectedCategory}
        setCustomPrice={setCustomPrice}
        successMessage={successMessage}
        setSuccessMessage={setSuccessMessage}
      />

      <Footer />
    </div>
  );
}

export default function MembershipPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center bg-[#0c0b5d]"><CircleDashed className="animate-spin text-white" size={48} /></div>}>
      <MembershipContent />
    </Suspense>
  );
}
