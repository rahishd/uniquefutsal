"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  Check,
  Ban,
  CheckCircle2,
  Settings,
  Eye,
  Trophy
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { formatTimeTo12h } from "@/lib/utils/time";
import { Booking } from "@/lib/api/bookings";
import { HourlyPricingSlot } from "@/lib/api/settings";
import {
  useCreateBooking,
  useOccupancy,
  useSearchPlayers,
  useSettings,
  useUpdateBooking,
} from "@/lib/hooks";
import { useVerifyPayment, useDeleteSubscription } from "@/lib/hooks/membership";
import { toast } from "sonner";
import Link from "next/link";
import { SmsConfirmModal } from "@/components/sms-confirm-modal";

// Timeline from 5 AM to 10 PM
const HOURS = Array.from({ length: 17 }, (_, i) => {
  const h = i + 5;
  return `${h.toString().padStart(2, "0")}:00`;
});

export default function ViewSlotsPage() {
  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const searchParams = useSearchParams();
  const urlDate = searchParams.get('date');
  const highlightId = searchParams.get('highlight');

  const [selectedDate, setSelectedDate] = useState(urlDate || getLocalDateString());
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightId);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [newBookingData, setNewBookingData] = useState({
    customerName: "",
    customerPhone: "",
    startTime: "",
    duration: 1,
    paymentMethod: "venue" as "venue" | "advance" | "full",
    totalPrice: 0,
    loyaltyEnabled: true
  });

  // Manual booking: player autocomplete
  const [playerQuery, setPlayerQuery] = useState("");
  const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<"name" | "phone">("name");
  const lastPlayerSearchErrorAt = useRef<number>(0);
  const manualBookingFormRef = useRef<HTMLDivElement | null>(null);
  const deferredPlayerQuery = useDeferredValue(playerQuery.trim());

  const settingsQuery = useSettings();
  const occupancyQuery = useOccupancy({
    date: selectedDate,
    refetchIntervalMs: 10_000,
  });
  const updateBookingMutation = useUpdateBooking();
  const createBookingMutation = useCreateBooking();
  const verifyMembershipMutation = useVerifyPayment();
  const deleteMembershipMutation = useDeleteSubscription();

  const pricing: HourlyPricingSlot[] =
    settingsQuery.data?.settings.hourlyPricing || [];

  const bookings: Booking[] = useMemo(() => {
    const all = occupancyQuery.data?.bookings || [];
    return all.filter((b) => !b.status.startsWith("cancelled"));
  }, [occupancyQuery.data?.bookings]);

  const memberships = occupancyQuery.data?.memberships || [];
  const tournaments = occupancyQuery.data?.tournaments || [];

  const playerSearchQuery = useSearchPlayers({
    query: deferredPlayerQuery,
    enabled:
      isBookingModalOpen && showPlayerSuggestions && deferredPlayerQuery.length > 0,
  });

  const [smsConfirmModal, setSmsConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: (sendSms: boolean) => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => { },
  });

  const [selectedBookingForActions, setSelectedBookingForActions] = useState<any | null>(null);

  const handleVerifyPayment = async (bookingId: string) => {
    const membershipId = bookingId.replace("mem-", "");
    setSmsConfirmModal({
      isOpen: true,
      title: "Activate Membership",
      description: "Do you want to send an SMS activation message to the player?",
      onConfirm: async (sendSms) => {
        try {
          await verifyMembershipMutation.mutateAsync({ subscriptionId: membershipId, sendSms });
          toast.success("Membership activated!");
          occupancyQuery.refetch();
        } catch (err) {
          console.error("Error verifying membership:", err);
          toast.error("Failed to verify membership");
        }
      }
    });
  };

  const handleRejectMembership = async (bookingId: string) => {
    const membershipId = bookingId.replace("mem-", "");
    setSmsConfirmModal({
      isOpen: true,
      title: "Reject Membership",
      description: "Are you sure you want to reject this membership subscription? This will remove it from the system.",
      onConfirm: async () => {
        try {
          await deleteMembershipMutation.mutateAsync(membershipId);
          toast.success("Membership rejected!");
          occupancyQuery.refetch();
        } catch (err) {
          console.error("Error rejecting membership:", err);
          toast.error("Failed to reject membership");
        }
      }
    });
  };

  const handleToggleLoyalty = async (booking: any) => {
    try {
      await updateBookingMutation.mutateAsync({
        id: booking.id,
        updates: { loyaltyEnabled: !booking.loyaltyEnabled },
      });
      toast.success("Loyalty setting updated!");
      occupancyQuery.refetch();
    } catch (err) {
      toast.error("Failed to update loyalty setting");
    }
  };

  const handleStatusUpdate = async (
    bookingId: string,
    newStatus: "pending" | "confirmed" | "cancelled" | "completed"
  ) => {
    // If it's a membership reservation
    if (bookingId.startsWith("mem-")) {
      if (newStatus === "confirmed") {
        handleVerifyPayment(bookingId);
      } else if (newStatus === "cancelled") {
        handleRejectMembership(bookingId);
      }
      return;
    }

    setSmsConfirmModal({
      isOpen: true,
      title: newStatus === "confirmed" ? "Confirm Booking" : "Update Booking",
      description: `Do you want to send a ${newStatus === "confirmed" ? "confirmation" : "status update"} SMS to the player?`,
      onConfirm: async (sendSms) => {
        try {
          await updateBookingMutation.mutateAsync({
            id: bookingId,
            updates: { status: newStatus, sendSms },
          });
          toast.success(
            `Booking ${newStatus === "confirmed" ? "confirmed" : "updated"} successfully!`,
          );
        } catch (err) {
          console.error("Error updating booking:", err);
          toast.error("Failed to update booking status");
        }
      }
    });
  };

  const handleManualBooking = async () => {
    if (!newBookingData.customerName) {
      toast.error("Please enter customer name");
      return;
    }
    if (!newBookingData.customerPhone) {
      toast.error("Please enter phone number");
      return;
    }

    try {
      await createBookingMutation.mutateAsync({
        date: selectedDate,
        startTime: newBookingData.startTime,
        duration: newBookingData.duration,
        customerName: newBookingData.customerName,
        customerPhone: newBookingData.customerPhone,
        paymentMethod: "venue", // Walk-ins are usually venue payments
        overridePrice: newBookingData.totalPrice,
        loyaltyEnabled: newBookingData.loyaltyEnabled,
      });

      toast.success("Manual booking created successfully!");
      setIsBookingModalOpen(false);
      setNewBookingData({ ...newBookingData, customerName: "", customerPhone: "" });
    } catch (err) {
      console.error("Error creating manual booking:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create booking");
    }
  };

  useEffect(() => {
    // Auto-update date if it's past midnight
    const dateCheckInterval = setInterval(() => {
      const todayStr = getLocalDateString();
      setSelectedDate(prev => {
        // We only want to auto-bump the date if the user was on the "previous" today.
        // To find "yesterday" relative to actual current today:
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yesterdayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        if (prev === yesterdayStr) {
          console.log("Midnight transition detected, updating view to:", todayStr);
          return todayStr;
        }
        return prev;
      });
    }, 60000); // Check every minute

    return () => {
      clearInterval(dateCheckInterval);
    };
  }, []);

  // Sync date if URL changes
  useEffect(() => {
    if (urlDate) setSelectedDate(urlDate);
    if (highlightId) {
      setHighlightedId(highlightId);
      // Auto-clear highlight after 5 seconds
      const timer = setTimeout(() => setHighlightedId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [urlDate, highlightId]);

  useEffect(() => {
    if (!playerSearchQuery.error) return;
    const now = Date.now();
    if (now - lastPlayerSearchErrorAt.current <= 3000) return;
    lastPlayerSearchErrorAt.current = now;
    toast.error(
      playerSearchQuery.error instanceof Error
        ? playerSearchQuery.error.message
        : "Player search failed (check admin login / API URL)",
    );
  }, [playerSearchQuery.error]);

  // Close suggestions only when clicking outside the manual booking form.
  useEffect(() => {
    if (!isBookingModalOpen) return;
    if (!showPlayerSuggestions) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (manualBookingFormRef.current && !manualBookingFormRef.current.contains(target)) {
        setShowPlayerSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isBookingModalOpen, showPlayerSuggestions]);

  const getPriceForHour = (hour: string) => {
    if (!pricing || pricing.length === 0) return 1000;

    // Extract hour as number (e.g., "06:00" -> 6)
    const [hourStr] = hour.split(":");
    const hourNum = parseInt(hourStr, 10);

    // Find slot by ID pattern "ts-H"
    const slot = pricing.find(p => {
      const slotHour = parseInt(p.id.replace("ts-", ""), 10);
      return slotHour === hourNum;
    });

    return slot ? slot.price : 1000;
  };

  const isPastSlot = (hour: string) => {
    const todayStr = getLocalDateString();

    // If selecting a previous date, all slots are past
    if (selectedDate < todayStr) return true;
    // If selecting a future date, no slots are past
    if (selectedDate > todayStr) return false;

    // For today, compare hours. A slot is only past if its END time has been reached.
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const slotHour = parseInt(hour.split(":")[0]);
    // Assuming 1-hour slots for the grid; the slot ends at slotHour + 1
    return currentHour > slotHour;
  };

  const isBooked = (hour: string) => {
    const currentHour = parseInt(hour.split(":")[0]);

    // 1. Check tournaments FIRST (highest priority)
    const tourney = tournaments.find(t => {
      const tHour = parseInt(t.startTime.split(":")[0]);
      const tEndHour = parseInt(t.endTime.split(":")[0]) || 24; // Handle 00:00 as 24:00
      return currentHour >= tHour && currentHour < tEndHour;
    });
    if (tourney) return { ...tourney, type: 'tournament' };

    // 2. Check regular bookings
    const booking = bookings.find(b => {
      const bHour = parseInt(b.startTime.split(":")[0]);
      return currentHour >= bHour && currentHour < bHour + b.duration;
    });
    if (booking) return { ...booking, type: 'booking' };

    // 3. Check membership reservations
    const membership = memberships.find(m => {
      const mHour = parseInt(m.startTime.split(":")[0]);
      return currentHour >= mHour && currentHour < mHour + m.duration;
    });

    return membership ? { ...membership, type: 'membership' } : null;
  };

  const handleExtendMatch = (booking: any) => {
    const [h] = booking.startTime.split(':').map(Number);
    const duration = booking.duration || 1;
    const nextHour = h + duration;

    // Check if next slot is beyond closing time (assuming 21:00 is the last slot block)
    if (nextHour >= 22) {
      toast.error("Cannot extend: We are closed after 10 PM.");
      return;
    }

    const nextHourStr = `${nextHour.toString().padStart(2, "0")}:00`;

    // Check if next slot is already occupied
    if (isBooked(nextHourStr)) {
      toast.error("Cannot extend: The next slot is already booked.");
      return;
    }

    // Prepare new booking modal with extension data
    setNewBookingData({
      ...newBookingData,
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      startTime: nextHourStr,
      duration: 1,
      totalPrice: getPriceForHour(nextHourStr)
    });
    setIsBookingModalOpen(true);
  };

  const getBookingStartForHour = (hour: string) => {
    const t = tournaments.find(t => t.startTime === hour || t.startTime === `${hour}:00`);
    if (t) return { ...t, type: 'tournament' };

    const b = bookings.find(b => b.startTime === hour || b.startTime === `${hour}:00`);
    if (b) return { ...b, type: 'booking' };

    const m = memberships.find(m => m.startTime === hour || m.startTime === `${hour}:00`);
    if (m) return { ...m, type: 'membership' };

    return null;
  };

  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Field <span className="text-[#FA6400]">Timeline</span>
          </h1>
          <p className="text-slate-400 font-medium text-xs">Visual occupancy grid for daily matches.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={prevDay} className="p-2.5 hover:bg-slate-50 text-slate-400 hover:text-[#0c0b5d] transition-colors cursor-pointer"><ChevronLeft size={18} /></button>
            <div className="px-4 py-2 border-x border-slate-50 flex items-center gap-2 min-w-[140px] justify-center">
              <CalendarIcon size={14} className="text-[#FA6400]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                {new Date(selectedDate).toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <button onClick={nextDay} className="p-2.5 hover:bg-slate-50 text-slate-400 hover:text-[#0c0b5d] transition-colors cursor-pointer"><ChevronRight size={18} /></button>
          </div>


        </div>
      </div>

      {occupancyQuery.isError && (
        <div className="bg-red-50 border border-red-100 rounded-[24px] p-4 flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          <span className="text-sm font-bold">Failed to load match schedule.</span>
          <button
            onClick={() => occupancyQuery.refetch()}
            className="ml-auto underline text-xs font-black uppercase tracking-widest"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Calendar View */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[700px] flex flex-col relative z-20">
        {/* Timeline Header */}
        <div className="grid grid-cols-[100px_1fr] bg-slate-50/50 border-b border-slate-100">
          <div className="p-5 flex items-center justify-center border-r border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Hour</span>
          </div>
          <div className="p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-[#0c0b5d] uppercase tracking-tight">Booking Slots Schedule</span>
              <div className="px-2 py-0.5 bg-green-500/10 rounded-full">
                <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">Active System</span>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-slate-400">Manage and view match occupancy from 5 AM to 10 PM.</p>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          {(occupancyQuery.isLoading || occupancyQuery.isFetching) && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-[#0c0b5d] animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Schedule...</span>
              </div>
            </div>
          )}

          <div className="flex flex-col">
            {HOURS.map((hour) => {
              const booking = isBooked(hour);
              const isStart = getBookingStartForHour(hour);

              return (
                <div key={hour} className="grid grid-cols-[100px_1fr] relative min-h-[100px]">
                  {/* Time Marker Column */}
                  <div className="flex flex-col items-center justify-start pt-6 border-r border-slate-100 relative group">
                    <div className="flex flex-col leading-none items-center bg-white px-2 py-1 rounded-lg">
                      <span className="text-sm font-black text-[#0c0b5d]">
                        {formatTimeTo12h(hour)}
                      </span>
                    </div>
                  </div>

                  {/* Slot Content Column */}
                  <div className={`p-3 border-b border-slate-50 transition-all flex items-center relative ${booking?.type === 'tournament'
                    ? "bg-indigo-50/20"
                    : booking?.type === 'membership'
                      ? "bg-emerald-50/20"
                      : booking?.status === 'confirmed'
                        ? "bg-red-50/20"
                        : booking?.status === 'completed'
                          ? "bg-slate-50/20"
                          : booking?.status === 'skipped_due_to_tournament'
                            ? "bg-amber-50/20"
                            : "hover:bg-slate-50/50"
                    }`}>
                    {booking ? (
                      <div
                        onClick={() => {
                          if (booking.type !== 'tournament') {
                            setSelectedBookingForActions(booking);
                          }
                        }}
                        className={`w-full p-5 rounded-[24px] border flex items-center justify-between transition-all shadow-sm group/card ${booking.type !== 'tournament' ? 'cursor-pointer hover:scale-[1.01]' : ''
                          } ${highlightedId === booking.id ? "ring-4 ring-[#FA6400] ring-offset-4 animate-pulse border-[#FA6400] z-50 scale-[1.02]" : ""
                          } ${booking.status === "completed"
                            ? "bg-slate-500 border-slate-600 shadow-slate-900/20"
                            : booking.type === 'tournament'
                              ? "bg-indigo-700 border-indigo-800 shadow-indigo-900/40"
                              : booking.type === 'membership'
                                ? (booking.status === "pending"
                                  ? "bg-white border-[#FA6400] border-dashed shadow-orange-900/10"
                                  : "bg-emerald-600 border-emerald-700 shadow-emerald-900/20")
                                : booking.status === "confirmed"
                                  ? "bg-red-600 border-red-700 shadow-red-900/20"
                                  : "bg-white border-orange-200 border-dashed hover:border-orange-400"
                          }`}
                        style={{
                          height: isStart ? `calc(${booking.duration} * 100% - 10px)` : "auto",
                          display: isStart ? "flex" : "none",
                          position: isStart ? "absolute" : "relative",
                          top: isStart ? "5px" : "auto",
                          left: isStart ? "12px" : "auto",
                          right: isStart ? "12px" : "auto",
                          zIndex: isStart ? 10 : 0
                        }}
                      >
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover/card:scale-110 ${(booking.status === "confirmed" || booking.status === "completed" || booking.type === "tournament" || (booking.type === "membership" && booking.status !== 'pending')) ? "bg-white/20 text-white" : "bg-[#FA6400] text-white"
                            }`}>
                            <CalendarIcon size={20} />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${booking.status === "completed" ? "text-slate-100" :
                              booking.type === "tournament" ? "text-indigo-100" :
                                booking.type === "membership" ? (booking.status === "pending" ? "text-[#FA6400]" : "text-emerald-100") :
                                  booking.status === "confirmed" ? "text-red-100" :
                                    booking.status === "skipped_due_to_tournament" ? "text-amber-100" : "text-orange-500"
                              }`}>
                              {booking.status === "completed"
                                ? "Session Completed"
                                : booking.type === "tournament"
                                  ? "Live Tournament Match"
                                  : booking.status === "skipped_due_to_tournament"
                                    ? "Skipped (Tournament)"
                                    : booking.type === 'membership'
                                      ? (booking.status === "pending" ? "Pending Membership" : "Active Membership Play")
                                      : booking.status === "confirmed" ? "Confirmed Match" : "Pending Confirmation"}
                            </span>
                            <h4 className={`text-base font-black uppercase italic tracking-tight ${(booking.status === "confirmed" || booking.status === "completed" || booking.type === 'tournament' || (booking.type === 'membership' && booking.status !== 'pending')) ? "text-white" : "text-[#0c0b5d]"
                              }`}>
                              {booking.customerName || booking.customerPhone || (booking.type === "membership" ? "Member Play" : "Guest Player")}{booking.customerPhone && !booking.customerName?.includes(booking.customerPhone) && booking.type !== 'tournament' && ` - ${booking.customerPhone}`}
                            </h4>
                            <div className="flex items-center gap-3 mt-1.5 opacity-80">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className={(booking.status === "confirmed" || booking.status === "completed" || booking.type === 'tournament' || (booking.type === 'membership' && booking.status !== 'pending')) ? "text-white" : "text-[#0c0b5d]"} />
                                <span className={`text-[10px] font-bold uppercase ${(booking.status === "confirmed" || booking.status === "completed" || booking.type === 'tournament' || (booking.type === 'membership' && booking.status !== 'pending')) ? "text-white" : "text-[#0c0b5d]"
                                  }`}>
                                  {booking.type === "tournament" ? "Matches Ongoing" : `${booking.duration} Hour Session`}
                                </span>
                              </div>
                              {booking.type !== 'tournament' && (booking as any).totalPrice !== undefined && (
                                <>
                                  <div className={`w-1 h-1 rounded-full ${(booking.status === "confirmed" || booking.status === "completed" || booking.type === "membership") ? "bg-white/40" : "bg-slate-300"}`} />
                                  <span className={`text-[10px] font-bold uppercase ${(booking.status === "confirmed" || booking.status === "completed" || booking.type === 'membership') ? "text-white" : "text-[#0c0b5d]"}`}>
                                    Rs. {(booking as any).totalPrice.toLocaleString()}
                                  </span>
                                </>
                              )}
                              <div className={`w-1 h-1 rounded-full ${(booking.status === "confirmed" || booking.status === "completed" || booking.type === "tournament" || booking.type === "membership") ? "bg-white/40" : "bg-slate-300"}`} />
                              <span className={`text-[10px] font-bold uppercase ${(booking.status === "confirmed" || booking.status === "completed" || booking.type === 'tournament' || booking.type === 'membership') ? (booking.status === "completed" ? "text-slate-100/60" : booking.type === 'tournament' ? "text-indigo-100/60" : booking.type === 'membership' ? "text-emerald-100/60" : "text-red-100/60") : "text-slate-500"
                                }`}>
                                ID: #{booking.id.slice(-6).toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-2">
                          {booking.type !== 'tournament' && booking.status !== 'cancelled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExtendMatch(booking);
                              }}
                              className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                            >
                              <Plus size={12} /> Extend
                            </button>
                          )}
                          {booking.type === 'booking' && (
                            <button
                              className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="mr-2 text-sm font-medium text-gray-800">Loyalty points</span>
                              <label className={`relative inline-flex items-center ${booking.status === "completed" ? "cursor-not-allowed" : "cursor-pointer"}`}>
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={(booking as any).loyaltyEnabled}
                                  disabled={booking.status === "completed"}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleLoyalty(booking);
                                  }}
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-checked:bg-green-500 rounded-full transition-colors"></div>
                                <div className="dot absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-full shadow-sm"></div>
                              </label>
                            </button>
                          )}
                          {booking.status === "completed" ? (
                            <div className="flex items-center gap-2 bg-white/20 text-white px-4 py-2.5 rounded-xl border border-white/20">
                              <CheckCircle2 size={16} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Match Settled</span>
                            </div>
                          ) : booking.type === "tournament" ? (
                            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl border border-indigo-100">
                              <Trophy size={16} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Tournament Play</span>
                            </div>
                          ) : (
                            <>
                              {(booking.status === "pending" || booking.status === "cancelled") && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(booking.id, "confirmed");
                                  }}
                                  disabled={updateBookingMutation.isPending || verifyMembershipMutation.isPending}
                                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-green-50 text-green-600 px-4 py-2.5 rounded-xl hover:bg-green-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {verifyMembershipMutation.isPending && booking.id.startsWith('mem-') ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  Accept
                                </button>
                              )}

                              {booking.status !== "cancelled" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(booking.id, "cancelled");
                                  }}
                                  disabled={updateBookingMutation.isPending}
                                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 px-4 py-2.5 rounded-xl hover:bg-red-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                                >
                                  <Ban size={12} /> Reject
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setNewBookingData({
                            ...newBookingData,
                            startTime: hour,
                            totalPrice: getPriceForHour(hour)
                          });
                          setIsBookingModalOpen(true);
                        }}
                        className={`w-full h-16 rounded-2xl flex items-center justify-between px-6 border-2 border-dashed transition-all ${isPastSlot(hour)
                          ? "bg-slate-50 border-slate-200 group cursor-pointer hover:border-[#FA6400] hover:bg-orange-50/50"
                          : "border-slate-200 group cursor-pointer hover:border-[#FA6400] hover:bg-[#FA6400]/5"
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPastSlot(hour) ? "bg-slate-200 text-slate-500 group-hover:bg-[#FA6400] group-hover:text-white" : "bg-slate-50 text-slate-400 group-hover:bg-[#FA6400] group-hover:text-white"
                            }`}>
                            {isPastSlot(hour) ? <Clock size={18} /> : <Plus size={20} />}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isPastSlot(hour) ? "text-slate-500" : "text-[#0c0b5d]"
                              }`}>
                              {isPastSlot(hour) ? "Past Slot (Log Now)" : "Open Match Slot"}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              {isPastSlot(hour) ? "Click to add retroactive booking" : "Available for booking"}
                            </span>
                          </div>
                        </div>

                        <div className={`flex items-center gap-3 ${isPastSlot(hour) ? "opacity-30" : ""}`}>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pricing:</span>
                          <span className="text-sm font-black text-[#0c0b5d]">Rs. {getPriceForHour(hour).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Horizontal line marker */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-slate-100 pointer-events-none" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-indigo-700 shadow-sm shadow-indigo-500/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Tournament Play</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-600 shadow-sm shadow-emerald-500/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Membership Slot</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-600 shadow-sm shadow-red-500/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Booked Match</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-slate-500 shadow-sm shadow-slate-500/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Completed</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#FA6400] shadow-sm shadow-[#FA6400]/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Pending</span>
          </div>
        </div>
      </div>

      {/* Manual Booking Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-sm" onClick={() => setIsBookingModalOpen(false)} />
          <div
            ref={manualBookingFormRef}
            className="bg-white rounded-[40px] w-full max-w-lg p-8 relative z-10 max-h-full overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-6">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  Manual <span className="text-[#FA6400]">Booking</span>
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Direct field entry for {formatTimeTo12h(newBookingData.startTime)}</p>
              </div>
              <button onClick={() => setIsBookingModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-[#0c0b5d] rounded-2xl transition-all cursor-pointer">
                ✕
              </button>
            </div>
            {/* Loyalty toggle */}
            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                id="loyaltyToggle"
                checked={newBookingData.loyaltyEnabled}
                onChange={(e) => setNewBookingData({ ...newBookingData, loyaltyEnabled: e.target.checked })}
                className="mr-2 h-4 w-4 text-[#FA6400] rounded"
              />
              <label htmlFor="loyaltyToggle" className="text-sm font-black uppercase tracking-widest text-[#0c0b5d]">
                Enable Loyalty Points
              </label>
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Name (*)</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type a name (e.g. Su...)"
                      value={newBookingData.customerName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewBookingData({ ...newBookingData, customerName: value });
                        setActiveSuggestionField("name");
                        setPlayerQuery(value);
                        setShowPlayerSuggestions(true);
                      }}
                      onFocus={() => {
                        setActiveSuggestionField("name");
                        setPlayerQuery(newBookingData.customerName);
                        setShowPlayerSuggestions(true);
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-[#0c0b5d] focus:ring-2 focus:ring-[#FA6400]/20 outline-none transition-all placeholder:text-slate-300"
                    />

                    {activeSuggestionField === "name" && showPlayerSuggestions && playerQuery.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-50">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Existing Players
                          </span>
                          {playerSearchQuery.isFetching ? (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                              Searching...
                            </span>
                          ) : null}
                        </div>
                        <div className="max-h-56 overflow-auto">
                          {(playerSearchQuery.data || []).map((p) => (
                            <button
                              key={p.phoneNumber}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setNewBookingData({
                                  ...newBookingData,
                                  customerName: p.name || "",
                                  customerPhone: p.phoneNumber || "",
                                });
                                setPlayerQuery(p.name || "");
                                setShowPlayerSuggestions(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between"
                            >
                              <span className="text-sm font-black text-[#0c0b5d]">
                                {p.name || "Unnamed"}
                              </span>
                              <span className="text-xs font-black text-slate-400 tracking-widest">
                                {p.phoneNumber}
                              </span>
                            </button>
                          ))}
                          {!playerSearchQuery.isFetching &&
                            (playerSearchQuery.data || []).length === 0 ? (
                            <div className="px-4 py-3">
                              <p className="text-xs font-bold text-slate-400">
                                No matches. You can continue as a new customer.
                              </p>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  // Keep typed name/phone, just close suggestions.
                                  setShowPlayerSuggestions(false);
                                }}
                                className="mt-2 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors cursor-pointer"
                              >
                                Use this name
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 9812345678"
                      value={newBookingData.customerPhone}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewBookingData({ ...newBookingData, customerPhone: value });
                        setActiveSuggestionField("phone");
                        // Also allow searching by phone (useful when staff know the number)
                        setPlayerQuery(value);
                        setShowPlayerSuggestions(true);
                      }}
                      onFocus={() => {
                        setActiveSuggestionField("phone");
                        setPlayerQuery(newBookingData.customerPhone || newBookingData.customerName);
                        setShowPlayerSuggestions(true);
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-[#0c0b5d] focus:ring-2 focus:ring-[#FA6400]/20 outline-none transition-all placeholder:text-slate-300"
                    />

                    {activeSuggestionField === "phone" && showPlayerSuggestions && playerQuery.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-50">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Existing Players
                          </span>
                          {playerSearchQuery.isFetching ? (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                              Searching...
                            </span>
                          ) : null}
                        </div>
                        <div className="max-h-56 overflow-auto">
                          {(playerSearchQuery.data || []).map((p) => (
                            <button
                              key={p.phoneNumber}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setNewBookingData({
                                  ...newBookingData,
                                  customerName: p.name || "",
                                  customerPhone: p.phoneNumber || "",
                                });
                                setPlayerQuery(p.phoneNumber || "");
                                setShowPlayerSuggestions(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between"
                            >
                              <span className="text-sm font-black text-[#0c0b5d]">
                                {p.name || "Unnamed"}
                              </span>
                              <span className="text-xs font-black text-slate-400 tracking-widest">
                                {p.phoneNumber}
                              </span>
                            </button>
                          ))}
                          {!playerSearchQuery.isFetching &&
                            (playerSearchQuery.data || []).length === 0 ? (
                            <div className="px-4 py-3">
                              <p className="text-xs font-bold text-slate-400">
                                No matches. Use this number for a new customer.
                              </p>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setShowPlayerSuggestions(false);
                                }}
                                className="mt-2 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors cursor-pointer"
                              >
                                Use this number
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[32px] border border-slate-100/50">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Allocated Price</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#0c0b5d]">Rs.</span>
                    <input
                      type="number"
                      value={newBookingData.totalPrice}
                      onChange={(e) => setNewBookingData({ ...newBookingData, totalPrice: parseInt(e.target.value) || 0 })}
                      className="bg-transparent border-b border-slate-200 focus:border-[#FA6400] text-xl font-black text-[#0c0b5d] w-24 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session Duration</span>
                  <span className="text-xl font-black text-[#FA6400]">1 Hour</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsBookingModalOpen(false)}
                  className="flex-1 bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[10px] py-5 rounded-2xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  onClick={handleManualBooking}
                  disabled={createBookingMutation.isPending}
                  className="flex-2 bg-[#0c0b5d] text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl hover:scale-[1.02] shadow-xl shadow-[#0c0b5d]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                >
                  {createBookingMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Finalize Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile/Desktop Session Action Modal */}
      {selectedBookingForActions && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-sm" onClick={() => setSelectedBookingForActions(null)} />
          <div
            className="bg-white rounded-[40px] w-full max-w-md p-8 relative z-10 max-h-full overflow-y-auto shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FA6400] mb-1">
                  Manage Session
                </span>
                <h2 className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  {selectedBookingForActions.type === 'membership' ? 'Membership Play' : 'Booking Details'}
                </h2>
              </div>
              <button onClick={() => setSelectedBookingForActions(null)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-[#0c0b5d] rounded-2xl transition-all cursor-pointer">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-6">
              {/* Card details */}
              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-slate-400">Player</span>
                  <span className="text-base font-black text-[#0c0b5d] uppercase">
                    {selectedBookingForActions.customerName || selectedBookingForActions.customerPhone || "Guest Player"}
                  </span>
                </div>

                {selectedBookingForActions.customerPhone && (
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400">Phone Number</span>
                    <span className="text-sm font-bold text-[#0c0b5d] tracking-wide">
                      {selectedBookingForActions.customerPhone}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400">Start Time</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0c0b5d] mt-1">
                      <Clock size={12} className="text-[#FA6400]" />
                      {formatTimeTo12h(selectedBookingForActions.startTime)}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400">Duration</span>
                    <span className="text-xs font-bold text-[#0c0b5d] mt-1">
                      {selectedBookingForActions.duration} Hour{selectedBookingForActions.duration > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400">Status</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider mt-1 ${selectedBookingForActions.status === 'confirmed' ? 'text-green-600' :
                      selectedBookingForActions.status === 'completed' ? 'text-blue-600' :
                        selectedBookingForActions.status === 'pending' ? 'text-orange-500 font-black' : 'text-red-500'
                      }`}>
                      {selectedBookingForActions.status}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400">ID</span>
                    <span className="text-xs font-mono text-slate-500 mt-1 uppercase">
                      #{selectedBookingForActions.id.slice(-6)}
                    </span>
                  </div>
                </div>

                {(selectedBookingForActions as any).type !== 'tournament' && (selectedBookingForActions as any).totalPrice !== undefined && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/60">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase text-slate-400">Allocated Price</span>
                      <span className="text-sm font-black text-[#0c0b5d] mt-1">
                        Rs. {(selectedBookingForActions as any).totalPrice.toLocaleString()}
                      </span>
                    </div>
                    {(selectedBookingForActions as any).paymentStatus && (
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-slate-400">Payment Status</span>
                        <span className={`text-[10px] font-black uppercase tracking-wider mt-1 ${(selectedBookingForActions as any).paymentStatus === 'completed' ? 'text-green-600' :
                          (selectedBookingForActions as any).paymentStatus === 'partially_paid' ? 'text-amber-500' : 'text-red-500'
                          }`}>
                          {(selectedBookingForActions as any).paymentStatus.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-2">
                {selectedBookingForActions.status === "completed" ? (
                  <div className="flex items-center justify-center gap-2 bg-slate-100 text-slate-500 py-4 rounded-2xl border border-slate-200">
                    <CheckCircle2 size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Match Completed & Settled</span>
                  </div>
                ) : (
                  <>
                    {(selectedBookingForActions.status === "pending" || selectedBookingForActions.status === "cancelled") && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const id = selectedBookingForActions.id;
                          setSelectedBookingForActions(null);
                          await handleStatusUpdate(id, "confirmed");
                        }}
                        disabled={updateBookingMutation.isPending || verifyMembershipMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-green-500 text-white py-4 rounded-2xl hover:bg-green-600 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Check size={16} /> Accept Booking
                      </button>
                    )}

                    {selectedBookingForActions.status !== "cancelled" && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const id = selectedBookingForActions.id;
                          setSelectedBookingForActions(null);
                          await handleStatusUpdate(id, "cancelled");
                        }}
                        disabled={updateBookingMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-red-500 text-white py-4 rounded-2xl hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Ban size={16} /> Reject / Cancel
                      </button>
                    )}

                    {selectedBookingForActions.status !== "cancelled" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBookingForActions(null);
                          handleExtendMatch(selectedBookingForActions);
                        }}
                        className="w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 py-4 rounded-2xl hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                      >
                        <Plus size={16} /> Extend Session (+1 Hour)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <SmsConfirmModal
        isOpen={smsConfirmModal.isOpen}
        onOpenChange={(open) => setSmsConfirmModal((prev) => ({ ...prev, isOpen: open }))}
        title={smsConfirmModal.title}
        description={smsConfirmModal.description}
        onConfirm={smsConfirmModal.onConfirm}
      />
    </div>
  );
}
