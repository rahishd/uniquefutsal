"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  RotateCw,
  Plus,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatTimeTo12h } from "@/lib/utils/time";
import {
  MembershipSubscription,
  MembershipSettlementSummary,
  uploadMembershipInvoice,
  getSettlementSummary,
} from "@/lib/api/membership";
import { toast } from "sonner";
import { generateMembershipInvoicePDF } from "@/lib/utils/membership-invoice-pdf";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import AdminManualMembershipModal from "@/components/membership/AdminManualMembershipModal";
import { SmsConfirmModal } from "@/components/sms-confirm-modal";
import {
  useAllSubscriptions,
  useDeleteSubscription,
  useVerifyPayment,
  useUpdateSubscription,
  useRenewSubscription,
} from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { useClientPagination } from "@/lib/hooks/useClientPagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import MembershipPaymentModal, {
  PaymentData,
} from "@/components/membership/MembershipPaymentModal";
import { settlePayment } from "@/lib/api/membership";

type FilterType = "All" | "Pending" | "Active" | "Expired";

export default function MembershipsManagement() {
  const queryClient = useQueryClient();
  const subscriptionsQuery = useAllSubscriptions();
  const verifyPaymentMutation = useVerifyPayment();
  const deleteSubscriptionMutation = useDeleteSubscription();
  const updateSubscriptionMutation = useUpdateSubscription();
  const renewSubscriptionMutation = useRenewSubscription();

  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search");
  const highlightId = searchParams.get("highlight");

  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState(urlSearch || "");
  const [highlightedId, setHighlightedId] = useState<string | null>(
    highlightId,
  );
  const [selectedSubscription, setSelectedSubscription] =
    useState<MembershipSubscription | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenewConfirm, setShowRenewConfirm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [settlementSummary, setSettlementSummary] =
    useState<MembershipSettlementSummary | null>(null);
  const [isSettlementSummaryLoading, setIsSettlementSummaryLoading] =
    useState(false);
  const [smsConfirmModal, setSmsConfirmModal] = useState<{
    isOpen: boolean;
    subscriptionId: string;
  }>({
    isOpen: false,
    subscriptionId: "",
  });
  const subscriptions = subscriptionsQuery.data || [];

  const handleVerifyPayment = async (subscriptionId: string) => {
    setSmsConfirmModal({
      isOpen: true,
      subscriptionId,
    });
  };

  const onSmsConfirm = async (sendSms: boolean) => {
    try {
      await verifyPaymentMutation.mutateAsync({
        subscriptionId: smsConfirmModal.subscriptionId,
        sendSms,
      });
      toast.success("Membership activated!");
      setSelectedSubscription(null);
    } catch (err) {
      console.error("Failed to verify payment:", err);
      toast.error("Failed to verify payment");
    }
  };

  const handleDeleteSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      await deleteSubscriptionMutation.mutateAsync(selectedSubscription.id);
      toast.success("Membership deleted successfully!");
      setSelectedSubscription(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Failed to delete subscription:", err);
      toast.error("Failed to delete membership");
    }
  };

  const handleRenewSubscription = async () => {
    if (!selectedSubscription) return;

    try {
      await renewSubscriptionMutation.mutateAsync(selectedSubscription.id);
      toast.success("Membership renewed successfully!");
      setSelectedSubscription(null);
      setShowRenewConfirm(false);
    } catch (err) {
      console.error("Failed to renew subscription:", err);
      toast.error("Failed to renew membership");
    }
  };

  const handleSendWhatsApp = async (sub: MembershipSubscription) => {
    const rawPhone = sub.user?.phoneNumber?.replace(/\D/g, "");
    if (!rawPhone) {
      toast.error("No phone number found for this member");
      return;
    }

    try {
      toast.loading("Generating membership invoice...", {
        id: "membership-invoice",
      });
      const doc = await generateMembershipInvoicePDF(sub);
      const pdfBase64 = doc.output("datauristring");

      const { invoiceUrl } = await uploadMembershipInvoice(sub.id, pdfBase64);

      const phone = rawPhone.startsWith("977") ? rawPhone : `977${rawPhone}`;
      const message = `*Unique Futsal Membership Invoice*\n\nHello ${sub.user?.name || "Member"},\n\nThank you for choosing Unique Futsal! Your ${sub.plan.name} membership has been processed.\n\n*Summary:*\nPlan: ${sub.plan.name}\nDuration: ${sub.chosenDuration?.replace("_", " ") || "Standard"}\nValid Until: ${new Date(sub.endDate).toLocaleDateString()}\n\nView Invoice: ${invoiceUrl}\n\nSee you on the pitch!`;
      const encodedMsg = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phone}?text=${encodedMsg}`;

      window.open(whatsappUrl, "_blank");
      toast.success("Invoice sent to WhatsApp!", { id: "membership-invoice" });
    } catch (err) {
      console.error("Failed to send WhatsApp:", err);
      toast.error("Failed to send invoice", { id: "membership-invoice" });
    }
  };

  const handleOpenPaymentModal = async (sub: MembershipSubscription) => {
    setSelectedSubscription(sub);
    setShowPaymentModal(true);

    try {
      setIsSettlementSummaryLoading(true);
      const summary = await getSettlementSummary(sub.id);
      setSettlementSummary(summary);
    } catch (err) {
      console.error("Failed to load settlement summary:", err);
      toast.error("Failed to load previous payment details");
      setSettlementSummary(null);
    } finally {
      setIsSettlementSummaryLoading(false);
    }
  };

  const handleSettlePayment = async (paymentData: PaymentData) => {
    if (!selectedSubscription) return;

    try {
      setIsPaymentProcessing(true);
      await settlePayment(selectedSubscription.id, {
        method: paymentData.method,
        cashAmount: paymentData.cashAmount,
        onlineAmount: paymentData.onlineAmount,
        waterBottles: paymentData.waterBottles,
        addOns: paymentData.addOns,
        addOnsPrice: paymentData.addOnsPrice,
      });

      toast.success(`Payment updated for ${selectedSubscription.user?.name || "member"}`);
      setShowPaymentModal(false);
      setSelectedSubscription(null);
      setSettlementSummary(null);
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    } catch (err) {
      console.error("Error settling payment:", err);
      toast.error("Failed to settle payment");
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  const canRenew = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    // Also allow if already expired
    return diff <= sevenDaysInMs;
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    // Filter by status
    if (
      activeFilter === "Pending" &&
      (sub.status !== "pending" || sub.paymentStatus !== "pending")
    )
      return false;
    if (activeFilter === "Active" && sub.status !== "active") return false;
    if (activeFilter === "Expired" && sub.status !== "expired") return false;

    // Filter by search
    const s = searchQuery.toLowerCase();
    const matchesSearch =
      sub.user?.name?.toLowerCase().includes(s) ||
      sub.user?.email?.toLowerCase().includes(s) ||
      sub.user?.phoneNumber?.toLowerCase().includes(s) ||
      sub.plan.name.toLowerCase().includes(s);

    return matchesSearch;
  });

  const stats = useMemo(() => {
    const expiringSoon = subscriptions.filter((s) => {
      if (s.status !== "active") return false;
      const end = new Date(s.endDate);
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
      return diff > 0 && diff <= threeDaysInMs;
    });

    return {
      total: subscriptions.length,
      pending: subscriptions.filter((s) => s.paymentStatus === "pending")
        .length,
      active: subscriptions.filter((s) => s.status === "active").length,
      expiringSoon: expiringSoon.length,
      expiringMembers: expiringSoon,
    };
  }, [subscriptions]);

  const hasAlertedRef = useRef<number>(0);

  // Sync if URL changes
  useEffect(() => {
    if (urlSearch) setSearchQuery(urlSearch);
    if (highlightId) {
      setHighlightedId(highlightId);
      const timer = setTimeout(() => setHighlightedId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [urlSearch, highlightId]);

  // Alert Sound Effect
  useEffect(() => {
    if (stats.expiringSoon > hasAlertedRef.current) {
      const audio = new Audio("/ring.wav");
      audio
        .play()
        .catch((e) => console.log("Sound play prevented by browser:", e));

      // Notify for each expiring member
      stats.expiringMembers.forEach((member) => {
        toast.error(
          `Renewal Alert: ${member.user?.name || "Member"}'s plan expires in less than 3 days!`,
          {
            duration: 10000,
            icon: <AlertTriangle className="text-red-500" />,
          },
        );
      });
      hasAlertedRef.current = stats.expiringSoon;
    }
  }, [stats.expiringSoon, stats.expiringMembers]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string, paymentStatus: string) => {
    if (paymentStatus === "pending") return "bg-yellow-50 text-yellow-600";
    if (status === "active") return "bg-green-50 text-green-600";
    if (status === "expired") return "bg-red-50 text-red-600";
    return "bg-slate-50 text-slate-600";
  };

  const getStatusLabel = (status: string, paymentStatus: string) => {
    if (paymentStatus === "pending") return "Pending Payment";
    if (status === "active") return "Active";
    if (status === "expired") return "Expired";
    return status;
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Membership <span className="text-[#FA6400]">Management</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Manage and verify membership subscriptions
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#0c0b5d] text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[#1a1975] transition-all shadow-xl shadow-indigo-500/10"
        >
          <Plus size={16} />
          Add Membership
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Users size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Total Memberships
              </span>
              <span className="text-2xl font-black text-[#0c0b5d]">
                {stats.total}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center">
              <Clock size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pending Verification
              </span>
              <span className="text-2xl font-black text-[#0c0b5d]">
                {stats.pending}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
              <CheckCircle size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Active Members
              </span>
              <span className="text-2xl font-black text-[#0c0b5d]">
                {stats.active}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`bg-white/95 backdrop-blur-md p-6 rounded-[32px] border ${stats.expiringSoon > 0 ? "border-red-200 animate-pulse bg-red-50/30" : "border-slate-100"} shadow-sm`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 ${stats.expiringSoon > 0 ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600"} rounded-2xl flex items-center justify-center`}
            >
              <AlertTriangle size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Renewal Alerts
              </span>
              <span
                className={`text-2xl font-black ${stats.expiringSoon > 0 ? "text-red-600" : "text-[#0c0b5d]"}`}
              >
                {stats.expiringSoon}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex gap-6">
        <div
          className={`bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm flex flex-col transition-all w-full`}
        >
          {/* Filters & Search */}
          <div className="p-4 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              {(["All", "Pending", "Active", "Expired"] as FilterType[]).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${
                      activeFilter === filter
                        ? "bg-slate-50 text-[#0c0b5d]"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {filter}
                    {filter === "Pending" && stats.pending > 0 && (
                      <span className="ml-2 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[8px]">
                        {stats.pending}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
            <div className="relative group w-full lg:w-80">
              <Search
                className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memberships..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-14 pr-4 text-xs font-bold focus:ring-1 focus:ring-[#0c0b5d] outline-none"
              />
            </div>
          </div>

          {/* Table */}
          {subscriptionsQuery.isLoading || subscriptionsQuery.isFetching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-[#0c0b5d]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                    <th className="px-8 py-6">Member</th>
                    <th className="px-6 py-6 text-center">Plan</th>
                    <th className="px-6 py-6 text-center">Time Slot</th>
                    <th className="px-6 py-6 text-center">Price</th>
                    <th className="px-6 py-6 text-center">Status</th>
                    <th className="px-6 py-6 text-center">Valid Until</th>
                    <th className="px-8 py-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredSubscriptions.length > 0 ? (
                    filteredSubscriptions.map((sub) => (
                      <tr
                        key={sub.id}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          highlightedId === sub.id
                            ? "ring-2 ring-[#FA6400] ring-inset bg-orange-50/30"
                            : ""
                        }`}
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-500">
                              {sub.user?.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || "U"}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-black text-[#0c0b5d]">
                                {sub.user?.name || "Unknown"}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {sub.user?.phoneNumber}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black uppercase tracking-widest italic text-[#FA6400]">
                              {sub.plan.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-tight">
                                {sub.chosenDuration === "3_days"
                                  ? "3 Days / Week"
                                  : sub.chosenDuration === "1_month"
                                    ? "1 Month"
                                    : sub.chosenDuration === "3_months"
                                      ? "3 Months"
                                      : sub.chosenDuration || "Standard"}
                              </span>
                              <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md uppercase tracking-tight">
                                {sub.chosenCategory || "General"}
                              </span>
                            </div>
                            {sub.chosenDays && sub.chosenDays.length > 0 && (
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                {sub.chosenDays.join(" • ")}
                              </span>
                            )}
                            {sub.excludeDays && sub.excludeDays.length > 0 && (
                              <span className="text-[9px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-md uppercase tracking-tight mt-1">
                                Excluded: {sub.excludeDays.join(" • ")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-bold text-slate-600">
                              {sub.timeSlot
                                ? formatTimeTo12h(sub.timeSlot)
                                : "—"}
                            </span>
                            {sub.timeSlot && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-[#0c0b5d]/40">
                                Reserved Slot
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-xs font-black text-[#0c0b5d]">
                            Rs.{" "}
                            {(
                              sub.totalPrice || sub.plan.price
                            ).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex justify-center">
                            <span
                              className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${getStatusColor(sub.status, sub.paymentStatus)}`}
                            >
                              {sub.paymentStatus === "pending" ? (
                                <Clock size={10} />
                              ) : (
                                <CheckCircle size={10} />
                              )}
                              {getStatusLabel(sub.status, sub.paymentStatus)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-bold text-[#0c0b5d]">
                              {formatDate(sub.endDate)}
                            </span>
                            {sub.notes?.includes("[SKIP]") && (
                              <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full mt-1 uppercase tracking-widest border border-indigo-100 flex items-center gap-1">
                                <RotateCw size={8} />
                                Extended ({sub.notes.split("[SKIP]").length - 1}
                                d)
                              </span>
                            )}
                            <span className="text-[9px] font-medium text-slate-400 mt-1">
                              Started {formatDate(sub.startDate)}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {sub.paymentStatus === "pending" && (
                              <button
                                onClick={() => handleVerifyPayment(sub.id)}
                                disabled={verifyPaymentMutation.isPending}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-green-100 disabled:opacity-50"
                                title="Accept Payment"
                              >
                                {verifyPaymentMutation.isPending ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <CheckCircle size={18} />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenPaymentModal(sub)}
                              disabled={sub.paymentStatus === "completed"}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                              title={sub.paymentStatus === "completed" ? "Payment Settled" : "Update Payment"}
                            >
                              <Wallet size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setShowRenewConfirm(true);
                              }}
                              disabled={renewSubscriptionMutation.isPending}
                              className="p-2 text-orange-500 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-orange-100"
                              title="Renew Membership"
                            >
                              <RotateCw
                                size={18}
                                className={
                                  renewSubscriptionMutation.isPending
                                    ? "animate-spin"
                                    : ""
                                }
                              />
                            </button>
                            <button
                              onClick={() => handleSendWhatsApp(sub)}
                              className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-green-100"
                              title="Send Invoice via WhatsApp"
                            >
                              <MessageCircle size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSubscription(sub);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-red-100"
                              title="Delete Membership"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-8 py-20 text-center">
                        <p className="text-slate-400 font-medium">
                          No memberships found
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Global Confirm Dialog for Deletion */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Membership"
        description={`Are you sure you want to delete the membership for ${selectedSubscription?.user?.name || "this user"}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
        isLoading={deleteSubscriptionMutation.isPending}
        onConfirm={handleDeleteSubscription}
      />

      {/* Global Confirm Dialog for Renewal */}
      <ConfirmDialog
        open={showRenewConfirm}
        onOpenChange={setShowRenewConfirm}
        title="Renew Membership"
        description={`Are you sure you want to renew the membership for ${selectedSubscription?.user?.name || "this user"}? This will extend the membership based on its current plan duration.`}
        confirmText="Renew"
        cancelText="Cancel"
        isLoading={renewSubscriptionMutation.isPending}
        onConfirm={handleRenewSubscription}
      />

      {/* Manual Add Membership Modal */}
      <AdminManualMembershipModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* Payment Settlement Modal */}
      <MembershipPaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedSubscription(null);
          setSettlementSummary(null);
        }}
        subscription={selectedSubscription}
        settlementSummary={settlementSummary}
        isSummaryLoading={isSettlementSummaryLoading}
        isProcessing={isPaymentProcessing}
        onConfirm={handleSettlePayment}
      />

      <SmsConfirmModal
        isOpen={smsConfirmModal.isOpen}
        onOpenChange={(open) =>
          setSmsConfirmModal((prev) => ({ ...prev, isOpen: open }))
        }
        onConfirm={onSmsConfirm}
        title="Activate Membership"
        description="Do you want to send an SMS activation message to the player?"
      />
    </div>
  );
}
