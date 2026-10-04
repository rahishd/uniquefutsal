"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TicketPercent,
  Plus,
  Search,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Gift,
  Copy,
  X,
  Trash2,
  Loader2,
  Calendar,
  Clock,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { PromoCode } from "@/lib/api/settings";
import { useSettings, useUpdateSettings } from "@/lib/hooks";
import { toast } from "sonner";

type PromoTypeFilter = "All" | "Percentage" | "Fixed Amount" | "Booking Only" | "Membership Only";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const normalizePromoType = (type: string): "percent" | "flat" => {
  const normalized = type.toLowerCase();
  if (
    normalized === "percent" ||
    normalized === "percentage" ||
    normalized === "%"
  ) {
    return "percent";
  }
  return "flat";
};

// Check if promo is expired
const isPromoExpired = (promo: PromoCode): boolean => {
  if (!promo.expiryDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(promo.expiryDate);
  return expiry < today;
};

// Format date for display
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function PromotionsManagement() {
  // TanStack Query hooks
  const router = useRouter();
  const { data: settingsData, isLoading, isError } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const [activeFilter, setActiveFilter] = useState<PromoTypeFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    discount: "",
    type: "Percentage" as "Percentage" | "Fixed Amount",
    title: "",
    description: "",
    expiryDate: "",
    startTime: "",
    endTime: "",
    validDays: [] as string[],
    appliedTo: "both" as "booking" | "membership" | "both",
  });

  // Extract promos from settings
  const promos = useMemo(() => {
    if (!settingsData?.settings.promoCodes) return [];
    return settingsData.settings.promoCodes.map((promo) => ({
      ...promo,
      type: normalizePromoType(promo.type as unknown as string),
    }));
  }, [settingsData]);

  const error = isError ? "Failed to load promotions" : "";

  const filteredPromos = useMemo(() => {
    return promos.filter((promo) => {
      const normalizedType = normalizePromoType(promo.type as unknown as string);
      const promoTypeLabel =
        normalizedType === "percent" ? "Percentage" : "Fixed Amount";
      const matchesFilter =
        activeFilter === "All" || 
        (activeFilter === "Percentage" && normalizedType === "percent") ||
        (activeFilter === "Fixed Amount" && normalizedType === "flat") ||
        (activeFilter === "Booking Only" && promo.appliedTo === "booking") ||
        (activeFilter === "Membership Only" && promo.appliedTo === "membership");
        
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        promo.code.toLowerCase().includes(searchLower) ||
        promo.label.toLowerCase().includes(searchLower);

      return matchesFilter && matchesSearch;
    });
  }, [promos, activeFilter, searchQuery]);

  const persistPromos = (nextPromos: PromoCode[]) => {
    if (!settingsData) return;

    updateSettingsMutation.mutate(
      {
        promoCodes: nextPromos,
      },
      {
        onSuccess: () => {
          toast.success("Promo codes updated successfully");
        },
        onError: (err) => {
          console.error("Failed to save promotions:", err);
          toast.error(
            err instanceof Error ? err.message : "Failed to save promotions"
          );
        },
      }
    );
  };

  const handleGenerate = async () => {
    if (!formData.code || !formData.discount) return;

    const normalizedCode = formData.code.toUpperCase().replace(/\s/g, "");
    const value = Number(formData.discount);

    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Discount value must be greater than 0"); return;
      return;
    }

    // Check for duplicate code (but allow same code when editing the same promo)
    const isDuplicate = promos.some(
      (promo) => promo.code.toUpperCase() === normalizedCode && 
      (!editingPromo || promo.code !== editingPromo.code)
    );
    
    if (isDuplicate) {
      toast.error("Promo code already exists"); return;
      return;
    }

    const updatedPromo: PromoCode = {
      code: normalizedCode,
      type: formData.type === "Percentage" ? "percent" : "flat",
      value,
      label:
        formData.description.trim() ||
        (formData.type === "Percentage" ? `${value}% off` : `Rs ${value} off`),
      title: formData.title.trim() || normalizedCode,
      description: formData.description.trim(),
      expiryDate: formData.expiryDate || undefined,
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      validDays: formData.validDays.length > 0 ? formData.validDays : undefined,
      isActive: true,
      appliedTo: formData.appliedTo,
    };

    let nextPromos: PromoCode[];
    
    if (editingPromo) {
      // Update existing promo
      nextPromos = promos.map((p) => 
        p.code === editingPromo.code ? updatedPromo : p
      );
    } else {
      // Add new promo
      nextPromos = [updatedPromo, ...promos];
    }

    try {
      await persistPromos(nextPromos);
      if (editingPromo) {
        toast.success("Promo code updated successfully!");
      } else {
        toast.success("Promo code created successfully!");
        setJustAdded(updatedPromo.code);
        setTimeout(() => setJustAdded(null), 3000);
      }
      closeModal();
    } catch {
      toast.error("Failed to save promo code");
    }
  };

  const handleDeletePromo = async (code: string) => {
    const nextPromos = promos.filter((promo) => promo.code !== code);
    try {
      await persistPromos(nextPromos);
      toast.success("Promo code deleted successfully!");
    } catch {
      toast.error("Failed to delete promo code");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPromo(null);
    setFormData({
      code: "",
      discount: "",
      type: "Percentage",
      title: "",
      description: "",
      expiryDate: "",
      startTime: "",
      endTime: "",
      validDays: [],
      appliedTo: "both",
    });
    // Error handled by toast
  };

  const handleEditPromo = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      discount: String(promo.value),
      type: promo.type === "percent" ? "Percentage" : "Fixed Amount",
      title: promo.title || "",
      description: promo.description || "",
      expiryDate: promo.expiryDate || "",
      startTime: promo.startTime || "",
      endTime: promo.endTime || "",
      validDays: promo.validDays || [],
      appliedTo: promo.appliedTo || "both",
    });
    setIsModalOpen(true);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error("Failed to copy promo code:", err);
    }
  };

  const totalEstimatedDiscount = promos.reduce(
    (sum, promo) => sum + promo.value,
    0,
  );

  const percentCount = promos.filter(
    (p) => normalizePromoType(p.type as unknown as string) === "percent",
  ).length;
  const flatCount = promos.filter(
    (p) => normalizePromoType(p.type as unknown as string) === "flat",
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Promotions <span className="text-[#FA6400]">& Offers</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Manage promo codes directly from backend settings.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#0c0b5d] text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/10 hover:scale-[1.02] transition-all cursor-pointer"
        >
          <Plus size={18} /> Generate Promo Code
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-125">
            <div className="p-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                {(["All", "Percentage", "Fixed Amount", "Booking Only", "Membership Only"] as PromoTypeFilter[]).map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer ${
                        activeFilter === f
                          ? "bg-[#0c0b5d] text-white shadow-lg"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {f}
                    </button>
                  ),
                )}
              </div>
              <div className="relative group w-full sm:w-64">
                <Search
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0c0b5d] transition-colors"
                  size={16}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-14 pr-4 text-xs font-bold focus:ring-1 focus:ring-[#0c0b5d] transition-all outline-none"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Loader2 size={34} className="animate-spin" />
                  <p className="text-sm font-bold">Loading promotions...</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                      <th className="px-8 py-6">Voucher Code</th>
                      <th className="px-6 py-6 text-center">Benefit</th>
                      <th className="px-6 py-6 text-center">Applies To</th>
                      <th className="px-6 py-6 text-center">Validity</th>
                      <th className="px-6 py-6 text-center">Status</th>
                      <th className="px-8 py-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPromos.length > 0 ? (
                      filteredPromos.map((promo) => {
                        const promoType = normalizePromoType(
                          promo.type as unknown as string,
                        );
                        const expired = isPromoExpired(promo);

                        return (
                          <tr
                            key={promo.code}
                            className={`hover:bg-slate-50/50 transition-colors group ${
                              justAdded === promo.code ? "bg-orange-50/50" : ""
                            } ${expired ? "opacity-60" : ""}`}
                          >
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-[#0c0b5d] font-mono tracking-wider">
                                    {promo.code}
                                  </span>
                                  {justAdded === promo.code && (
                                    <span className="text-[8px] font-black uppercase tracking-widest bg-orange-100 text-[#FA6400] border border-orange-200 px-2 py-0.5 rounded-full">
                                      New
                                    </span>
                                  )}
                                  <button
                                    onClick={() => copyCode(promo.code)}
                                    className="text-slate-300 hover:text-[#FA6400] transition-colors cursor-pointer"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                                <span className="text-[10px] font-medium text-slate-400">
                                  {promo.title || promo.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-[#FA6400]">
                                  {promoType === "percent"
                                    ? `${promo.value}%`
                                    : `Rs. ${promo.value}`} OFF
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                  {promoType === "percent"
                                    ? "Percentage"
                                    : "Fixed Amount"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <div className="flex justify-center">
                                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                                  promo.appliedTo === 'booking' ? 'bg-indigo-50 text-indigo-600' :
                                  promo.appliedTo === 'membership' ? 'bg-purple-50 text-purple-600' :
                                  'bg-green-50 text-green-600'
                                }`}>
                                  {promo.appliedTo || 'both'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-6">
                              <div className="flex flex-col items-center gap-1">
                                {promo.expiryDate && (
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                                    <Calendar size={10} />
                                    Until {formatDate(promo.expiryDate)}
                                  </div>
                                )}
                                {promo.startTime && promo.endTime && (
                                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                                    <Clock size={10} />
                                    {promo.startTime} - {promo.endTime}
                                  </div>
                                )}
                                {promo.validDays && promo.validDays.length > 0 && (
                                  <div className="text-[9px] font-bold text-slate-400 max-w-24 truncate" title={promo.validDays.join(", ")}>
                                    {promo.validDays.length === 7 ? "All days" : promo.validDays.slice(0, 2).join(", ") + (promo.validDays.length > 2 ? "..." : "")}
                                  </div>
                                )}
                                {!promo.expiryDate && !promo.startTime && !promo.validDays?.length && (
                                  <span className="text-[9px] text-slate-300">No restrictions</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <div className="flex justify-center">
                                {expired ? (
                                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-red-50 text-red-500">
                                    <AlertCircle size={12} />
                                    Expired
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-green-50 text-green-600">
                                    <CheckCircle2 size={12} />
                                    Active
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEditPromo(promo)}
                                  disabled={updateSettingsMutation.isPending}
                                  className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                >
                                  <Pencil size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeletePromo(promo.code)}
                                  disabled={updateSettingsMutation.isPending}
                                  className="text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-8 py-12 text-center text-slate-500 font-medium"
                        >
                          No promotions found matching {searchQuery}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-[#0c0b5d] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FA6400]/10 blur-3xl rounded-full" />
            <h3 className="text-xl font-black uppercase tracking-widest mb-8 border-b border-white/10 pb-4">
              Performance
            </h3>

            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-[#FA6400] rounded-[22px] flex items-center justify-center shadow-lg shadow-[#FA6400]/20">
                  <TrendingUp size={32} />
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl font-black italic">{promos.length}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Active Campaigns
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/60 font-black uppercase tracking-widest text-[10px]">
                    Estimated Total Discount
                  </span>
                  <span className="font-bold">{totalEstimatedDiscount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/60 font-black uppercase tracking-widest text-[10px]">
                    Promo Type Mix
                  </span>
                  <span className="font-bold">
                    {percentCount} / {flatCount}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => router.push("/uniquesuperadmin/promotions/report")}
                className="w-full bg-white text-[#0c0b5d] py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl cursor-pointer"
              >
                Detailed Report <ChevronRight size={16} className="inline ml-2" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-8 flex flex-col gap-6 max-h-full overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tight">
                  {editingPromo ? "Edit" : "Generate"} <span className="text-[#FA6400]">Promo Code</span>
                </h2>
                <p className="text-[10px] font-medium text-slate-400 mt-1">
                  {editingPromo ? "Update this discount code." : "Create a new discount code and save it to backend."}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Promo Code (*)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SUMMER20"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none uppercase font-mono tracking-widest"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weekend Warrior"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Discount Type
                  </label>
                  <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "Percentage" })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        formData.type === "Percentage"
                          ? "bg-white shadow-sm text-[#0c0b5d]"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "Fixed Amount" })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        formData.type === "Fixed Amount"
                          ? "bg-white shadow-sm text-[#0c0b5d]"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Rs
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Discount Value (*)
                  </label>
                  <input
                    type="number"
                    placeholder={
                      formData.type === "Percentage" ? "e.g. 20" : "e.g. 500"
                    }
                    value={formData.discount}
                    onChange={(e) =>
                      setFormData({ ...formData, discount: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Summer holiday discount for all bookings"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Applies To
                </label>
                <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1">
                  {(["booking", "membership", "both"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, appliedTo: type })}
                      className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        formData.appliedTo === type
                          ? "bg-white shadow-md text-[#0c0b5d]"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiry Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Calendar size={12} /> Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expiryDate: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
                />
              </div>

              {/* Time Restrictions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Clock size={12} /> Valid From Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Clock size={12} /> Valid Until Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none"
                  />
                </div>
              </div>

              {/* Valid Days */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Valid Days (leave empty for all days)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const days = formData.validDays.includes(day)
                          ? formData.validDays.filter((d) => d !== day)
                          : [...formData.validDays, day];
                        setFormData({ ...formData, validDays: days });
                      }}
                      className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                        formData.validDays.includes(day)
                          ? "bg-[#0c0b5d] text-white"
                          : "bg-slate-50 text-slate-400 hover:text-slate-600 border border-slate-100"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-slate-50">
              <button
                onClick={closeModal}
                className="w-full bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!formData.code || !formData.discount || updateSettingsMutation.isPending}
                className="w-full bg-[#FA6400] text-white font-black uppercase tracking-[0.15em] text-[10px] py-4 rounded-2xl hover:scale-[1.02] shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
              >
                {updateSettingsMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingPromo ? "Update Code" : "Generate Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
