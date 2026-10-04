"use client";

import { useState, Suspense, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronRight,
  Tag,
  CheckCircle2,
  Plus,
  X,
  Timer,
} from "lucide-react";
import { motion } from "framer-motion";
import { PromoCode, HourlyPricingSlot } from "@/lib/api/settings";
import { useAvailableSlots, useCreateBooking, useSettings, useMe } from "@/lib/hooks";
import { toast } from "sonner";
import { formatTimeTo12h } from "@/lib/utils/time";

const toLocalDateString = (date: Date): string => {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().split("T")[0];
};

const normalizeDateForApi = (date: string): string => {
  if (!date) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (date.includes("T")) return date.split("T")[0];

  return "";
};

const normalizeTimeForCompare = (time: string): string => {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;

  const hour = String(Number(match[1])).padStart(2, "0");
  const minute = match[2];
  return `${hour}:${minute}`;
};

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

const isTimeWithinPromoWindow = (
  slotStartTime: string,
  promoStart?: string,
  promoEnd?: string,
): boolean => {
  if (!promoStart || !promoEnd) return true; // no restriction
  const slotMin = hhmmToMinutes(slotStartTime);
  const startMin = hhmmToMinutes(promoStart);
  const endMin = hhmmToMinutes(promoEnd);
  if (
    !Number.isFinite(slotMin) ||
    !Number.isFinite(startMin) ||
    !Number.isFinite(endMin)
  )
    return false;

  // Inclusive both sides (e.g. 17:00 should match promo "17:00" as "between").
  return slotMin >= startMin && slotMin <= endMin;
};

