"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Zap,
  Tag,
  CircleDashed,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
} from "lucide-react";
import {
  MembershipPlan,
  MembershipSubscription,
  TimeSlotAvailability,
} from "@/lib/api/membership";
import { formatTimeTo12h } from "@/lib/utils/time";
import MembershipMatrix from "./MembershipMatrix";

interface MembershipRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTier: MembershipPlan | undefined;
  selectedDuration: string;
  selectedCategory: string;
  selectedTimeSlot: string;
  selectedDays: string[];
  selectedStartDate: string;
  customPrice: number;
  promoInput: string;
  setPromoInput: (value: string) => void;
  appliedPromo: string;
  promoError: string;
  promoDiscountAmount: number;
  applyPromo: () => void;
  removePromo: () => void;
  isProcessing: boolean;
  handleSubscribe: () => void;
  activeSubscription: MembershipSubscription | null;
  filteredSlots: TimeSlotAvailability[];
  loadingTimeSlots: boolean;
  setSelectedTimeSlot: (slot: string) => void;
  setSelectedStartDate: (date: string) => void;
  toggleDay: (day: string) => void;
  setSelectedDuration: (duration: string) => void;
  setSelectedCategory: (category: string) => void;
  setCustomPrice: (price: number) => void;
  successMessage: string | null;
  setSuccessMessage: (message: string | null) => void;
}

