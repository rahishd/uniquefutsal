"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import {
  Search,
  Download,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CheckCircle,
  XCircle as XCircleIcon,
  Trash2,
  RotateCw,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatTimeTo12h } from "@/lib/utils/time";
import { generateInvoicePDF } from "@/lib/utils/invoice-pdf";
import { useQueryClient } from "@tanstack/react-query";
import { bookingKeys, useBookingsPaginated } from "@/lib/hooks/bookings";
import {
  Booking,
  getBookingsPaginated,
  updateBooking,
  deleteBooking,
  uploadInvoice,
} from "@/lib/api/bookings";
import { toast } from "sonner";
import { inventoryApi, Product } from "@/lib/api/inventory";
import { usersApi } from "@/lib/api/users";
import { SmsConfirmModal } from "@/components/sms-confirm-modal";

const BOOKING_PAYMENT_LOG_PREFIX = "BOOKING_PAYMENT_LOG:";
const MEMBERSHIP_SUB_LINK_PREFIX = "MEMBERSHIP_SUB:";

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPresetDates = (preset: string) => {
  const today = new Date();
  if (preset === 'today') {
    return getLocalDateString(today);
  }
  if (preset === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return getLocalDateString(yesterday);
  }
  if (preset === 'this_week') {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(getLocalDateString(d));
    }
    return dates.join(',');
  }
  if (preset === 'this_month') {
    const todayNow = new Date();
    const firstDay = new Date(todayNow.getFullYear(), todayNow.getMonth(), 1);
    const lastDay = new Date(todayNow.getFullYear(), todayNow.getMonth() + 1, 0);
    const dates = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      dates.push(getLocalDateString(d));
    }
    return dates.join(',');
  }
  return '';
};

