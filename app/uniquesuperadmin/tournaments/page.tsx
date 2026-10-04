"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTournaments,
  saveTournament,
  deleteTournament,
  uploadTournamentInvoice,
  completeTournament,
  Tournament,
} from "@/lib/api/tournaments";
import { generateTournamentPDF } from "@/lib/utils/tournament-pdf";
import { inventoryApi } from "@/lib/api/inventory";
import {
  Trophy,
  Minus,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Droplets,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Loader2,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { formatTimeTo12h } from "@/lib/utils/time";

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const time24 = `${h.toString().padStart(2, "0")}:${m}`;
  return {
    value: time24,
    label: formatTimeTo12h(time24)
  };
});

function TimeSelect({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedLabel = TIME_SLOTS.find(s => s.value === value)?.label ?? value;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Auto-scroll to selected item when opened
  useEffect(() => {
    if (!open || !listRef.current) return;
    const idx = TIME_SLOTS.findIndex(s => s.value === value);
    if (idx >= 0) {
      const itemH = 36; // approx height per item in px
      const scrollTop = Math.max(0, idx * itemH - itemH * 3);
      listRef.current.scrollTop = scrollTop;
    }
  }, [open, value]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[11px] font-black text-[#0c0b5d] outline-none cursor-pointer flex items-center justify-between hover:bg-white hover:border-slate-200 transition-all focus:ring-2 focus:ring-[#FA6400]/10 shadow-sm"
      >
        <span>{selectedLabel}</span>
        <Clock size={12} className={`transition-colors ${open ? "text-[#FA6400]" : "text-slate-400"}`} />
      </button>

      {/* Custom dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {/* Period labels */}
          <div className="flex border-b border-slate-100 bg-slate-50 px-2 py-1.5 gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>All Day Slots</span>
            <span className="ml-auto text-[#FA6400]">{TIME_SLOTS.length} slots</span>
          </div>
          <div
            ref={listRef}
            className="overflow-y-auto"
            style={{ maxHeight: "288px" }}
          >
            {TIME_SLOTS.map((slot) => {
              const isSelected = slot.value === value;
              const h = parseInt(slot.value.split(":")[0]);
              const isPM = h >= 12;
              return (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => { onChange(slot.value); setOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[11px] font-bold flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-[#FA6400] text-white"
                      : "text-slate-700 hover:bg-[#FA6400]/8 hover:text-[#FA6400]"
                  }`}
                >
                  <span>{slot.label}</span>
                  <span className={`text-[9px] font-black uppercase ${isSelected ? "text-white/70" : isPM ? "text-orange-400" : "text-blue-400"}`}>
                    {isPM ? "PM" : "AM"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type TournamentFormState = {
  name: string;
  firstPrize: string;
  secondPrize: string;
  thirdPrize: string;
  organizerName: string;
  minTeams: number;
  maxTeams: number;
  startDate: string;
  endDate: string;
  bookedHours: number;
  hourlyRate: number;
  groundTotal: number;
  hasMineralWater: boolean;
  waterQuantity: number;
  hasSkyRoofSpectator: boolean;
  hasHealthInsurance: boolean;
  insurancePercent: number;
  advancePayment: number;
  newAdvancePayment?: number;
  registeredDate: string;
  isActive: boolean;
  paymentStatus: "paid" | "unpaid";
  description: string;
  dailySchedules: {
    date: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
  }[];
};

const today = new Date().toISOString().split("T")[0];

const defaultFormData: TournamentFormState = {
  name: "",
  firstPrize: "",
  secondPrize: "",
  thirdPrize: "",
  organizerName: "",
  minTeams: 4,
  maxTeams: 16,
  startDate: "",
  endDate: "",
  bookedHours: 0,
  hourlyRate: 1000,
  groundTotal: 0,
  hasMineralWater: false,
  waterQuantity: 0,
  hasSkyRoofSpectator: false,
  hasHealthInsurance: false,
  insurancePercent: 5,
  advancePayment: 0,
  newAdvancePayment: 0,
  registeredDate: today,
  isActive: true,
  paymentStatus: "unpaid",
  description: "",
  dailySchedules: [],
};

export default function AdminTournamentsPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [itemToCheckout, setItemToCheckout] = useState<Tournament | null>(null);
  const [formData, setFormData] =
    useState<TournamentFormState>(defaultFormData);
  
  // WhatsApp Share State
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingTournament, setSharingTournament] = useState<Tournament | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: getTournaments,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => inventoryApi.getProducts(),
  });
  const waterProduct = useMemo(
    () =>
      products.find((p) => {
        const name = p.name.toLowerCase();
        return name.includes("water") || name.includes("mineral");
      }),
    [products],
  );

  const maxWaterAllowed = useMemo(() => {
    if (!waterProduct) return 0;
    const currentInventory = waterProduct.inventory || 0;
    const originalUsage = editingId 
      ? (tournaments.find(t => t.id === editingId)?.waterQuantity || 0)
      : 0;
    return currentInventory + originalUsage;
  }, [waterProduct, editingId, tournaments]);

  // Auto-generate daily schedules when date range changes
  useMemo(() => {
    if (!formData.startDate || !formData.endDate) return;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;

    const newSchedules: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const existing = formData.dailySchedules.find(s => s.date === dateStr);
      
      newSchedules.push(existing || {
        date: dateStr,
        startTime: "06:00",
        endTime: "15:00",
        isOff: false
      });
    }

    // Only update if the number of days or the dates themselves changed
    const currentDates = formData.dailySchedules.map(s => s.date).join(',');
    const newDates = newSchedules.map(s => s.date).join(',');
    
    if (currentDates !== newDates) {
      setFormData(prev => ({ ...prev, dailySchedules: newSchedules }));
    }
  }, [formData.startDate, formData.endDate]);

  // Auto-calculate booked hours from daily schedules
  const calculatedBookedHours = useMemo(() => {
    return formData.dailySchedules.reduce((acc, curr) => {
      if (curr.isOff) return acc;
      const [sh, sm] = curr.startTime.split(':').map(Number);
      const [eh, em] = curr.endTime.split(':').map(Number);
      const duration = (eh + em / 60) - (sh + sm / 60);
      return acc + Math.max(0, duration);
    }, 0);
  }, [formData.dailySchedules]);

  // Auto-update groundTotal when rate or hours change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      groundTotal: prev.hourlyRate * calculatedBookedHours
    }));
  }, [formData.hourlyRate, calculatedBookedHours]);

  const totals = useMemo(() => {
    const waterUnitPrice = waterProduct?.price || 0;
    const waterCharge = formData.hasMineralWater
      ? formData.waterQuantity * waterUnitPrice
      : 0;
    const skyRoofCharge = formData.hasSkyRoofSpectator ? 2000 : 0;
    const subTotal =
      formData.groundTotal + waterCharge + skyRoofCharge;
    const insuranceCharge = formData.hasHealthInsurance
      ? (subTotal * formData.insurancePercent) / 100
      : 0;
    const totalAmount = subTotal + insuranceCharge;
    const suggestedAdvance = totalAmount * 0.5;

    return {
      waterUnitPrice,
      waterCharge,
      skyRoofCharge,
      subTotal,
      insuranceCharge,
      totalAmount,
      suggestedAdvance,
    };
  }, [formData, waterProduct?.price, calculatedBookedHours]);

  const saveMutation = useMutation({
    mutationFn: saveTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsFormOpen(false);
      resetForm();
      toast.success("Tournament agreement saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save tournament");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament deleted successfully");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: () => {
      toast.error("Failed to delete tournament");
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeTournament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setCheckoutDialogOpen(false);
      setItemToCheckout(null);
      toast.success("Tournament marked as completed and revenue recorded!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to complete tournament");
    }
  });

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCheckoutClick = (t: Tournament) => {
    setItemToCheckout(t);
    setCheckoutDialogOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (formData.minTeams >= formData.maxTeams) {
      toast.error("Min teams must be less than max teams");
      return;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const todayDate = new Date(today);

    if (start < todayDate) {
      toast.error("Start date cannot be in the past");
      return;
    }
    if (end < start) {
      toast.error("End date cannot be before start date");
      return;
    }

    // Optional: Validate match times if date is today
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const isToday = formData.startDate === today;

    if (isToday) {
      const firstActiveSchedule = formData.dailySchedules.find(s => s.date === today && !s.isOff);
      if (firstActiveSchedule) {
        const [sh, sm] = firstActiveSchedule.startTime.split(':').map(Number);
        if (sh < currentHour || (sh === currentHour && sm < currentMin)) {
          toast.error("Tournament start time cannot be in the past for today");
          return;
        }
      }
    }

    if (formData.hasMineralWater && formData.waterQuantity > maxWaterAllowed) {
      toast.error(`Insufficient water inventory. Max available: ${maxWaterAllowed}`);
      return;
    }

    const id = editingId || `tourney-${Date.now()}`;
    const firstPrizeAmount = Number(formData.firstPrize) || 0;
    const secondPrizeAmount = Number(formData.secondPrize) || 0;
    const thirdPrizeAmount = Number(formData.thirdPrize) || 0;
    const agreementMeta = {
      firstPrize: formData.firstPrize,
      secondPrize: formData.secondPrize,
      thirdPrize: formData.thirdPrize,
      organizerName: formData.organizerName,
      bookedHours: calculatedBookedHours,
      hourlyRate: formData.hourlyRate,
      groundTotal: formData.groundTotal,
      hasMineralWater: formData.hasMineralWater,
      waterQuantity: formData.hasMineralWater ? formData.waterQuantity : 0,
      waterUnitPrice: totals.waterUnitPrice,
      waterCharge: totals.waterCharge,
      hasSkyRoofSpectator: formData.hasSkyRoofSpectator,
      skyRoofCharge: totals.skyRoofCharge,
      hasHealthInsurance: formData.hasHealthInsurance,
      insurancePercent: formData.insurancePercent,
      insuranceCharge: totals.insuranceCharge,
      subTotal: totals.subTotal,
      totalAmount: totals.totalAmount,
      advancePayment: editingId
        ? (formData.advancePayment || 0) + (formData.newAdvancePayment || 0)
        : (formData.advancePayment || 0),
      registeredDate: formData.registeredDate || today,
      dailySchedules: formData.dailySchedules,
      notes: formData.description
    };

    const payload: any = {
      ...formData,
      id,
      status: editingId ? (tournaments.find(t => t.id === editingId)?.status || "active") : "active",
      prizePool: firstPrizeAmount + secondPrizeAmount + thirdPrizeAmount,
      totalAmount: totals.totalAmount,
      bookedHours: calculatedBookedHours,
      paymentStatus: formData.paymentStatus,
      // Individual fields for backend DTO
      waterUnitPrice: totals.waterUnitPrice,
      waterCharge: totals.waterCharge,
      skyRoofCharge: totals.skyRoofCharge,
      insuranceCharge: totals.insuranceCharge,
      subTotal: totals.subTotal,
      advancePayment: editingId
        ? (formData.advancePayment || 0) + (formData.newAdvancePayment || 0)
        : (formData.advancePayment || 0),
      dailySchedules: JSON.stringify(formData.dailySchedules),
      description: formData.description, // Backend buildDescription uses this as 'notes'
    };
    saveMutation.mutate(payload);
  };

  const handleEdit = (t: Tournament) => {
    setFormData({
      name: t.name,
      firstPrize: t.firstPrize || "",
      secondPrize: t.secondPrize || "",
      thirdPrize: t.thirdPrize || "",
      organizerName: t.organizerName || "",
      minTeams: t.minTeams,
      maxTeams: t.maxTeams,
      startDate: t.startDate,
      endDate: t.endDate,
      bookedHours: t.bookedHours ?? 0,
      hourlyRate: (t as any).hourlyRate ?? 1000,
      groundTotal: (t as any).groundTotal ?? 0,
      hasMineralWater: Boolean(t.hasMineralWater),
      waterQuantity: t.waterQuantity || 0,
      hasSkyRoofSpectator: Boolean(t.hasSkyRoofSpectator),
      hasHealthInsurance: Boolean(t.hasHealthInsurance),
      insurancePercent: t.insurancePercent || 5,
      advancePayment: t.advancePayment || 0,
      newAdvancePayment: 0,
      registeredDate: t.registeredDate || today,
      isActive: t.isActive,
      paymentStatus: t.paymentStatus || "unpaid",
      description: t.description || "",
      dailySchedules: t.dailySchedules || [],
    });
    setEditingId(t.id);
    setIsFormOpen(true);
  };

  const handleWaterUpdate = (t: Tournament, delta: number) => {
    const currentQty = t.waterQuantity || 0;
    const waterProductForThis = products.find(p => p.name.toLowerCase().includes("water") || p.name.toLowerCase().includes("mineral"));
    const maxForThis = (waterProductForThis?.inventory || 0) + currentQty;

    const newQuantity = Math.max(0, currentQty + delta);
    if (newQuantity === currentQty) return;

    if (delta > 0 && newQuantity > maxForThis) {
      toast.error(`Insufficient water inventory (${waterProductForThis?.inventory || 0} remaining)`);
      return;
    }

    const hasMineralWater = newQuantity > 0 ? true : t.hasMineralWater;
    const waterUnitPrice = t.waterUnitPrice || waterProduct?.price || 25;
    const waterCharge = hasMineralWater ? newQuantity * waterUnitPrice : 0;
    const skyRoofCharge = t.hasSkyRoofSpectator ? 2000 : 0;
    // Robustly extract base values, prioritizing what's already on the tournament object
    const currentGroundTotal = Number((t as any).groundTotal) ?? 0;
    const currentBookedHours = Number(t.bookedHours) ?? 0;
    const currentHourlyRate = Number(t.hourlyRate) ?? 0;
    
    // If groundTotal is 0 or missing, try to estimate from hours * rate
    const groundTotal = currentGroundTotal > 0 ? currentGroundTotal : (currentBookedHours * currentHourlyRate);
    
    const subTotal = groundTotal + waterCharge + skyRoofCharge;
    const insuranceCharge = t.hasHealthInsurance
      ? (subTotal * (t.insurancePercent || 5)) / 100
      : 0;
    const totalAmount = subTotal + insuranceCharge;

    const payload: any = {
      ...t,
      id: t.id,
      name: t.name,
      hasMineralWater,
      waterQuantity: newQuantity,
      waterUnitPrice,
      waterCharge,
      subTotal,
      totalAmount,
      // Pass these explicitly for backend recalculation logic
      groundTotal: groundTotal,
      bookedHours: currentBookedHours,
      hourlyRate: currentHourlyRate,
      advancePayment: t.advancePayment,
      dailySchedules: typeof t.dailySchedules === 'string' ? t.dailySchedules : JSON.stringify(t.dailySchedules),
      description: t.description, // Raw notes string after parseTournament
    };

    saveMutation.mutate(payload);
  };

  const handleShareInvoice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sharingTournament || !whatsappNumber) return;

    setIsGeneratingPdf(true);
    toast.loading("Preparing professional invoice...", { id: "pdf-gen" });

    try {
      const doc = await generateTournamentPDF(sharingTournament);
      const pdfBase64 = doc.output("datauristring");

      const { invoiceUrl } = await uploadTournamentInvoice(
        sharingTournament.id,
        pdfBase64,
      );

      const message =
        `Hello *${sharingTournament.organizerName || "Organizer"}*, here is your tournament agreement/invoice for *${sharingTournament.name}*:\n\n` +
        `📄 *View Invoice:* ${invoiceUrl}\n\n` +
        `*Tournament Details:*\n` +
        `• Start Date: ${sharingTournament.startDate}\n` +
        `• End Date: ${sharingTournament.endDate}\n` +
        `• Total Amount: Rs. ${Number(sharingTournament.totalAmount || 0).toLocaleString()}\n\n` +
        `Thank you for choosing Unique Futsal!`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodedMessage}`;

      window.open(whatsappUrl, "_blank");
      toast.success("Invoice link prepared and WhatsApp opened", {
        id: "pdf-gen",
      });
      setShareDialogOpen(false);
      setSharingTournament(null);
      setWhatsappNumber("");
    } catch (error) {
      console.error("Invoice preparation failed:", error);
      toast.error("Failed to prepare invoice link", { id: "pdf-gen" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Tournament <span className="text-[#FA6400]">Manager</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Fill tournament agreement details and auto-sync water usage with
            inventory.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsFormOpen(!isFormOpen);
          }}
          className="flex items-center gap-2 bg-[#FA6400] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#FA6400]/20 hover:scale-[1.02] transition-all"
        >
          <Plus size={16} /> {isFormOpen ? "Cancel" : "Create Tournament"}
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm p-6 md:p-8 animate-in slide-in-from-top-4 fade-in">
          <h2 className="text-xl font-black text-[#0c0b5d] uppercase mb-6 flex items-center gap-2">
            <Trophy className="text-[#FA6400]" size={24} />
            {editingId
              ? "Edit Tournament Agreement"
              : "New Tournament Agreement"}
          </h2>
          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Tournament Title
              </label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                placeholder="e.g. Winter Cup 2026"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Organizer / Manager
              </label>
              <input
                required
                type="text"
                value={formData.organizerName}
                onChange={(e) =>
                  setFormData({ ...formData, organizerName: e.target.value })
                }
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <input
                placeholder="1st prize (Rs)"
                type="number"
                min="0"
                value={formData.firstPrize}
                onChange={(e) =>
                  setFormData({ ...formData, firstPrize: e.target.value })
                }
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
              />
              <input
                placeholder="2nd prize (Rs)"
                type="number"
                min="0"
                value={formData.secondPrize}
                onChange={(e) =>
                  setFormData({ ...formData, secondPrize: e.target.value })
                }
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
              />
              <input
                placeholder="3rd prize (Rs)"
                type="number"
                min="0"
                value={formData.thirdPrize}
                onChange={(e) =>
                  setFormData({ ...formData, thirdPrize: e.target.value })
                }
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Min Teams
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={formData.minTeams || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minTeams: Number(e.target.value),
                    })
                  }
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Max Teams
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={formData.maxTeams || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxTeams: Number(e.target.value),
                    })
                  }
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Start Date
                </label>
                <input
                  required
                  type="date"
                  min={today}
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold text-slate-500 focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  End Date
                </label>
                <input
                  required
                  type="date"
                  min={formData.startDate || today}
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold text-slate-500 focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Per Hour Price (Rs)
                </label>
                <input
                  required
                  min="0"
                  type="number"
                  value={formData.hourlyRate || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hourlyRate: Number(e.target.value),
                    })
                  }
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span>Total Ground Price (Rs)</span>
                  <span className="text-[10px] text-[#FA6400]">Auto-calculated</span>
                </label>
                <input
                  readOnly
                  type="number"
                  value={formData.groundTotal.toFixed(0) || ""}
                  className="bg-slate-100 border border-slate-100 rounded-xl p-3 text-sm font-black text-[#0c0b5d] outline-none w-full cursor-not-allowed"
                />
              </div>
            </div>

            {/* Daily Schedules Section */}
            {formData.dailySchedules.length > 0 && (
              <div className="md:col-span-2 flex flex-col gap-4 bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 mt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-[#0c0b5d] uppercase flex items-center gap-2">
                    <Calendar size={16} className="text-[#FA6400]" />
                    Daily Match Schedules
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="bg-[#0c0b5d] text-white px-4 py-1.5 rounded-full flex items-center gap-2">
                      <Clock size={12} className="text-[#FA6400]" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Booked: {calculatedBookedHours.toFixed(1)} Hours
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formData.dailySchedules.map((schedule, idx) => (
                    <div 
                      key={schedule.date} 
                      className={`p-4 rounded-2xl border transition-all ${
                        schedule.isOff 
                          ? "bg-slate-100/50 border-slate-200 grayscale-[0.5] opacity-60" 
                          : "bg-white border-slate-200 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black text-[#0c0b5d]">
                          {new Date(schedule.date).toLocaleDateString("en-US", { 
                            month: "short", 
                            day: "numeric",
                            weekday: "short"
                          })}
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {schedule.isOff ? "No Match" : "Active"}
                          </span>
                          <input 
                            type="checkbox"
                            checked={!schedule.isOff}
                            onChange={(e) => {
                              const newSchedules = [...formData.dailySchedules];
                              newSchedules[idx].isOff = !e.target.checked;
                              setFormData({ ...formData, dailySchedules: newSchedules });
                            }}
                            className="w-3 h-3 rounded-full accent-[#FA6400]"
                          />
                        </label>
                      </div>
                      
                      {!schedule.isOff && (
                        <div className="flex items-center gap-2">
                          <TimeSelect 
                            value={schedule.startTime}
                            onChange={(val) => {
                              const newSchedules = [...formData.dailySchedules];
                              newSchedules[idx].startTime = val;
                              setFormData({ ...formData, dailySchedules: newSchedules });
                            }}
                            className="flex-1"
                          />
                          <span className="text-slate-300 font-bold">-</span>
                          <TimeSelect 
                            value={schedule.endTime}
                            onChange={(val) => {
                              const newSchedules = [...formData.dailySchedules];
                              newSchedules[idx].endTime = val;
                              setFormData({ ...formData, dailySchedules: newSchedules });
                            }}
                            className="flex-1"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="rounded-xl border border-slate-100 p-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.hasMineralWater}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hasMineralWater: e.target.checked,
                    })
                  }
                />
                Mineral Water
              </label>
              <div className="rounded-xl border border-slate-100 p-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Water Qty
                </span>
                <input
                  min="0"
                  type="number"
                  value={formData.waterQuantity || ""}
                  disabled={!formData.hasMineralWater}
                  onChange={(e) => {
                    const val = Math.max(0, Number(e.target.value));
                    if (val > maxWaterAllowed) {
                      toast.error(`Cannot exceed available inventory (${maxWaterAllowed} units)`, { id: 'water-limit' });
                    }
                    setFormData({
                      ...formData,
                      waterQuantity: Math.min(val, maxWaterAllowed),
                    });
                  }}
                  className="bg-transparent text-sm font-bold outline-none"
                />
              </div>
              <div className="rounded-xl border border-slate-100 p-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Inventory
                </span>
                <span className={`text-sm font-bold ${formData.waterQuantity >= maxWaterAllowed && formData.hasMineralWater ? "text-red-500" : "text-slate-700"}`}>
                  {waterProduct
                    ? `${waterProduct.inventory} ${waterProduct.unit}`
                    : "Water item missing"}
                  {editingId && formData.hasMineralWater && (
                    <span className="text-[9px] block text-slate-400 mt-0.5">
                      (Total limit: {maxWaterAllowed})
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="rounded-xl border border-slate-100 p-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.hasSkyRoofSpectator}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hasSkyRoofSpectator: e.target.checked,
                    })
                  }
                />
                Sky Roof Spectator (+Rs. 2000)
              </label>
              <label className="rounded-xl border border-slate-100 p-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.hasHealthInsurance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hasHealthInsurance: e.target.checked,
                    })
                  }
                />
                Health Insurance
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Insurance %
              </label>
              <input
                min={0}
                type="number"
                value={formData.insurancePercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    insurancePercent: Number(e.target.value),
                  })
                }
                disabled={!formData.hasHealthInsurance}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none disabled:opacity-50"
              />
            </div>
            {/* Registered Date is now automatic */}
            <div className="md:col-span-2 bg-[#0c0b5d]/5 rounded-2xl p-4 border border-[#0c0b5d]/10 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Sub Total
                </p>
                <p className="text-sm font-black text-[#0c0b5d]">
                  Rs. {totals.subTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Water Charge
                </p>
                <p className="text-sm font-black text-[#0c0b5d]">
                  Rs. {totals.waterCharge.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Insurance
                </p>
                <p className="text-sm font-black text-[#0c0b5d]">
                  Rs. {totals.insuranceCharge.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Total
                </p>
                <p className="text-sm font-black text-[#0c0b5d]">
                  Rs. {totals.totalAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-red-500">
                  Balance Due
                </p>
                <p className="text-sm font-black text-red-600">
                  Rs. {Math.max(0, totals.totalAmount - (formData.advancePayment || 0) - (formData.newAdvancePayment || 0)).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                Payment Status
              </label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all"
              >
                <option value="unpaid">Unpaid (Draft)</option>
                <option value="paid">Paid (Finalized)</option>
              </select>
            </div>

            {editingId ? (
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Already Paid Advance
                  </label>
                  <input
                    readOnly
                    type="number"
                    value={formData.advancePayment || 0}
                    className="bg-slate-100 border border-slate-100 rounded-xl p-3 text-sm font-bold text-slate-500 cursor-not-allowed outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                    Add New Advance Amount
                  </label>
                  <input
                    min="0"
                    type="number"
                    value={formData.newAdvancePayment || ""}
                    onChange={(e) => {
                      const maxAllowed = Math.max(0, totals.totalAmount - (formData.advancePayment || 0));
                      let val = Number(e.target.value);
                      if (val > maxAllowed) {
                        toast.error(`Cannot exceed remaining balance (Rs. ${maxAllowed.toFixed(2)})`, { id: "advance-limit" });
                        val = maxAllowed;
                      }
                      setFormData({
                        ...formData,
                        newAdvancePayment: val,
                      });
                    }}
                    placeholder="e.g. 1000"
                    className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                  Advance Payment (Optional)
                </label>
                <input
                  min="0"
                  type="number"
                  value={formData.advancePayment || ""}
                  onChange={(e) => {
                    const maxAllowed = totals.totalAmount;
                    let val = Number(e.target.value);
                    if (val > maxAllowed) {
                      toast.error(`Cannot exceed total amount (Rs. ${maxAllowed.toFixed(2)})`, { id: "advance-limit" });
                      val = maxAllowed;
                    }
                    setFormData({
                      ...formData,
                      advancePayment: val,
                    });
                  }}
                  placeholder={totals.suggestedAdvance.toFixed(2)}
                  className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                />
              </div>
            )}
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Description / Terms Notes
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
                placeholder="Provide details, rules, etc."
              />
            </div>
            {/* <div className="md:col-span-2 flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-xl mt-2">
              <div className="flex flex-col">
                <span className="text-sm font-black text-orange-900 uppercase">
                  Active / Visible
                </span>
                <span className="text-xs font-medium text-orange-700">
                  Make this tournament visible to players
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-orange-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FA6400]"></div>
              </label>
            </div> */}
            <div className="md:col-span-2 flex gap-4 mt-4">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 bg-[#0c0b5d] text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#0c0b5d]/90 transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving..." : "Save Agreement"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tournament List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        {isLoading ? (
          <div className="col-span-1 lg:col-span-2 py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-[#FA6400]/20 border-t-[#FA6400] rounded-full animate-spin" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center p-12 bg-white/40 backdrop-blur-sm rounded-[32px] border border-gray-100 border-dashed text-slate-400">
            <Trophy size={48} className="mb-4 opacity-20" />
            <p className="font-bold text-sm">No tournaments created yet.</p>
          </div>
        ) : (
          tournaments.map((t) => {
            const isSettled = t.status === "completed" && t.paymentStatus === "paid";
            return (
            <div
              key={t.id}
              className="bg-white/80 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm p-6 group transition-all hover:border-[#0c0b5d]/20 hover:shadow-lg flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${t.isActive ? "text-green-500" : "text-slate-400"}`}
                  >
                    <Calendar size={12} /> {t.isActive ? "Active" : "Draft"}
                  </span>
                  <h3 className="text-xl font-black text-[#0c0b5d] uppercase mt-1">
                    {t.name}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSharingTournament(t);
                      setShareDialogOpen(true);
                    }}
                    className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-green-50 hover:text-green-600 transition-colors"
                    title="Send to WhatsApp"
                  >
                    Send to Whatsapp
                  </button>
                  <button
                    onClick={() => handleEdit(t)}
                    disabled={t.status === "completed" || isSettled}
                    className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t.status === "completed" ? "Cannot edit completed tournament" : "Edit Tournament"}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(t.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete Tournament"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {t.status === "completed" && (
                <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Tournament Completed</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700">Recorded on {t.completedAt ? format(new Date(t.completedAt), "MMM dd, yyyy") : "-"}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${t.paymentStatus === 'paid' ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                        {t.paymentStatus || 'unpaid'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4 flex-grow">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-orange-50 flex items-center justify-center text-[#FA6400]">
                    <Building2 size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Organizer
                    </span>
                    <span className="text-sm font-black text-[#0c0b5d]">
                      {t.organizerName || "-"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Droplets size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Water Usage
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleWaterUpdate(t, -1)}
                        disabled={saveMutation.isPending || isSettled}
                        className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saveMutation.isPending && (saveMutation.variables as any)?.id === t.id ? (
                           <Loader2 size={10} className="animate-spin" />
                        ) : (
                           <Minus size={12} />
                        )}
                      </button>
                      <span className="text-sm font-black text-[#0c0b5d] min-w-[2ch] text-center">
                        {t.waterQuantity || 0}
                      </span>
                      <button
                        onClick={() => handleWaterUpdate(t, 1)}
                        disabled={saveMutation.isPending || isSettled}
                        className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saveMutation.isPending && (saveMutation.variables as any)?.id === t.id ? (
                           <Loader2 size={10} className="animate-spin" />
                        ) : (
                           <Plus size={12} />
                        )}
                      </button>
                      <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                        units
                      </span>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Calendar size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Event Date
                    </span>
                    <span className="text-sm font-black text-[#0c0b5d]">
                      {t.startDate} to {t.endDate}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Total Amount
                      </span>
                      <span className="text-sm font-black text-[#0c0b5d]">
                        Rs. {Number(t.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-orange-50 flex items-center justify-center text-[#FA6400]">
                      <ArrowUpRight size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Remaining
                      </span>
                      <span className={`text-sm font-black ${t.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}>
                        Rs. {t.paymentStatus === 'paid' ? '0' : Number((t.totalAmount || 0) - (t.advancePayment || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {t.status !== "completed" && (
                <button
                  onClick={() => handleCheckoutClick(t)}
                  disabled={completeMutation.isPending}
                  className="mt-6 w-full bg-linear-to-r from-emerald-600 to-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group"
                >
                  {completeMutation.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <div className="bg-white/20 p-2 rounded-lg group-hover:rotate-12 transition-transform">
                        <Trophy size={18} />
                      </div>
                      <div className="flex flex-col items-start text-left">
                        <span className="leading-none">Final Checkout</span>
                        <span className="text-[8px] opacity-70 mt-1 uppercase tracking-tighter">Record Rs. {Number(t.totalAmount || 0).toLocaleString()} Revenue</span>
                      </div>
                    </>
                  )}
                </button>
              )}
            </div>
          );
          })
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Tournament"
        description="Are you sure you want to delete this tournament? This action cannot be undone and will remove all associated registrations."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
        onConfirm={() => {
          if (itemToDelete) deleteMutation.mutate(itemToDelete);
        }}
      />

      <ConfirmDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Send Invoice to WhatsApp"
        description={`Enter the WhatsApp number to send the invoice for "${sharingTournament?.name}".`}
        confirmText={isGeneratingPdf ? "Generating..." : "Send to WhatsApp"}
        cancelText="Cancel"
        onConfirm={() => handleShareInvoice()}
      >
        <div className="mt-4">
          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">
            WhatsApp Number
          </label>
          <input
            type="text"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none"
            placeholder="e.g. 9812345678"
            autoFocus
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={checkoutDialogOpen}
        onOpenChange={setCheckoutDialogOpen}
        onConfirm={() => {
          if (itemToCheckout) completeMutation.mutate(itemToCheckout.id);
        }}
        title="Confirm Final Checkout"
        description={`Are you sure you want to perform Final Checkout for "${itemToCheckout?.name}"? This will lock the tournament and record Rs. ${Number(itemToCheckout?.totalAmount || 0).toLocaleString()} as completed revenue in your reports.`}
        confirmText="Finalize & Record Revenue"
        cancelText="Not Yet"
      />
    </div>
  );
}