export default function MembershipRecapModal({
  isOpen,
  onClose,
  selectedTier,
  selectedDuration,
  selectedCategory,
  selectedTimeSlot,
  selectedDays,
  selectedStartDate,
  customPrice,
  promoInput,
  setPromoInput,
  appliedPromo,
  promoError,
  promoDiscountAmount,
  applyPromo,
  removePromo,
  isProcessing,
  handleSubscribe,
  activeSubscription,
  filteredSlots,
  loadingTimeSlots,
  setSelectedTimeSlot,
  setSelectedStartDate,
  toggleDay,
  setSelectedDuration,
  setSelectedCategory,
  setCustomPrice,
  successMessage,
  setSuccessMessage,
}: MembershipRecapModalProps) {
  const durationLabel =
    selectedDuration === "3_days"
      ? "per month (3 days/week)"
      : selectedDuration === "3_months"
        ? "per 3 months"
        : "per month";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 md:p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl lg:rounded-[40px] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button or Clear Success */}
            <button
              onClick={() => {
                if (successMessage) {
                  setSuccessMessage(null);
                }
                onClose();
              }}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center transition-all z-20"
            >
              <X size={18} className="text-slate-600 sm:w-5 sm:h-5" />
            </button>

            <div className="relative p-3 sm:p-5 md:p-8 lg:p-10">
              <AnimatePresence mode="wait">
                {successMessage ? (
                  <motion.div
                    key="success-screen"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 lg:py-20 text-center gap-4 sm:gap-6 md:gap-8"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500 rounded-2xl sm:rounded-[32px] flex items-center justify-center shadow-2xl shadow-green-500/40 relative">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                      >
                        <CheckCircle2
                          size={40}
                          className="text-white sm:w-12 sm:h-12"
                        />
                      </motion.div>

                      {/* Decorative elements */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 10,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="absolute -inset-4 border-2 border-dashed border-green-500/20 rounded-[40px] -z-10"
                      />
                    </div>

                    <div className="max-w-md mx-auto space-y-3 sm:space-y-4">
                      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-[#0c0b5d]">
                        Enrollment{" "}
                        <span className="text-[#FA6400]">Secured!</span>
                      </h2>
                      <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed px-4">
                        You have successfully booked this membership. Your elite
                        status is pending final verification.
                      </p>
                      <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 mt-4 sm:mt-6 text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#FA6400] mb-2">
                          What&apos;s Next?
                        </p>
                        <div className="text-xs text-slate-600 leading-relaxed">
                          {successMessage.split(". ").map((sentence, i) => (
                            <p key={i} className="mb-1">
                              • {sentence}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSuccessMessage(null);
                        onClose();
                      }}
                      className="mt-4 px-8 sm:px-10 py-3 sm:py-4 bg-[#0c0b5d] text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs hover:bg-[#FA6400] transition-all shadow-xl active:scale-95"
                    >
                      Back to Membership
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="booking-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8"
                  >
                    {/* Left Side - Matrix & Selection */}
                    <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-6 lg:gap-8 order-1 lg:order-1">
                      {/* Pricing Matrix */}
                      {selectedTier?.pricingMatrix && (
                        <div>
                          <MembershipMatrix
                            plan={selectedTier}
                            selectedDuration={selectedDuration}
                            selectedCategory={selectedCategory}
                            onSelect={(dur, cat, prc) => {
                              setSelectedDuration(dur);
                              setSelectedCategory(cat);
                              setCustomPrice(prc);
                            }}
                          />
                        </div>
                      )}

                      {/* Day Selection & Time Slot Section Container */}
                      <div
                        id="next-steps-section"
                        className="flex flex-col gap-4 sm:gap-6 lg:gap-8 w-full"
                      >
                        {/* Day Selection for 3 Days pack */}
                        {selectedDuration === "3_days" && (
                          <div className="bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                              <Calendar
                                size={18}
                                className="text-[#FA6400] sm:w-5 sm:h-5"
                              />
                              <div>
                                <h3 className="text-base sm:text-lg font-black text-[#0c0b5d] uppercase tracking-tight">
                                  Schedule Your Week
                                </h3>
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Select exactly 3 days
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                              {[
                                "Monday",
                                "Tuesday",
                                "Wednesday",
                                "Thursday",
                                "Friday",
                                "Saturday",
                                "Sunday",
                              ].map((day) => {
                                const isSelected = selectedDays.includes(day);
                                return (
                                  <button
                                    type="button"
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    className={`py-2 sm:py-3 rounded-lg sm:rounded-xl border-2 font-black uppercase text-[8px] sm:text-[9px] tracking-widest transition-all touch-manipulation active:scale-95 ${
                                      isSelected
                                        ? "bg-[#0c0b5d] text-white border-[#0c0b5d] shadow-lg"
                                        : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 active:bg-slate-200"
                                    }`}
                                  >
                                    {day.slice(0, 3)}
                                  </button>
                                );
                              })}
                            </div>
                            {selectedDays.length === 3 && (
                              <div className="mt-4 flex items-center gap-2 text-green-600 font-bold text-xs">
                                <CheckCircle2 size={16} /> Perfect! 3 sessions
                                selected.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Time Slot Section */}
                        {(!selectedTier?.pricingMatrix || selectedCategory) && (
                          <div className="bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                              <Clock
                                size={18}
                                className="text-[#FA6400] sm:w-5 sm:h-5"
                              />
                              <h3 className="text-base sm:text-lg font-black text-[#0c0b5d] uppercase tracking-tight">
                                Guard Your Slot
                              </h3>
                            </div>

                            {/* Start Date */}
                            <div className="mb-4 sm:mb-6">
                              <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-2 block">
                                Elite Start Date
                              </label>
                              <div className="relative">
                                <Calendar
                                  className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-300"
                                  size={16}
                                />
                                <input
                                  type="date"
                                  value={selectedStartDate}
                                  onChange={(e) =>
                                    setSelectedStartDate(e.target.value)
                                  }
                                  min={new Date().toISOString().split("T")[0]}
                                  className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border-2 border-slate-100 font-bold text-[#0c0b5d] focus:border-[#FA6400] focus:outline-none transition-all cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Time Slots */}
                            {loadingTimeSlots ? (
                              <div className="flex items-center justify-center py-8 sm:py-12">
                                <CircleDashed
                                  className="animate-spin text-[#FA6400]"
                                  size={28}
                                />
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                                {filteredSlots.length > 0 ? (
                                  filteredSlots.map((slot) => (
                                    <button
                                      type="button"
                                      disabled={!slot.available}
                                      key={slot.slot}
                                      onClick={() =>
                                        setSelectedTimeSlot(slot.slot)
                                      }
                                      className={`group relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all flex flex-col items-center gap-0.5 sm:gap-1 touch-manipulation active:scale-95 ${
                                        selectedTimeSlot === slot.slot
                                          ? "bg-[#FA6400] border-[#FA6400] text-white shadow-xl scale-105"
                                          : slot.available
                                            ? "bg-white border-slate-100 hover:border-[#FA6400] text-[#0c0b5d] active:bg-orange-50"
                                            : "bg-slate-50 border-transparent text-slate-300 opacity-40 cursor-not-allowed"
                                      }`}
                                    >
                                      <span className="text-xs sm:text-sm font-black pointer-events-none">
                                        {formatTimeTo12h(slot.slot)}
                                      </span>
                                      <span
                                        className={`text-[7px] sm:text-[8px] font-black uppercase pointer-events-none ${
                                          selectedTimeSlot === slot.slot
                                            ? "text-white/60"
                                            : "text-slate-400"
                                        }`}
                                      >
                                        {slot.available
                                          ? `${slot.capacity - slot.reserved} left`
                                          : "Full"}
                                      </span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="col-span-full py-8 sm:py-12 text-center text-red-400 text-[10px] sm:text-xs font-black uppercase">
                                    No available slots
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Side - The Recap */}
                    <div className="lg:col-span-5 order-2 lg:order-2">
                      <div className="lg:sticky lg:top-6 bg-[#0c0b5d] rounded-2xl sm:rounded-3xl lg:rounded-[40px] p-4 sm:p-6 md:p-8 lg:p-10 text-white shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 pointer-events-none">
                          <Zap size={150} />
                        </div>

                        <h4 className="text-xl sm:text-2xl md:text-3xl font-black italic uppercase tracking-tighter mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-white/10">
                          The Recap
                        </h4>

                        {selectedTier ? (
                          <div className="flex flex-col gap-4 sm:gap-6">
                            {/* Membership Tier */}
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                Membership Tier
                              </span>
                              <span className="text-xl sm:text-2xl md:text-3xl font-black italic text-[#FA6400]">
                                {selectedTier.name}
                              </span>
                            </div>

                            {/* Details */}
                            {(selectedDuration ||
                              selectedCategory ||
                              selectedTimeSlot ||
                              selectedDays.length > 0) && (
                              <div className="flex flex-col gap-2.5 sm:gap-3 bg-white/5 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-white/5">
                                {selectedDuration && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">
                                      Duration
                                    </span>
                                    <span className="text-xs font-black uppercase italic">
                                      {selectedDuration.replace("_", " ")}
                                    </span>
                                  </div>
                                )}
                                {selectedCategory && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">
                                      Cycle
                                    </span>
                                    <span className="text-xs font-black uppercase italic text-[#FA6400]">
                                      {selectedCategory}
                                    </span>
                                  </div>
                                )}
                                {selectedTimeSlot && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">
                                      Reserved Slot
                                    </span>
                                    <span className="text-xs font-black italic">
                                      {formatTimeTo12h(selectedTimeSlot)}
                                    </span>
                                  </div>
                                )}
                                {selectedDuration === "3_days" &&
                                  selectedDays.length > 0 && (
                                    <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                                      <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">
                                        Selected Days
                                      </span>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {selectedDays.map((d) => (
                                          <span
                                            key={d}
                                            className="px-2 py-0.5 bg-[#FA6400] rounded text-[8px] font-black uppercase"
                                          >
                                            {d.slice(0, 3)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                {promoDiscountAmount > 0 && (
                                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                    <span className="text-[10px] font-black uppercase text-green-400 tracking-widest">
                                      Promo ({appliedPromo})
                                    </span>
                                    <span className="text-xs font-black text-green-400 italic">
                                      - Rs.{" "}
                                      {promoDiscountAmount.toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Promo Input */}
                            {!activeSubscription && (
                              <div>
                                {appliedPromo ? (
                                  <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                                    <div className="flex items-center gap-2">
                                      <Tag
                                        size={12}
                                        className="text-[#FA6400]"
                                      />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-[#FA6400]">
                                        {appliedPromo}
                                      </span>
                                    </div>
                                    <button
                                      onClick={removePromo}
                                      className="text-white/40 hover:text-white"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={promoInput}
                                        onChange={(e) =>
                                          setPromoInput(e.target.value)
                                        }
                                        placeholder="PROMO CODE"
                                        className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black text-white placeholder:text-white/30 focus:outline-none focus:border-[#FA6400] transition-all"
                                      />
                                      <button
                                        onClick={applyPromo}
                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                      >
                                        Apply
                                      </button>
                                    </div>
                                    {promoError && (
                                      <p className="text-[8px] font-black text-red-400 uppercase ml-1">
                                        {promoError}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Investment */}
                            <div className="flex flex-col gap-1 pt-3 sm:pt-4 border-t border-white/10">
                              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                                Investment
                              </span>
                              <span className="text-4xl sm:text-5xl md:text-6xl font-black italic">
                                Rs.{" "}
                                {(
                                  customPrice ||
                                  selectedTier?.price ||
                                  0
                                ).toLocaleString()}
                              </span>
                              <p className="text-[8px] sm:text-[9px] text-[#FA6400] font-black uppercase mt-1 tracking-widest italic">
                                {durationLabel}
                              </p>
                            </div>

                            {/* CTA Button */}
                            <button
                              onClick={handleSubscribe}
                              disabled={
                                (!!selectedTier?.pricingMatrix &&
                                  !selectedCategory) ||
                                !selectedTimeSlot ||
                                isProcessing ||
                                (selectedDuration === "3_days" &&
                                  selectedDays.length !== 3) ||
                                !!activeSubscription
                              }
                              className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.15em] text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 sm:gap-3 mt-2 active:scale-95 ${
                                !selectedTimeSlot ||
                                activeSubscription ||
                                (!!selectedTier?.pricingMatrix &&
                                  !selectedCategory)
                                  ? "bg-white/10 text-white/20 cursor-not-allowed"
                                  : "bg-[#FA6400] text-white hover:bg-white hover:text-[#0c0b5d]"
                              }`}
                            >
                              {isProcessing ? (
                                <CircleDashed
                                  className="animate-spin"
                                  size={18}
                                />
                              ) : (
                                "Finalize Enrollment"
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="py-16 flex flex-col items-center justify-center text-center gap-4 opacity-20 italic">
                            <CircleDashed size={40} className="animate-pulse" />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">
                              Awaiting Selection...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