const generateDateRange = (start: string, end: string) => {
  const dates = [];
  let curr = new Date(start);
  const last = new Date(end);
  while (curr <= last) {
    dates.push(getLocalDateString(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates.join(',');
};

const formatDateFilterDisplay = (filter: string) => {
  if (!filter) return "Filter Date";
  if (filter === getPresetDates('today')) return "Today";
  if (filter === getPresetDates('yesterday')) return "Yesterday";
  if (filter === getPresetDates('this_week')) return "This Week";
  if (filter === getPresetDates('this_month')) return "This Month";
  
  const dates = filter.split(',');
  if (dates.length > 1) {
    return `${dates[0]} to ${dates[dates.length - 1]}`;
  }
  return filter;
};

function BookingsLedgerContent() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"" | "paid" | "due">("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
  const [bookingToPay, setBookingToPay] = useState<Booking | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [paymentData, setPaymentData] = useState({
    cashAmount: 0,
    onlineAmount: 0,
    method: "cash" as "cash" | "online" | "partial",
    waterBottles: 0,
    addOns: "",
    addOnsPrice: 0,
  });

  const bookingNetDue = bookingToPay
    ? (bookingToPay.totalPrice + ((paymentData.waterBottles - 2) * 25) + Number(paymentData.addOnsPrice)) - bookingToPay.amountPaidNow
    : 0;
  const isBookingFullySettled = bookingToPay ? bookingNetDue <= 0 : false;

  const [smsConfirmModal, setSmsConfirmModal] = useState<{
    isOpen: boolean;
  }>({
    isOpen: false,
  });

  const [inventoryProducts, setInventoryProducts] = useState<Product[]>([]);
  const [previousDues, setPreviousDues] = useState(0);
  const [clearAllDuesChecked, setClearAllDuesChecked] = useState(false);
  const [isLoadingDues, setIsLoadingDues] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    inventoryApi.getProducts()
      .then(prods => {
        // Only show products in stock, and filter out mineral water as it has a dedicated section
        const filtered = prods.filter(p => {
          const name = p.name.toLowerCase();
          return p.inventory > 0 && !name.includes("water") && !name.includes("mineral");
        });
        setInventoryProducts(filtered);
      })
      .catch(err => console.error("Failed to fetch products:", err));
  }, []);

  const datePickerRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  const bookingsQuery = useBookingsPaginated({
    filters: { 
      date: dateFilter || undefined,
      search: debouncedSearch || undefined,
      paymentStatus: paymentStatusFilter || undefined,
    },
    page,
    limit,
    refetchIntervalMs: 10 * 1000,
  });

  const totalPages = bookingsQuery.data?.meta.totalPages || 1;
  const totalRecords = bookingsQuery.data?.meta.total || 0;
  const isLoading = bookingsQuery.isLoading;
  const isFetching = bookingsQuery.isFetching;
  const error = bookingsQuery.isError ? "Failed to load records." : null;

  const bookings = bookingsQuery.data?.items ?? [];

  // Clamp page when filters shrink totalPages (e.g. on page 5, then filter to 1 page)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Handle clicking outside to close date picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node)
      ) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDeleteBooking = (bookingId: string) => {
    setBookingToDelete(bookingId);
  };

  const confirmDelete = async () => {
    setSmsConfirmModal({ isOpen: true });
  };

  const onSmsConfirm = async (sendSms: boolean) => {
    if (!bookingToDelete) return;
    try {
      await deleteBooking(bookingToDelete, sendSms);
      toast.success("Booking record deleted successfully");
      await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    } catch (err) {
      console.error("Error deleting booking:", err);
      toast.error("Failed to delete booking");
    } finally {
      setBookingToDelete(null);
    }
  };

  const handleToggleClearAllDues = (checked: boolean) => {
    setClearAllDuesChecked(checked);
  };

  useEffect(() => {
    if (!bookingToPay) return;
    const currentBookingDue = (bookingToPay.totalPrice + (Math.max(0, paymentData.waterBottles - 2) * 25) + Number(paymentData.addOnsPrice)) - (bookingToPay.amountPaidNow || 0);
    const targetTotal = clearAllDuesChecked ? (currentBookingDue + previousDues) : currentBookingDue;

    setPaymentData(prev => {
      if (prev.method === "cash") {
        return { ...prev, cashAmount: targetTotal, onlineAmount: 0 };
      } else if (prev.method === "online") {
        return { ...prev, cashAmount: 0, onlineAmount: targetTotal };
      }
      return prev;
    });
  }, [
    bookingToPay,
    paymentData.waterBottles,
    paymentData.addOnsPrice,
    paymentData.method,
    clearAllDuesChecked,
    previousDues
  ]);

  const handleOpenPaymentModal = (booking: Booking) => {
    if (booking.paymentStatus === "completed") {
      // If already paid, we can toggle back to pending or just ignore
      // User said "if done paid then open a modal", implying we open it to mark as paid
      // If it's already paid, maybe we want to EDIT the payment? 
      // For now, let's allow reopening to change method.
    }
    
    setBookingToPay(booking);
    setClearAllDuesChecked(false);
    setPreviousDues(0);

    const initialDue = (booking.totalPrice + ((booking.waterBottles ?? 2) - 2) * 25 + (booking.addOnsPrice || 0)) - (booking.amountPaidNow || 0);
    setPaymentData({
      cashAmount: initialDue,
      onlineAmount: 0,
      method: "cash",
      waterBottles: booking.waterBottles ?? 2,
      addOns: booking.addOns || "",
      addOnsPrice: booking.addOnsPrice || 0,
    });
    setPaymentModalOpen(true);

    if (booking.customerPhone) {
      setIsLoadingDues(true);
      usersApi.getPlayerBookings(booking.customerPhone)
        .then((playerBookings) => {
          const dues = playerBookings
            .filter((b) => b.id !== booking.id && b.status !== "cancelled" && b.paymentStatus !== "completed")
            .reduce((sum, b) => sum + (b.remainingAmount || 0), 0);
          setPreviousDues(dues);
        })
        .catch((err) => {
          console.error("Failed to fetch player bookings/dues:", err);
          setPreviousDues(0);
        })
        .finally(() => {
          setIsLoadingDues(false);
        });
    } else {
      setPreviousDues(0);
      setIsLoadingDues(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!bookingToPay) return;
    
    setIsProcessing(true);
    try {
      const currentTotal = bookingToPay.totalPrice + 
                          ((paymentData.waterBottles - 2) * 25) + 
                          Number(paymentData.addOnsPrice);

      const totalPaid = (bookingToPay.amountPaidNow || 0) + paymentData.cashAmount + paymentData.onlineAmount;
      const isFullPayment = totalPaid >= currentTotal;
      
      const updates = {
        paymentStatus: (isFullPayment ? "completed" : "partially_paid") as "completed" | "partially_paid",
        amountPaidNow: totalPaid,
        cashAmount: paymentData.cashAmount + (bookingToPay.cashAmount || 0),
        onlineAmount: paymentData.onlineAmount + (bookingToPay.onlineAmount || 0),
        status: isFullPayment ? "completed" : bookingToPay.status as any,
        waterBottles: paymentData.waterBottles,
        addOns: paymentData.addOns,
        addOnsPrice: Number(paymentData.addOnsPrice),
        totalPrice: currentTotal, // Update total to include water/addons
        remainingAmount: Math.max(0, currentTotal - totalPaid),
        settlePreviousDues: clearAllDuesChecked
      };

      await updateBooking(bookingToPay.id, updates);
      toast.success(`Payment updated for ${getDisplayName(bookingToPay)}`);
      await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      setPaymentModalOpen(false);
    } catch (err) {
      console.error("Error processing payment:", err);
      toast.error("Failed to process payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const getDisplayName = (booking: Booking) => {
    if (booking.customerName && booking.customerName.trim() !== "") {
      return booking.customerName;
    }
    if (booking.customerPhone) {
      return `Player (${booking.customerPhone})`;
    }
    return "Unnamed Player";
  };

  const getBookingPaidHistoryExpression = (booking: Booking): string | null => {
    const paidTotal = booking.amountPaidNow || 0;
    if (paidTotal <= 0) return null;

    const notes = booking.notes || "";
    const history = notes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith(BOOKING_PAYMENT_LOG_PREFIX) || line.startsWith("MEMBERSHIP_PAYMENT_LOG:"))
      .map((line) => {
        if (line.startsWith(BOOKING_PAYMENT_LOG_PREFIX)) {
          return line.replace(BOOKING_PAYMENT_LOG_PREFIX, "").trim();
        } else {
          return line.replace("MEMBERSHIP_PAYMENT_LOG:", "").trim();
        }
      })
      .map((payload) => {
        try {
          const parsed = JSON.parse(payload);
          return {
            at: String(parsed.at || ""),
            totalAmount: Number(parsed.totalAmount || 0),
          };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { at: string; totalAmount: number } => {
        return Boolean(entry && Number.isFinite(entry.totalAmount) && entry.totalAmount > 0);
      })
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    if (history.length === 0) {
      return `${paidTotal}`;
    }

    const historySum = history.reduce((sum, entry) => sum + entry.totalAmount, 0);
    const legacyAmount = Math.max(0, paidTotal - historySum);
    const parts = legacyAmount > 0 ? [legacyAmount, ...history.map((h) => h.totalAmount)] : history.map((h) => h.totalAmount);

    return `${parts.join(" + ")} = ${paidTotal}`;
  };

  const getMembershipDisplayFromNotes = (notes?: string): string => {
    if (!notes) return "Membership";

    const cleanLines = notes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .filter((line) => !line.startsWith(BOOKING_PAYMENT_LOG_PREFIX))
      .filter((line) => !line.startsWith(MEMBERSHIP_SUB_LINK_PREFIX));

    const membershipLine = cleanLines.find((line) =>
      line.startsWith("MEMBERSHIP_PAYMENT:"),
    );

    if (!membershipLine) return "Membership";
    return membershipLine.replace("MEMBERSHIP_PAYMENT:", "").trim() || "Membership";
  };

  const sendWhatsApp = async (booking: Booking) => {
    const rawPhone = booking.customerPhone?.replace(/\D/g, "");
    if (!rawPhone) {
      toast.error("No phone number found for this booking");
      return;
    }

    try {
      toast.loading("Preparing professional invoice...", { id: "pdf-gen" });
      
      // Generate PDF
      const doc = await generateInvoicePDF(booking);
      const pdfBase64 = doc.output('datauristring');
      
      // Upload to backend/R2
      const { invoiceUrl } = await uploadInvoice(booking.id, pdfBase64);
      
      toast.success("Invoice prepared & link ready!", { id: "pdf-gen" });

      // Format phone number (ensure country code)
      const phone = rawPhone.startsWith("977") ? rawPhone : `977${rawPhone}`;
      
      const message = encodeURIComponent(
        `*INVOICE - UNIQUE FUTSAL* ⚽\n\n` +
        `Hello *${booking.customerName || "Player"}*, here is your professional booking invoice:\n\n` +
        `📄 *View Invoice:* ${invoiceUrl}\n\n` +
        `📌 *Booking ID:* #BK-${booking.id.slice(-6).toUpperCase()}\n` +
        `📅 *Date:* ${booking.date}\n` +
        `⏰ *Time:* ${formatTimeTo12h(booking.startTime)}\n\n` +
        `💰 *Total Bill:* Rs. ${booking.totalPrice.toLocaleString()}\n` +
        `✅ *Total Paid:* Rs. ${(booking.amountPaidNow || 0).toLocaleString()}\n` +
        (booking.cashAmount > 0 ? `💵 *Cash:* Rs. ${booking.cashAmount.toLocaleString()}\n` : "") +
        (booking.onlineAmount > 0 ? `💳 *Online:* Rs. ${booking.onlineAmount.toLocaleString()}\n` : "") +
        (booking.remainingAmount > 0 ? `🚨 *Remaining:* Rs. ${booking.remainingAmount.toLocaleString()}\n` : "") +
        `💳 *Status:* ${booking.paymentStatus.toUpperCase().replace("_", " ")}\n\n` +
        `Thank you for choosing Unique Futsal! 🔥`
      );
      
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    } catch (error) {
      console.error("Invoice preparation failed:", error);
      toast.error("Failed to prepare invoice link", { id: "pdf-gen" });
    }
  };

  // Backend handles search filtering now
  const filteredBookings = bookings;

  const exportToCSV = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // Export ALL filtered records across every page, not just the visible page
      const filters = {
        date: dateFilter || undefined,
        search: debouncedSearch || undefined,
        paymentStatus: paymentStatusFilter || undefined,
      };
      const exportLimit = 200; // backend max
      const first = await getBookingsPaginated({ filters, page: 1, limit: exportLimit });
      const all: Booking[] = [...(first.items ?? [])];
      const total = first.meta?.total ?? all.length;
      const totalPagesToFetch = Math.max(1, Math.ceil(total / exportLimit));
      for (let p = 2; p <= totalPagesToFetch; p++) {
        const res = await getBookingsPaginated({ filters, page: p, limit: exportLimit });
        all.push(...(res.items ?? []));
      }
      if (all.length === 0) {
        toast.info("No records to export for current filters");
        return;
      }
    const headers = [
      "ID",
      "Customer",
      "Phone Number",
      "Date",
      "Start Time",
      "Duration",
      "Total Price",
      "Paid Amount",
      "Due Amount",
      "Status",
      "Recorded At",
    ];
    const rows = all.map((b) => [
      b.id,
      getDisplayName(b),
      b.customerPhone || "N/A",
      b.date,
      formatTimeTo12h(b.startTime),
      b.duration + " Hour(s)",
      b.totalPrice,
      b.amountPaidNow || 0,
      b.remainingAmount || 0,
      b.status.toUpperCase(),
      new Date(b.updatedAt).toLocaleString("en-US", { hour12: true }),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ledger_${dateFilter || "all"}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} record${all.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export records");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Booking <span className="text-[#FA6400]">Ledger</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Historical record of all finalized arena reservations.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportToCSV}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <Download size={16} /> {isExporting ? "Exporting..." : "Export Data"}
          </button>
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/10 hover:scale-[1.02] transition-all cursor-pointer ${
                dateFilter
                  ? "bg-[#FA6400] text-white"
                  : "bg-[#0c0b5d] text-white"
              }`}
            >
              <Calendar size={16} />
              {formatDateFilterDisplay(dateFilter)}
              {dateFilter && (
                <X
                  size={14}
                  className="ml-1 hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateFilter("");
                    setPage(1);
                  }}
                />
              )}
            </button>

            {showDatePicker && (
              <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-50 min-w-[320px]">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-3">
                  Quick Filters
                </h4>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => {
                      setDateFilter(getPresetDates('today'));
                      setPage(1);
                      setShowDatePicker(false);
                    }}
                    className="py-2 px-3 text-xs font-bold rounded-xl bg-slate-50 hover:bg-[#0c0b5d] hover:text-white transition-colors text-slate-600 text-left"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      setDateFilter(getPresetDates('yesterday'));
                      setPage(1);
                      setShowDatePicker(false);
                    }}
                    className="py-2 px-3 text-xs font-bold rounded-xl bg-slate-50 hover:bg-[#0c0b5d] hover:text-white transition-colors text-slate-600 text-left"
                  >
                    Yesterday
                  </button>
                  <button
                    onClick={() => {
                      setDateFilter(getPresetDates('this_week'));
                      setPage(1);
                      setShowDatePicker(false);
                    }}
                    className="py-2 px-3 text-xs font-bold rounded-xl bg-slate-50 hover:bg-[#0c0b5d] hover:text-white transition-colors text-slate-600 text-left"
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => {
                      setDateFilter(getPresetDates('this_month'));
                      setPage(1);
                      setShowDatePicker(false);
                    }}
                    className="py-2 px-3 text-xs font-bold rounded-xl bg-slate-50 hover:bg-[#0c0b5d] hover:text-white transition-colors text-slate-600 text-left"
                  >
                    This Month
                  </button>
                </div>
                
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-3 border-t border-slate-100 pt-3">
                  Custom Range
                </h4>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFilter && !dateFilter.includes(',') ? dateFilter : (dateFilter?.split(',')[0] || '')}
                      onChange={(e) => {
                        const start = e.target.value;
                        const end = dateFilter?.includes(',') ? dateFilter.split(',')[dateFilter.split(',').length - 1] : '';
                        if (start && end) {
                          setDateFilter(generateDateRange(start, end));
                        } else {
                          setDateFilter(start);
                        }
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-bold focus:border-[#0c0b5d] outline-none"
                    />
                    <span className="text-slate-400 font-bold">to</span>
                    <input
                      type="date"
                      value={dateFilter?.includes(',') ? dateFilter.split(',')[dateFilter.split(',').length - 1] : ''}
                      onChange={(e) => {
                        const end = e.target.value;
                        const start = dateFilter?.includes(',') ? dateFilter.split(',')[0] : (dateFilter || '');
                        if (start && end) {
                          setDateFilter(generateDateRange(start, end));
                        } else {
                          // if only end is selected, we could just set it as a single date
                          // or wait for start. Let's just set it as single if no start.
                          setDateFilter(end);
                        }
                        setPage(1);
                      }}
                      className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-xs font-bold focus:border-[#0c0b5d] outline-none"
                    />
                  </div>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="w-full py-2 bg-[#0c0b5d] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1a188a] transition-colors"
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-[28px] border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        <div className="relative group w-full lg:w-96 px-2">
          <Search
            className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0c0b5d] transition-colors"
            size={16}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or User..."
            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-14 pr-4 text-xs font-bold focus:ring-1 focus:ring-[#0c0b5d] transition-all outline-none"
          />
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-3 px-2">
          {/* Payment Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => { setPaymentStatusFilter(""); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                paymentStatusFilter === "" ? "bg-white text-[#0c0b5d] shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setPaymentStatusFilter("paid"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                paymentStatusFilter === "paid" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              ✓ Paid
            </button>
            <button
              onClick={() => { setPaymentStatusFilter("due"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                paymentStatusFilter === "due" ? "bg-red-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              ⚠ Due
            </button>
          </div>

          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {totalRecords > 0 ? `${totalRecords} records` : "0 records"}
          </div>

          <select
            value={limit}
            onChange={(e) => {
              const nextLimit = Number(e.target.value);
              if (!Number.isFinite(nextLimit) || nextLimit <= 0) return;
              setLimit(nextLimit);
              setPage(1);
            }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
            aria-label="Rows per page"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
            >
              Prev
            </button>
            <div className="text-xs font-black text-[#0c0b5d] min-w-[88px] text-center">
              {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm overflow-hidden min-h-[500px] relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={48} className="text-[#0c0b5d] animate-spin" />
              <p className="text-slate-500 font-medium">Loading records...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle size={48} className="text-red-500" />
              <p className="text-red-500 font-medium">{error}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            {isFetching && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-lg">
                  <Loader2 size={18} className="text-[#0c0b5d] animate-spin" />
                  <span className="text-xs font-bold text-slate-600">
                    Updating…
                  </span>
                </div>
              </div>
            )}
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 bg-slate-50/30">
                  <th className="px-8 py-6">Customer</th>
                  <th className="px-6 py-6 text-center text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Details
                  </th>
                  <th className="px-6 py-6 text-center text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Status
                  </th>
                  <th className="px-6 py-6 text-center text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Paid
                  </th>
                  <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Recorded At / Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((booking) => {
                    const displayName = getDisplayName(booking);
                    const displayEmail = booking.customerEmail || "N/A";
                    const initials = (displayName || "B")
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr
                        key={booking.id}
                        onClick={() => router.push(`/uniquesuperadmin/viewslots?date=${booking.date}&highlight=${booking.id}`)}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-[#0c0b5d]/5 flex items-center justify-center text-[11px] font-black text-[#0c0b5d]">
                              {initials}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-[#0c0b5d]">
                                  {displayName}
                                </span>
                                {booking.customerPhone && (
                                  <span className="text-[10px] font-bold text-[#FA6400]">
                                    - {booking.customerPhone}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-slate-400">
                                {displayEmail}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg text-indigo-700">
                              <MapPin size={12} className="opacity-70" />
                              <span className="text-[10px] font-black uppercase tracking-tighter">
                                {booking.notes?.startsWith("MEMBERSHIP_PAYMENT") ? "MEMBERSHIP" : "Main Ground"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <Clock size={12} className="opacity-70" />
                              <span className="text-[10px] font-bold text-center">
                                {booking.notes?.startsWith("MEMBERSHIP_PAYMENT") 
                                  ? getMembershipDisplayFromNotes(booking.notes)
                                  : `${booking.date} @ ${formatTimeTo12h(booking.startTime)}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <div className="flex justify-center">
                            <span
                              className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl 
                                ${booking.status === 'skipped_due_to_tournament' ? 'bg-amber-50 text-amber-600' : 
                                  booking.status === 'cancelled_due_to_tournament' ? 'bg-red-50 text-red-600' :
                                  'bg-green-50 text-green-600'}`}
                            >
                              {booking.status === 'skipped_due_to_tournament' ? <RotateCw size={12} /> : 
                               booking.status === 'cancelled_due_to_tournament' ? <AlertTriangle size={12} /> :
                               <CheckCircle2 size={12} />}
                              {booking.status.replace(/_/g, " ").replace(" DUE TO TOURNAMENT", "").toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPaymentModal(booking);
                                }}
                                disabled={booking.paymentStatus === "completed"}
                                className={`group/pay relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md overflow-hidden ${
                                  booking.paymentStatus === "completed"
                                    ? "bg-green-50/50 text-green-600/50 border border-green-100/50 cursor-not-allowed shadow-none"
                                    : booking.paymentStatus === "partially_paid"
                                      ? "bg-amber-50 text-amber-600 border border-amber-100 cursor-pointer"
                                      : "bg-red-50 text-red-600 border border-red-100 cursor-pointer"
                                }`}
                              >
                                <div className="absolute inset-0 bg-current opacity-0 group-hover/pay:opacity-10 transition-opacity" />
                                {booking.paymentStatus === "completed" ? (
                                  <CheckCircle
                                    size={24}
                                    className="stroke-[2.5px] group-hover/pay:scale-110 transition-transform"
                                  />
                                ) : (
                                  <AlertCircle
                                    size={24}
                                    className="stroke-[2.5px] group-hover/pay:scale-110 transition-transform"
                                  />
                                )}
                              </button>

                              <div className="flex flex-col">
                                <span
                                  className={`text-[10px] font-black uppercase tracking-widest ${
                                    booking.paymentStatus === "completed"
                                      ? "text-green-600"
                                      : booking.paymentStatus === "partially_paid"
                                        ? "text-amber-500"
                                        : "text-red-500"
                                  }`}
                                >
                                  {booking.paymentStatus === "completed"
                                    ? "Settled"
                                    : booking.paymentStatus === "partially_paid"
                                      ? "Partially Paid"
                                      : "Pending Balance"}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-black text-[#0c0b5d]">
                                    Rs. {booking.totalPrice.toLocaleString()}
                                  </span>
                                  {booking.paymentStatus !== "completed" && (
                                    <span className="text-[10px] font-bold text-red-400">
                                      (Due: Rs. {(booking.totalPrice - (booking.amountPaidNow || 0)).toLocaleString()})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="flex flex-col items-end mr-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Recorded At
                              </span>
                              <span className="text-xs font-bold text-[#0c0b5d]">
                                {new Date(
                                  booking.updatedAt,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sendWhatsApp(booking);
                              }}
                              className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
                              title="Send Invoice via WhatsApp"
                            >
                              <MessageCircle size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBooking(booking.id);
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              title="Delete Booking"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Calendar size={40} className="text-slate-200" />
                        <p className="text-slate-400 font-bold">
                          No confirmed records found.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && bookingToPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0c0b5d]/40 backdrop-blur-md"
            onClick={() => setPaymentModalOpen(false)}
          />
          <div className="relative bg-white rounded-[32px] p-6 max-w-[380px] w-full shadow-[0_32px_64px_-12px_rgba(12,11,93,0.2)] border border-slate-100 max-h-full overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0c0b5d] to-[#FA6400]" />
            
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                    Update <span className="text-[#FA6400]">Payment</span>
                  </h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                    ID: #BK-{bookingToPay!.id.slice(-6).toUpperCase()}
                  </p>
                </div>
                <button 
                  onClick={() => setPaymentModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Base Pitch Fee</span>
                    <span className="text-xs font-bold text-slate-500">Rs. {bookingToPay!.totalPrice.toLocaleString()}</span>
                  </div>
                  
                  {(paymentData.waterBottles !== 2 || paymentData.waterBottles > 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        Water Bottles ({paymentData.waterBottles})
                        {paymentData.waterBottles < 2 ? (
                          <span className="ml-1 text-[8px] text-red-500">(Deducted)</span>
                        ) : paymentData.waterBottles === 2 ? (
                          <span className="ml-1 text-[8px] text-green-500">(Comp)</span>
                        ) : null}
                      </span>
                      <span className={`text-xs font-bold ${paymentData.waterBottles < 2 ? "text-red-500" : "text-slate-500"}`}>
                        {paymentData.waterBottles < 2 ? "-" : ""} Rs. {Math.abs((paymentData.waterBottles - 2) * 25).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {paymentData.addOnsPrice > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{paymentData.addOns || "Add-ons"}</span>
                      <span className="text-xs font-bold text-slate-500">Rs. {Number(paymentData.addOnsPrice).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="h-px bg-slate-200 w-full my-1" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Bill</span>
                    <span className="text-lg font-black text-[#0c0b5d]">
                      Rs. {(bookingToPay!.totalPrice + ((paymentData.waterBottles - 2) * 25) + Number(paymentData.addOnsPrice)).toLocaleString()}
                    </span>
                  </div>

                  {bookingToPay!.amountPaidNow > 0 && (
                    <div className="mt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Paid Previously</span>
                        <span className="text-sm font-black text-green-600">
                          Rs. {bookingToPay!.amountPaidNow.toLocaleString()}
                        </span>
                      </div>
                      {getBookingPaidHistoryExpression(bookingToPay!) && (
                        <div className="flex justify-end mt-0.5">
                          <span className="text-[9px] font-black text-green-700">
                            {getBookingPaidHistoryExpression(bookingToPay!)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-dashed border-slate-200">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0c0b5d]">Net Due</span>
                    <span className="text-lg font-black text-[#FA6400]">
                      Rs. {bookingNetDue.toLocaleString()}
                    </span>
                  </div>

                  {/* Previous Dues checking & display block */}
                  {isLoadingDues && (
                    <div className="flex items-center gap-2 mt-2.5 py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 text-[10px] font-bold">
                      <Loader2 size={12} className="animate-spin text-[#0c0b5d]" />
                      Checking older dues...
                    </div>
                  )}

                  {!isLoadingDues && previousDues > 0 && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/50 flex flex-col gap-2.5 animate-in slide-in-from-top-1 duration-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">Previous Dues</span>
                        <span className="text-sm font-black text-amber-800">Rs. {previousDues.toLocaleString()}</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={clearAllDuesChecked}
                          onChange={(e) => handleToggleClearAllDues(e.target.checked)}
                          className="w-4 h-4 rounded border-amber-300 text-[#0c0b5d] focus:ring-[#0c0b5d] cursor-pointer"
                        />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Settle Previous Dues</span>
                      </label>
                    </div>
                  )}

                  {clearAllDuesChecked && previousDues > 0 && (
                    <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-solid border-slate-200">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0c0b5d]">Combined Total Due</span>
                      <span className="text-xl font-black text-[#0c0b5d]">
                        Rs. {(bookingNetDue + previousDues).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {paymentData.method === "partial" && (
                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-dashed border-slate-200">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#FA6400]">
                        {clearAllDuesChecked ? "Total Remaining" : "Remaining After This"}
                      </span>
                      <span className="text-sm font-black text-[#FA6400]">
                        Rs. {(
                          clearAllDuesChecked
                            ? Math.max(0, (bookingNetDue + previousDues) - (Number(paymentData.cashAmount) + Number(paymentData.onlineAmount)))
                            : Math.max(0, bookingNetDue - (Number(paymentData.cashAmount) + Number(paymentData.onlineAmount)))
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="h-px bg-slate-200 w-full mb-3" />
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Customer: <span className="text-slate-700">{getDisplayName(bookingToPay)}</span></span>
                </div>
              </div>

              {/* Water & Add-ons Controls */}
              <div className="flex flex-col gap-4 p-1">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0c0b5d]">Water Bottles</span>
                    <span className="text-[8px] text-slate-400">2 Complementary, then Rs. 25/ea</span>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <button 
                      onClick={() => setPaymentData(prev => ({ 
                        ...prev, 
                        waterBottles: Math.max(0, prev.waterBottles - 1) 
                      }))}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 shadow-sm flex items-center justify-center hover:bg-slate-200 font-bold"
                    >
                      -
                    </button>
                    <span className="text-xs font-black min-w-[20px] text-center">{paymentData.waterBottles}</span>
                    <button 
                      onClick={() => setPaymentData(prev => ({ 
                        ...prev, 
                        waterBottles: prev.waterBottles + 1 
                      }))}
                      className="w-8 h-8 rounded-lg bg-[#0c0b5d] text-white shadow-sm flex items-center justify-center hover:bg-[#1a188a] font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-[#0c0b5d] ml-1">Select Inventory Item</label>
                    <select
                      value={
                        paymentData.addOns && !inventoryProducts.some(p => p.name === paymentData.addOns)
                          ? "custom"
                          : (inventoryProducts.find(p => p.name === paymentData.addOns)?.id || "")
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          // Keep as custom
                        } else if (!val) {
                          setPaymentData(prev => ({
                            ...prev,
                            addOns: "",
                            addOnsPrice: 0,
                          }));
                        } else {
                          const prod = inventoryProducts.find(p => p.id === val);
                          if (prod) {
                            setPaymentData(prev => ({
                              ...prev,
                              addOns: prod.name,
                              addOnsPrice: prod.price,
                            }));
                          }
                        }
                      }}
                      className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-[#0c0b5d] outline-none cursor-pointer"
                    >
                      <option value="">-- No Add-on Selected --</option>
                      {inventoryProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.inventory}) - Rs. {p.price}
                        </option>
                      ))}
                      <option value="custom">Custom Add-on (Write details below)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Name</label>
                      <input 
                        type="text"
                        value={paymentData.addOns}
                        placeholder="Item Name"
                        onChange={(e) => setPaymentData(prev => ({ ...prev, addOns: e.target.value }))}
                        className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-bold text-[#0c0b5d] outline-none placeholder:text-slate-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Add-on Price</label>
                      <input 
                        type="number"
                        value={paymentData.addOnsPrice}
                        onChange={(e) => {
                          const newPrice = Number(e.target.value);
                          setPaymentData(prev => ({
                            ...prev,
                            addOnsPrice: newPrice,
                          }));
                        }}
                        className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-black text-[#0c0b5d] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#0c0b5d] ml-1">Method</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "online", "partial"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setPaymentData(prev => ({
                          ...prev,
                          method: m,
                          ...(m === "partial" ? { cashAmount: 0, onlineAmount: 0 } : {})
                        }));
                      }}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                        paymentData.method === m
                          ? "bg-[#0c0b5d] text-white border-[#0c0b5d] shadow-md scale-[1.02]"
                          : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentData.method === "partial" && (
                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Cash</label>
                    <input 
                      type="number"
                      value={paymentData.cashAmount}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, cashAmount: Number(e.target.value) }))}
                      className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-black text-[#0c0b5d] outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Online</label>
                    <input 
                      type="number"
                      value={paymentData.onlineAmount}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, onlineAmount: Number(e.target.value) }))}
                      className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-xs font-black text-[#0c0b5d] outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleProcessPayment}
                disabled={isProcessing || isBookingFullySettled}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#0c0b5d] to-[#1a188a] text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:brightness-110 active:scale-95 transition-all mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : isBookingFullySettled ? (
                  "Payment Settled"
                ) : (
                  "Confirm Payment"
                )}
              </button>
              
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="w-full py-1 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-400 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setBookingToDelete(null)}
          />
          <div className="relative bg-white rounded-[32px] p-8 max-w-[340px] w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in fill-mode-both duration-200 zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 to-orange-500" />
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-1 border border-red-100 shadow-sm">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
                Delete Booking?
              </h3>
              <p className="text-slate-500 font-medium text-[13px] leading-relaxed">
                Are you sure you want to completely delete this booking record?
                <span className="block mt-3 text-red-600 font-bold bg-red-50 py-2 px-3 rounded-xl border border-red-100/50">
                  This action cannot be undone.
                </span>
              </p>
              <div className="flex items-center gap-3 w-full mt-4">
                <button
                  onClick={() => setBookingToDelete(null)}
                  className="flex-1 py-3.5 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3.5 px-4 rounded-xl font-black text-white bg-gradient-to-r from-red-500 to-orange-500 hover:brightness-110 shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SmsConfirmModal
        isOpen={smsConfirmModal.isOpen}
        onOpenChange={(open) => setSmsConfirmModal(prev => ({ ...prev, isOpen: open }))}
        onConfirm={onSmsConfirm}
        title="Cancel SMS Notification"
        description="Do you want to send a cancellation SMS to the player?"
      />
    </div>
  );
}

export default function BookingsManager() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-[#0c0b5d]" />
        </div>
      }
    >
      <BookingsLedgerContent />
    </Suspense>
  );
}
