"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, User, Phone, Mail, Calendar, CalendarOff,
  Clock, CreditCard, ShieldCheck, Layers,
  Loader2, Check, Zap, Tag, CircleDashed,
  CheckCircle2, Award
} from "lucide-react";
import { 
  MembershipPlan, 
  MembershipSubscription,
  TimeSlotAvailability 
} from "@/lib/api/membership";
import { 
  useMembershipPlans, 
  useAvailableTimeSlots,
  useManualSubscribe 
} from "@/lib/hooks";
import { toast } from "sonner";
import { formatTimeTo12h } from "@/lib/utils/time";
import MembershipPackages from "@/components/home/MembershipPackages";
import MembershipMatrix from "@/components/membership/MembershipMatrix";

interface AdminManualMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminManualMembershipModal({ isOpen, onClose }: AdminManualMembershipModalProps) {
  const [step, setStep] = useState(1); // 1: User Info, 2: Choose Plan, 3: Configuration
  
  const [userInfo, setUserInfo] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<string>("1_month");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [selectedStartDate, setSelectedStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [excludedDays, setExcludedDays] = useState<string[]>([]);

  const toggleExcludedDay = (day: string) => {
    setExcludedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]
    );
  };

  const { data: plans = [] } = useMembershipPlans();
  const availableTimeSlotsQuery = useAvailableTimeSlots({
    startDate: selectedStartDate,
  });
  const manualSubscribeMutation = useManualSubscribe();

  const selectedTier = plans.find(t => t.name === selectedPlan);

  const availableTimeSlots: TimeSlotAvailability[] = availableTimeSlotsQuery.data || [];
  
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

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : prev.length < 3 ? [...prev, day] : prev
    );
  };

  const handleManualSubscribe = async () => {
    if (!selectedTier) return;
    
    if (selectedTier.pricingMatrix && !selectedCategory) {
      toast.error("Please pick a pricing cell (Duration & Category)");
      return;
    }

    if (selectedDuration === "3_days" && selectedDays.length !== 3) {
      toast.error("Please select exactly 3 training days");
      return;
    }

    if (!selectedTimeSlot) {
      toast.error("Please select a training time slot");
      return;
    }

    try {
      await manualSubscribeMutation.mutateAsync({
        ...userInfo,
        planId: selectedTier.id,
        timeSlot: selectedTimeSlot,
        startDate: selectedStartDate,
        chosenDuration: selectedDuration,
        chosenCategory: selectedCategory,
        totalPrice: customPrice,
        chosenDays: selectedDays,
        excludeDays: excludedDays,
      });
      
      toast.success("Membership registered successfully!");
      onClose();
      // Reset
      setStep(1);
      setUserInfo({ name: "", phoneNumber: "", email: "" });
      setSelectedPlan("");
      setSelectedTimeSlot("");
      setExcludedDays([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      toast.error(msg);
    }
  };

  const durationLabel = selectedDuration === "3_days" ? "per month (3 days/week)" : selectedDuration === "3_months" ? "per 3 months" : "per month";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-7xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0c0b5d] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck size={24} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-black text-[#0c0b5d] italic uppercase tracking-tighter">Admin <span className="text-[#FA6400]">Enrollment</span></h2>
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${step >= 1 ? 'bg-[#FA6400]' : 'bg-slate-300'}`} />
                <span className={`h-1.5 w-1.5 rounded-full ${step >= 2 ? 'bg-[#FA6400]' : 'bg-slate-300'}`} />
                <span className={`h-1.5 w-1.5 rounded-full ${step >= 3 ? 'bg-[#FA6400]' : 'bg-slate-300'}`} />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest ml-2">
                  {step === 1 ? "Step 1: Member Info" : step === 2 ? "Step 2: Choose Package" : "Step 3: Configuration"}
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto py-10 flex flex-col gap-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">Who is the <span className="text-[#FA6400]">Member?</span></h3>
                  <p className="text-sm font-medium text-slate-500">Enter the details of the player being registered.</p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0c0b5d] transition-colors" size={18} />
                    <input
                      type="text"
                      placeholder="Full Name *"
                      required
                      value={userInfo.name}
                      onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-5 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 focus:border-[#0c0b5d] outline-none transition-all"
                    />
                  </div>

                  <div className="relative group">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0c0b5d] transition-colors" size={18} />
                    <input
                      type="tel"
                      placeholder="Phone Number (Unique ID) *"
                      required
                      value={userInfo.phoneNumber}
                      onChange={(e) => setUserInfo({ ...userInfo, phoneNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-5 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 focus:border-[#0c0b5d] outline-none transition-all"
                    />
                  </div>

                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0c0b5d] transition-colors" size={18} />
                    <input
                      type="email"
                      placeholder="Email Address (Optional)"
                      value={userInfo.email}
                      onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-5 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 focus:border-[#0c0b5d] outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (userInfo.name && userInfo.phoneNumber) setStep(2);
                    else toast.error("Please fill Name and Phone Number");
                  }}
                  className="w-full py-5 bg-[#0c0b5d] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#1a1975] transition-all shadow-xl shadow-indigo-500/10 flex items-center justify-center gap-2"
                >
                  Pick a Package
                  <Zap size={16} fill="currentColor" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-10"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">Choose the <span className="text-[#FA6400]">Package</span></h3>
                  <p className="text-sm font-medium text-slate-500">For {userInfo.name} ({userInfo.phoneNumber})</p>
                </div>

                <MembershipPackages 
                  light={true} 
                  compact={false} 
                  selectedPlan={selectedPlan}
                  onSelect={(plan) => {
                    setSelectedPlan(plan.name);
                    if (plan.pricingMatrix) {
                      // Reset matrix values
                      setSelectedDuration("1_month");
                      setSelectedCategory("");
                      setCustomPrice(0);
                    } else {
                      setCustomPrice(plan.price);
                    }
                    setStep(3);
                  }}
                />

                <button
                  onClick={() => setStep(1)}
                  className="mx-auto text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0c0b5d] transition-colors"
                >
                  Change Member Info
                </button>
              </motion.div>
            )}

            {step === 3 && selectedTier && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col lg:grid lg:grid-cols-12 gap-8"
              >
                {/* Left Side - Config */}
                <div className="lg:col-span-7 flex flex-col gap-8">
                  {/* Pricing Matrix */}
                  {selectedTier.pricingMatrix && (
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Schedule */}
                    <div className="flex flex-col gap-6">
                      <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex-1">
                        <div className="flex items-center gap-3 mb-6">
                          <Calendar size={20} className="text-[#FA6400]" />
                          <h4 className="text-lg font-black text-[#0c0b5d] uppercase italic tracking-tight">Start Date</h4>
                        </div>
                        <input
                          type="date"
                          value={selectedStartDate}
                          onChange={(e) => setSelectedStartDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#FA6400] focus:outline-none transition-all"
                        />
                      </div>

                      <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <CalendarOff size={20} className="text-red-500" />
                          <h4 className="text-lg font-black text-[#0c0b5d] uppercase italic tracking-tight">Exclude Days</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mb-4 leading-normal">
                          Select days to exclude from this membership (the timeslot on these days will be open for public booking).
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleExcludedDay(day)}
                              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border-2 transition-all ${
                                excludedDays.includes(day) 
                                  ? "bg-red-500 text-white border-red-500 hover:bg-red-600 hover:border-red-600 shadow-md shadow-red-500/10" 
                                  : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600"
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedDuration === "3_days" && (
                        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3 mb-6">
                            <Layers size={20} className="text-[#FA6400]" />
                            <h4 className="text-lg font-black text-[#0c0b5d] uppercase italic tracking-tight">Weekly sessions</h4>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                              <button
                                key={day}
                                onClick={() => toggleDay(day)}
                                className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border-2 transition-all ${
                                  selectedDays.includes(day) 
                                    ? "bg-[#0c0b5d] text-white border-[#0c0b5d]" 
                                    : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100"
                                }`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Time Slots */}
                    <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                       <div className="flex items-center gap-3 mb-6">
                         <Clock size={20} className="text-[#FA6400]" />
                         <h4 className="text-lg font-black text-[#0c0b5d] uppercase italic tracking-tight">Time Slot</h4>
                       </div>
                       
                       {availableTimeSlotsQuery.isLoading ? (
                         <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-[#FA6400]" /></div>
                       ) : (
                         <div className="grid grid-cols-2 gap-2">
                           {filteredSlots.map(slot => (
                             <button
                               key={slot.slot}
                               disabled={!slot.available}
                               onClick={() => setSelectedTimeSlot(slot.slot)}
                               className={`py-3 rounded-xl text-xs font-black transition-all border-2 ${
                                 selectedTimeSlot === slot.slot
                                   ? "bg-[#FA6400] border-[#FA6400] text-white"
                                   : slot.available
                                     ? "bg-white border-slate-100 hover:border-[#FA6400]"
                                     : "bg-slate-50 border-transparent text-slate-300 opacity-40 cursor-not-allowed"
                               }`}
                             >
                               {formatTimeTo12h(slot.slot)}
                             </button>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
                </div>

                {/* Right Side - Recap */}
                <div className="lg:col-span-5">
                  <div className="bg-[#0c0b5d] rounded-[40px] p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 pointer-events-none">
                       <Zap size={150} />
                    </div>

                    <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-8 pb-6 border-b border-white/10">The Recap</h4>

                    <div className="flex flex-col gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Member</span>
                        <p className="text-xl font-black italic">{userInfo.name}</p>
                        <p className="text-xs text-[#FA6400] font-bold">{userInfo.phoneNumber}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Package</span>
                        <p className="text-xl font-black italic text-[#FA6400]">{selectedTier.name}</p>
                      </div>

                      <div className="flex flex-col gap-3 bg-white/5 p-5 rounded-2xl border border-white/5">
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Duration</span>
                            <span className="text-xs font-black italic uppercase">{selectedDuration.replace('_', ' ')}</span>
                         </div>
                         {selectedCategory && (
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Cycle</span>
                              <span className="text-xs font-black italic uppercase text-[#FA6400]">{selectedCategory}</span>
                           </div>
                         )}
                         {selectedTimeSlot && (
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Reserved Slot</span>
                              <span className="text-xs font-black italic">{formatTimeTo12h(selectedTimeSlot)}</span>
                           </div>
                         )}
                         {excludedDays.length > 0 && (
                           <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black uppercase text-white/40 tracking-widest mt-0.5">Excluded</span>
                              <span className="text-xs font-black italic uppercase text-red-400 text-right max-w-[60%]">
                                {excludedDays.map(d => d.slice(0, 3)).join(", ")}
                              </span>
                           </div>
                         )}
                      </div>

                      <div className="flex flex-col gap-1 pt-6 border-t border-white/10">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Investment</span>
                        <div className="flex items-center gap-4">
                           <input 
                             type="number"
                             value={customPrice}
                             onChange={(e) => setCustomPrice(Number(e.target.value))}
                             className="bg-transparent text-5xl font-black italic w-full focus:outline-none focus:text-[#FA6400] transition-colors"
                           />
                           <span className="text-[#FA6400] font-black">NPR</span>
                        </div>
                      </div>

                      <div className="flex gap-4 mt-4">
                         <button
                           onClick={() => setStep(2)}
                           className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                         >
                           Change Plan
                         </button>
                         <button
                           onClick={handleManualSubscribe}
                           disabled={manualSubscribeMutation.isPending || !selectedTimeSlot || (!!selectedTier.pricingMatrix && !selectedCategory)}
                           className="flex-[2] py-4 rounded-2xl font-black uppercase tracking-[0.15em] text-xs bg-[#FA6400] text-white hover:bg-white hover:text-[#0c0b5d] transition-all shadow-xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                         >
                           {manualSubscribeMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : "Finalize Registration"}
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