// Default time slots fallback (6 AM to 10 PM)
const DEFAULT_TIME_SLOTS = [
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTime = searchParams.get("time");

  const [selectedDate, setSelectedDate] = useState(
    toLocalDateString(new Date()),
  );
  const [selectedTimes, setSelectedTimes] = useState<string[]>(
    initialTime ? [initialTime] : [],
  );

  const selectedDuration = selectedTimes.length;
  const selectedTime = useMemo(() => {
    if (selectedTimes.length === 0) return "";
    return [...selectedTimes].sort()[0];
  }, [selectedTimes]);

  // Advance booking: open a calendar modal to pick any date.
  const [isAdvanceBookingOpen, setIsAdvanceBookingOpen] = useState(false);
  const [advanceBookingDate, setAdvanceBookingDate] = useState<string>("");

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [promoError, setPromoError] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [useFreeMatch, setUseFreeMatch] = useState(false);
  // Only venue payment is supported
  const paymentMethod = "venue" as const;

  // Fetch user to check freeMatchesAvailable
  const { data: user } = useMe();

  // Booking state
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // TanStack Query: Fetch settings (cached for 5 minutes)
  const { data: settingsData, isLoading: isLoadingSettings } = useSettings();

  // TanStack Query: Fetch available slots (cached, auto-refetch on date/duration change)
  const normalizedDate = normalizeDateForApi(selectedDate);
  const {
    data: availableSlotsRaw,
    isLoading: isLoadingSlots,
    isError: hasSlotsFetchError,
    isFetched: hasLoadedSlots,
  } = useAvailableSlots(normalizedDate, 1, !!normalizedDate);

  // Memoized derived values from settings
  const TIMES = useMemo(
    () => settingsData?.settings.timeSlots || DEFAULT_TIME_SLOTS,
    [settingsData],
  );

  const hourlyRate = settingsData?.settings.hourlyRate || 45;
  const hourlyPricing = settingsData?.settings.hourlyPricing || [];
  const ADVANCE_DEPOSIT = settingsData?.settings.advanceDeposit || 500;

  const PROMO_CODES = useMemo(() => {
    if (!settingsData?.settings.promoCodes) return {};
    return settingsData.settings.promoCodes.reduce(
      (acc, promo) => {
        acc[promo.code.toUpperCase()] = promo;
        return acc;
      },
      {} as Record<string, PromoCode>,
    );
  }, [settingsData]);

  // Normalize available slots for comparison
  const availableSlots = useMemo(
    () => (availableSlotsRaw || []).map(normalizeTimeForCompare),
    [availableSlotsRaw],
  );

  // Get price for a specific time slot from hourly pricing
  const getPriceForSlot = (timeSlot: string): number => {
    if (hourlyPricing.length === 0) {
      return hourlyRate; // Fallback to default hourly rate
    }

    // Extract hour from time slot (e.g., "06:00" -> 6)
    const hour = parseInt(timeSlot.split(":")[0], 10);

    // Find the matching pricing slot
    const pricingSlot = hourlyPricing.find((slot) => {
      const slotHour = parseInt(slot.id.replace("ts-", ""), 10);
      return slotHour === hour;
    });

    return pricingSlot?.price || hourlyRate;
  };

  // Calculate total price for selected time slot and duration
  const calculateBasePrice = (): number => {
    if (selectedTimes.length === 0) return 0;
    
    return selectedTimes.reduce((total, time) => {
      return total + getPriceForSlot(time);
    }, 0);
  };

  const basePrice = calculateBasePrice();
  const subtotal = basePrice;
  const totalPrice = useFreeMatch ? 0 : Math.max(0, subtotal - discountAmount);

  // Compute end time string for display (12h)
  const getEndTime = (startTime: string, duration: number): string => {
    const [h] = startTime.split(":").map(Number);
    const endH = h + duration;
    const normalizedEndH = endH % 24;
    return formatTimeTo12h(`${normalizedEndH.toString().padStart(2, "0")}:00`);
  };

  // A time slot is unavailable if it's not in the available slots list from API
  // OR if it's in the past for today's date
  const isSlotUnavailable = (time: string): boolean => {
    if (!hasLoadedSlots || isLoadingSlots) return false; // Allow selection while availability is loading
    if (hasSlotsFetchError) return false; // Keep slots selectable when availability check fails

    // Check if the slot has already passed for today
    const today = toLocalDateString(new Date());
    if (selectedDate === today) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const [slotHour] = time.split(":").map(Number);

      // If the slot hour has passed, or it's the current hour but minutes have passed
      if (
        slotHour < currentHour ||
        (slotHour === currentHour && currentMinute > 0)
      ) {
        return true; // Slot is in the past
      }
    }

    return !availableSlots.includes(normalizeTimeForCompare(time));
  };

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const promo = PROMO_CODES[code];
    if (promo) {
      // Check target type (booking vs membership)
      if (promo.appliedTo !== "both" && promo.appliedTo !== "booking") {
        setPromoError("This promo code is for membership only.");
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
        const weekday = getWeekdayFromYMD(selectedDate);
        if (!weekday || !promo.validDays.includes(weekday)) {
          setPromoError("This promo code is not valid for the selected day.");
          return;
        }
      }

      // Valid time window validation (if configured)
      if (promo.startTime && promo.endTime) {
        if (!selectedTime) {
          setPromoError(
            "Please select a time slot before applying this promo.",
          );
          return;
        }
        if (
          !isTimeWithinPromoWindow(selectedTime, promo.startTime, promo.endTime)
        ) {
          setPromoError(
            "This promo code is not valid for the selected time slot.",
          );
          return;
        }
      }

      const disc =
        promo.type === "percent"
          ? Math.round((subtotal * promo.value) / 100)
          : Math.min(promo.value, subtotal);
      setAppliedPromo(code);
      setDiscountAmount(disc);
      setPromoError("");
      setPromoInput("");
    } else {
      setPromoError("Invalid promo code. Please check and try again.");
      setAppliedPromo("");
      setDiscountAmount(0);
    }
  };

  const removePromo = () => {
    setAppliedPromo("");
    setDiscountAmount(0);
    setPromoInput("");
    setPromoError("");
  };

  // Keep promo + discount consistent when user changes selected date/time.
  useEffect(() => {
    if (!appliedPromo) return;

    const promo = PROMO_CODES[appliedPromo.toUpperCase()];
    if (!promo) {
      removePromo();
      return;
    }

    // If promo target is no longer compatible, remove it.
    if (promo.appliedTo !== "both" && promo.appliedTo !== "booking") {
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
      const weekday = getWeekdayFromYMD(selectedDate);
      if (!weekday || !promo.validDays.includes(weekday)) {
        removePromo();
        return;
      }
    }

    if (promo.startTime && promo.endTime) {
      if (!selectedTime) {
        removePromo();
        return;
      }
      if (
        !isTimeWithinPromoWindow(selectedTime, promo.startTime, promo.endTime)
      ) {
        removePromo();
        return;
      }
    }

    // Recompute discount based on current subtotal (time/duration changes base price).
    const disc =
      promo.type === "percent"
        ? Math.round((subtotal * promo.value) / 100)
        : Math.min(promo.value, subtotal);
    setDiscountAmount(disc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedPromo,
    selectedDate,
    selectedTimes,
    subtotal,
    PROMO_CODES,
  ]);

  const toggleSlot = (time: string) => {
    if (useFreeMatch) {
      // Force single slot selection when using free match
      if (!selectedTimes.includes(time)) {
        setSelectedTimes([time]);
      } else {
        setSelectedTimes([]);
      }
      return;
    }

    if (selectedTimes.includes(time)) {
      // Removing a slot
      if (selectedTimes.length === 1) {
        setSelectedTimes([]);
      } else {
        const sorted = [...selectedTimes].sort();
        // If it's the start or end, just remove it
        if (time === sorted[0] || time === sorted[sorted.length - 1]) {
          setSelectedTimes(selectedTimes.filter((t) => t !== time));
        } else {
          // If it's in the middle, start a new selection from this one
          setSelectedTimes([time]);
        }
      }
    } else {
      // Adding a slot
      if (selectedTimes.length === 0) {
        setSelectedTimes([time]);
      } else {
        const sorted = [...selectedTimes].sort();
        const minTime = sorted[0];
        const maxTime = sorted[sorted.length - 1];

        const minMin = hhmmToMinutes(minTime);
        const maxMin = hhmmToMinutes(maxTime);
        const clickedMin = hhmmToMinutes(time);

        // Check if adjacent
        if (clickedMin === minMin - 60 || clickedMin === maxMin + 60) {
          setSelectedTimes([...selectedTimes, time]);
        } else {
          // Not adjacent, start new selection
          setSelectedTimes([time]);
        }
      }
    }
  };

  // TanStack Query mutation for creating booking
  const createBookingMutation = useCreateBooking();

  const handleBooking = () => {
    // Check if user is logged in first
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast.error("Please login to book a slot", {
        description: "You need to be logged in to make a booking",
        action: {
          label: "Login",
          onClick: () => router.push("/login?redirect=/booking"),
        },
      });
      return;
    }

    if (selectedTimes.length === 0) {
      toast.warning("Please select at least one time slot", {
        description: "Choose available time slots to proceed with booking",
      });
      return;
    }

    // Double check availability (redundant with backend but good for safety)
    const unavailableSlots = selectedTimes.filter(t => !availableSlots.includes(normalizeTimeForCompare(t)));
    if (unavailableSlots.length > 0) {
      toast.error("Some slots are unavailable", {
        description: "One or more of your selected slots are no longer available.",
      });
      return;
    }

    setBookingError("");
    setBookingSuccess(false);

    const bookingDate = normalizeDateForApi(selectedDate);
    if (!bookingDate) {
      setBookingError("Invalid date format. Please select date again.");
      return;
    }

    // Get user details for fallback if needed
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    let userInfo = null;
    if (storedUser) {
      try {
        userInfo = JSON.parse(storedUser);
      } catch (err) {
        console.error("Failed to parse stored user", err);
      }
    }

    createBookingMutation.mutate(
      {
        date: bookingDate,
        startTime: selectedTime,
        duration: selectedDuration,
        promoCode: appliedPromo || undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        paymentMethod: paymentMethod,
        customerName: userInfo?.name,
        customerPhone: userInfo?.phoneNumber,
        customerEmail: userInfo?.email,
        useFreeMatch: useFreeMatch,
      },
      {
        onSuccess: (booking) => {
          setBookingSuccess(true);
          // Redirect to success page
          setTimeout(() => {
            router.push(`/booking/success?id=${booking.id}`);
          }, 1500);
        },
        onError: (error) => {
          console.error("Booking error:", error);

          // Handle authentication/user errors
          if (
            error instanceof Error &&
            (error.message.includes("User not found") ||
              error.message.includes("Invalid token") ||
              error.message.includes("No token provided") ||
              error.message.includes("Unauthorized"))
          ) {
            // Clear invalid token
            if (typeof window !== "undefined") {
              localStorage.removeItem("token");
              localStorage.removeItem("refreshToken");
              localStorage.removeItem("user");
            }
            // Show login toast
            toast.error("Please login to book a slot", {
              description: "Your session has expired. Please log in again.",
              action: {
                label: "Login",
                onClick: () => router.push("/login?redirect=/booking"),
              },
            });
          } else {
            setBookingError(
              error instanceof Error
                ? error.message
                : "Failed to create booking. Please try again.",
            );
          }
        },
      },
    );
  };

  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
      <Navbar />

      {isLoadingSettings ? (
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 pt-32 pb-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 border-4 border-[#0c0b5d]/10 border-t-[#0c0b5d] rounded-full animate-spin" />
            <p className="text-lg font-bold text-slate-500">
              Loading booking options...
            </p>
          </div>
        </main>
      ) : (
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 pt-32 pb-20">
          <div className="flex flex-col gap-12">
            {/* Header */}
            <div className="flex flex-col gap-4 text-center md:text-left">
              <h1 className="text-5xl font-black text-[#0c0b5d] uppercase tracking-tighter md:text-7xl">
                Book Your <span className="text-[#FA6400]">Match</span>
              </h1>
              <p className="text-xl font-medium text-slate-500 max-w-2xl">
                Choose your preferred date and time for your game. Elite quality
                pitch, state-of-the-art lighting.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Left Column */}
              <div className="lg:col-span-2 flex flex-col gap-10">
                {/* Date Selection */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-8 border border-white shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#0c0b5d]">
                      <CalendarIcon size={20} />
                    </div>
                    <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-wide">
                      1. Select Date
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                      const date = new Date();
                      date.setDate(date.getDate() + offset);
                      const iso = toLocalDateString(date);
                      const isSelected = selectedDate === iso;
                      return (
                        <button
                          key={iso}
                          onClick={() => {
                            setSelectedDate(iso);
                            setSelectedTimes([]);
                          }}
                          className={`flex flex-col items-center justify-center w-20 h-24 rounded-2xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0c0b5d] border-[#0c0b5d] text-white shadow-xl scale-105"
                              : "bg-white border-slate-100 text-slate-400 hover:border-blue-200"
                          }`}
                        >
                          <span className="text-[10px] uppercase font-black tracking-widest mb-1">
                            {date.toLocaleDateString("en-US", {
                              weekday: "short",
                            })}
                          </span>
                          <span className="text-2xl font-black">
                            {date.getDate()}
                          </span>
                        </button>
                      );
                    })}

                    {/* Advance booking entrypoint */}
                    <button
                      type="button"
                      aria-label="Choose another date"
                      onClick={() => {
                        setAdvanceBookingDate(selectedDate);
                        setIsAdvanceBookingOpen(true);
                      }}
                      className="flex flex-col items-center justify-center w-20 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-white hover:border-blue-200 cursor-pointer transition-all"
                    >
                      <Plus size={20} className="text-[#0c0b5d]" />
                    </button>
                  </div>
                </div>



                {/* Time Selection */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-8 border border-white shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#FA6400]">
                      <Clock size={20} />
                    </div>
                    <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-wide">
                      2. Select Time Slots
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {TIMES.map((time) => {
                      const isSelected = selectedTimes.includes(time);
                      const isBooked = isSlotUnavailable(time);
                      const slotPrice = getPriceForSlot(time);
                      return (
                        <button
                          key={time}
                          disabled={isBooked}
                          onClick={() => toggleSlot(time)}
                          className={`py-3 px-1 rounded-2xl border-2 font-black transition-all cursor-pointer flex flex-col items-center gap-0.5 min-w-[70px] ${
                            isBooked
                              ? "bg-slate-50 border-slate-50 text-slate-300 cursor-not-allowed opacity-60"
                              : isSelected
                                ? "bg-[#FA6400] border-[#FA6400] text-white shadow-xl scale-105"
                                : "bg-white border-slate-100 text-[#0c0b5d]/80 hover:border-orange-200"
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center leading-none">
                            <span className="text-sm font-black">
                              {formatTimeTo12h(time)}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold mt-1 ${
                              isBooked
                                ? "text-slate-200"
                                : isSelected
                                  ? "text-white/80"
                                  : "text-slate-400"
                            }`}
                          >
                            Rs. {slotPrice.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Booking Summary */}
              <div className="lg:col-span-1">
                <div className="sticky top-32 flex flex-col gap-6">
                  <div className="bg-[#0c0b5d] rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 blur-3xl rounded-full" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#FA6400]/20 blur-3xl rounded-full" />

                    <h4 className="text-xl font-black uppercase tracking-widest mb-8 pb-4 border-b border-white/10">
                      Booking Summary
                    </h4>

                    <div className="flex flex-col gap-5 mb-8">
                      <div className="flex flex-col">
                        <span className="text-xs uppercase font-black text-white/40 tracking-[0.2em] mb-1">
                          Date & Time
                        </span>
                        <span className="font-bold">
                          {selectedTime
                            ? `${selectedDate} @ ${formatTimeTo12h(selectedTime)} – ${getEndTime(selectedTime, selectedDuration)}`
                            : selectedDate || "Not selected"}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs uppercase font-black text-white/40 tracking-[0.2em] mb-1">
                          Duration
                        </span>
                        <span className="font-bold">
                          {selectedDuration}{" "}
                          {selectedDuration === 1 ? "Hour" : "Hours"}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">
                            Pitch Fee ({selectedDuration}{" "}
                            {selectedDuration === 1 ? "hr" : "hrs"})
                          </span>
                          <span className="font-bold">Rs. {basePrice}</span>
                        </div>
                        {discountAmount > 0 && !useFreeMatch && (
                          <div className="flex justify-between text-sm">
                            <span className="text-green-400 font-bold">
                              Promo ({appliedPromo})
                            </span>
                            <span className="font-bold text-green-400">
                              − Rs. {discountAmount}
                            </span>
                          </div>
                        )}
                        {useFreeMatch && (
                          <div className="flex justify-between text-sm">
                            <span className="text-orange-400 font-bold">
                              Free Match Applied
                            </span>
                            <span className="font-bold text-orange-400">
                              − Rs. {basePrice}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(user?.freeMatchesAvailable ?? 0) > 0 && (
                      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 to-orange-400/10 border border-orange-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
                            <Tag size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-orange-400 uppercase tracking-wide">
                              🎁 Free Match Available
                            </span>
                            <span className="text-[10px] text-white/60">
                              Valid for a 1-hour slot
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (!useFreeMatch && selectedTimes.length > 1) {
                              toast.warning("Reduced to 1 hour", {
                                description: "Free matches can only be applied to a 1-hour slot."
                              });
                              setSelectedTimes([selectedTimes[0]]);
                            }
                            setUseFreeMatch(!useFreeMatch);
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${useFreeMatch ? 'bg-orange-500' : 'bg-white/20'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${useFreeMatch ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    )}

                    <div className="flex justify-between items-end mb-6 pt-4 border-t border-white/10">
                      <span className="text-xs uppercase font-black text-white/40 tracking-[0.2em]">
                        Total
                      </span>
                      <span className="text-4xl font-black">
                        Rs. {totalPrice}
                      </span>
                    </div>

                    {/* Payment Method - Cash at Venue Only */}
                    <div className="flex flex-col gap-4 mb-8">
                      <span className="text-xs uppercase font-black text-white/40 tracking-[0.2em]">
                        Payment Method
                      </span>
                      <div className="bg-white/10 rounded-2xl p-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-[#FA6400]"></div>
                          <span className="font-black text-white uppercase tracking-tighter text-sm">
                            Cash at Venue
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/60 font-black">
                            Amount Due at Venue
                          </span>
                          <span className="font-black text-white">
                            Rs. {totalPrice}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 leading-tight mt-1 italic">
                          * Your booking will be pending until confirmed by
                          admin.
                        </p>
                      </div>
                    </div>

                    {/* Promo code input */}
                    <div className="mb-6">
                      {appliedPromo ? (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between bg-green-500/20 border border-green-400/40 rounded-2xl px-4 py-3"
                        >
                          <div className="flex items-center gap-2">
                            <Tag size={14} className="text-green-400" />
                            <span className="text-sm font-black text-green-400 uppercase tracking-widest">
                              {appliedPromo}
                            </span>
                            <span className="text-xs text-green-400/70">
                              applied
                            </span>
                          </div>
                          <button
                            onClick={removePromo}
                            className="text-white/40 hover:text-white transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={promoInput}
                              onChange={(e) => {
                                setPromoInput(e.target.value);
                                setPromoError("");
                              }}
                              onKeyDown={(e) =>
                                e.key === "Enter" && applyPromo()
                              }
                              placeholder="Promo / Voucher code"
                              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-2 py-3 text-sm font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 transition-colors uppercase tracking-wider"
                            />
                            <button
                              onClick={applyPromo}
                              className="bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl px-2 py-3 text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                            >
                              Apply
                            </button>
                          </div>
                          {promoError && (
                            <p className="text-red-400 text-xs font-bold px-1">
                              {promoError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Error and Success Messages */}
                    {bookingError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/20 border border-red-400/40 rounded-2xl px-4 py-3 mb-4"
                      >
                        <p className="text-red-400 text-sm font-bold">
                          {bookingError}
                        </p>
                      </motion.div>
                    )}

                    {bookingSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-500/20 border border-green-400/40 rounded-2xl px-4 py-3 mb-4"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-400" />
                          <p className="text-green-400 text-sm font-bold">
                            Booking confirmed! Redirecting...
                          </p>
                        </div>
                      </motion.div>
                    )}

                    <button
                      disabled={createBookingMutation.isPending}
                      onClick={handleBooking}
                      className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                        createBookingMutation.isPending
                          ? "bg-[#FA6400]/60 text-white/40 cursor-not-allowed"
                          : "bg-[#FA6400] text-white hover:bg-[#d45400] hover:scale-[1.02] active:scale-95 shadow-[0_8px_32px_rgba(250,100,0,0.4)] hover:shadow-[0_8px_40px_rgba(212,85,0,0.55)]"
                      }`}
                    >
                      {createBookingMutation.isPending ? (
                        <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Confirm Booking <ChevronRight size={18} />
                        </>
                      )}
                    </button>

                    {!selectedTime && (
                      <p className="mt-4 text-center text-xs font-bold text-white/30 animate-pulse">
                        Select a time slot to continue
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      <Footer />

      {/* Advance booking modal */}
      {isAdvanceBookingOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsAdvanceBookingOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative z-[70] w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-[#0c0b5d]" />
                <h4 className="text-base sm:text-lg font-black text-[#0c0b5d] uppercase tracking-wide">
                  Choose Date
                </h4>
              </div>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                onClick={() => setIsAdvanceBookingOpen(false)}
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>

            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Date
            </label>
            <input
              type="date"
              value={advanceBookingDate}
              min={toLocalDateString(new Date())}
              onChange={(e) => setAdvanceBookingDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none"
            />

            <div className="flex gap-3 pt-6 border-t border-slate-50 mt-6">
              <button
                type="button"
                onClick={() => setIsAdvanceBookingOpen(false)}
                className="flex-1 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!advanceBookingDate) return;
                  setSelectedDate(advanceBookingDate);
                  setSelectedTimes([]);
                  setIsAdvanceBookingOpen(false);
                }}
                className="flex-1 bg-[#FA6400] text-white font-black uppercase tracking-[0.15em] text-[10px] py-4 rounded-2xl hover:scale-[1.02] shadow-xl shadow-orange-500/20 transition-all cursor-pointer"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
          <div className="h-12 w-12 border-4 border-[#0c0b5d]/10 border-t-[#0c0b5d] rounded-full animate-spin" />
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}
