"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Activity,
  Users,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  DollarSign,
  Receipt,
  Loader2,
  Wifi,
  ExternalLink,
  MessageCircle,
  Gamepad2,
  Package,
  Eye
} from "lucide-react";

import Link from "next/link";
import { 
  subDays, 
  isSameDay, 
  startOfMonth, 
  startOfYear, 
  isAfter, 
  parseISO,
  isWithinInterval,
  format,
  startOfDay,
  endOfDay
} from "date-fns";
import { getBookings, Booking } from "@/lib/api/bookings";
import { expensesApi, Expense } from "@/lib/api/expenses";
import { getGamezoneRecords, GamezoneRecord } from "@/lib/api/gamezone";
import { inventoryApi, Product } from "@/lib/api/inventory";
import { getSettings } from "@/lib/api/settings";
import { getTournaments, Tournament } from "@/lib/api/tournaments";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateDailyReportPDF } from "@/lib/utils/report-pdf";
import { uploadDailyReport, getPageVisits } from "@/lib/api/analytics";

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Complimentary policy: 2 free water bottles per settled booking.
// Backend charges (bottles − 2) × 25 in every flow (futsal update +
// membership settlement), so every booking in the period carries 2 free.
function isWaterProductName(name?: string | null) {
  const n = (name || "").toLowerCase();
  return n.includes("water") || n.includes("mineral");
}

// Timezone-safe date parsing for period filters. Full ISO timestamps keep
// their timezone; date-only strings ("YYYY-MM-DD") parse as local midnight.
// (Previously the time part was stripped, which moved Nepal (+0545) evening
// sales onto the wrong day and hid them from the Today filter.)
function toFilterDate(value?: string | null): Date | null {
  if (!value) return null;
  try {
    if (value.includes("T")) return new Date(value);
    return parseISO(value);
  } catch {
    return null;
  }
}

export default function AdminOverview() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("stay")) {
      router.replace("/uniquesuperadmin/viewslots");
    }
  }, [router]);

  const pageVisitsQuery = useQuery({
    queryKey: ["analytics", "page-visits"] as const,
    queryFn: () => getPageVisits(30),
    staleTime: 60 * 1000,
  });

  const pageVisitMap = pageVisitsQuery.data || {};

  const [timeFilter, setTimeFilter] = useState("Today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "list", { scope: "admin-overview" }] as const,
    queryFn: () => getBookings(),
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: true,
    refetchInterval: 15 * 1000,
  });

  // Fetch global player stats
  const globalPlayerStatsQuery = useQuery({
    queryKey: ["players", "global-stats"] as const,
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/users/players?page=1&limit=1`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      return data.stats || { totalMatches: 0, monthlyActiveCount: 0 };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: true,
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", "list"] as const,
    queryFn: () => expensesApi.getExpenses(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: true,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings", "detail"] as const,
    queryFn: getSettings,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
  
  const gamezoneQuery = useQuery({
    queryKey: ["gamezone-records"] as const,
    queryFn: getGamezoneRecords,
    staleTime: 30 * 1000,
  });

  const inventoryQuery = useQuery({
    queryKey: ["products"] as const,
    queryFn: () => inventoryApi.getProducts(),
    staleTime: 60 * 1000,
  });

  const inventoryLogsQuery = useQuery({
    queryKey: ["inventory-logs"] as const,
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/products/logs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 30 * 1000,
  });

  const tournamentsQuery = useQuery({
    queryKey: ["tournaments"] as const,
    queryFn: getTournaments,
    staleTime: 30 * 1000,
  });

  const bookings: Booking[] = bookingsQuery.data || [];
  const expenses: Expense[] = expensesQuery.data || [];
  const gamezoneRecords: GamezoneRecord[] = gamezoneQuery.data || [];
  const products: Product[] = inventoryQuery.data || [];
  const tournaments: Tournament[] = tournamentsQuery.data || [];
  const globalPlayerStats = globalPlayerStatsQuery.data || { totalMatches: 0, monthlyActiveCount: 0 };
  
  const wifiSettings = {
    ssid: settingsQuery.data?.settings.wifiSSID || "",
    password: settingsQuery.data?.settings.wifiPassword || "",
  };

  const stats = useMemo(() => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const monthStart = startOfMonth(today);
    const yearStart = startOfYear(today);

    const isDateInFilter = (dateStr?: string | null) => {
      if (!dateStr) return false;
      const itemDate = toFilterDate(dateStr);
      if (!itemDate || Number.isNaN(itemDate.getTime())) return false;
      switch (timeFilter) {
        case "Today": return isSameDay(itemDate, today);
        case "Yesterday": return isSameDay(itemDate, yesterday);
        case "This Month": return isAfter(itemDate, subDays(monthStart, 1));
        case "This Year": return isAfter(itemDate, subDays(yearStart, 1));
        case "Custom":
          if (!customStart || !customEnd) return true;
          return isWithinInterval(itemDate, { 
            start: startOfDay(parseISO(customStart)), 
            end: endOfDay(parseISO(customEnd)) 
          });
        case "Lifetime":
        default: return true;
      }
    };

    // Matches: Filter by the actual scheduled date of the match
    const matchBookings = bookings.filter(b => isDateInFilter(b.date));
    // Expenses: Filter by the expense date
    const filteredExpenses = expenses.filter(e => isDateInFilter(e.date));
    // Gamezone: Filter by the gamezone record date
    const filteredGamezone = gamezoneRecords.filter(r => isDateInFilter(r.date));

    // Calculate true cashflow based on actual payment logs to prevent full amounts from shifting to 'today'
    let bookingCash = 0;
    let bookingOnline = 0;
    let membershipCash = 0;
    let membershipOnline = 0;
    
    const revenueBookings: any[] = [];
    const addedBookingIds = new Set<string>();
    const transactions: any[] = [];

    bookings.forEach(b => {
      let cashRemaining = b.cashAmount || 0;
      let onlineRemaining = b.onlineAmount || 0;
      const isMembership = b.notes?.includes("MEMBERSHIP_PAYMENT") || b.notes?.includes("MEMBERSHIP_SUB") || false;
      let hasActivityInPeriod = false;

      if (b.notes) {
        const lines = b.notes.split('\n');
        for (const line of lines) {
          if (line.includes('PAYMENT_LOG:')) {
            try {
               const jsonStr = line.substring(line.indexOf('{'));
               const log = JSON.parse(jsonStr);
               if (log.at) {
                  const logCash = Number(log.cashAmount) || 0;
                  const logOnline = Number(log.onlineAmount) || 0;
                  
                  if (isDateInFilter(log.at)) {
                    const customerName = b.customerName || b.customerPhone || "Guest";
                    if (isMembership) {
                      membershipCash += logCash;
                      membershipOnline += logOnline;
                      if (logCash > 0) transactions.push({ source: "Membership", customerName, amount: logCash, method: "Cash", time: log.at });
                      if (logOnline > 0) transactions.push({ source: "Membership", customerName, amount: logOnline, method: "Online", time: log.at });
                    } else {
                      bookingCash += logCash;
                      bookingOnline += logOnline;
                      if (logCash > 0) transactions.push({ source: "Futsal", customerName, amount: logCash, method: "Cash", time: log.at });
                      if (logOnline > 0) transactions.push({ source: "Futsal", customerName, amount: logOnline, method: "Online", time: log.at });
                    }
                    hasActivityInPeriod = true;
                  }
                  
                  cashRemaining = Math.max(0, cashRemaining - logCash);
                  onlineRemaining = Math.max(0, onlineRemaining - logOnline);
               }
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }

      if (cashRemaining > 0 || onlineRemaining > 0) {
        // Fallback for initial payments or older bookings without logs
        const fallbackDate = b.createdAt; // Use createdAt for initial payments to prevent shifting
        if (isDateInFilter(fallbackDate)) {
          const customerName = b.customerName || b.customerPhone || "Guest";
          if (isMembership) {
            membershipCash += cashRemaining;
            membershipOnline += onlineRemaining;
            if (cashRemaining > 0) transactions.push({ source: "Membership", customerName, amount: cashRemaining, method: "Cash", time: fallbackDate });
            if (onlineRemaining > 0) transactions.push({ source: "Membership", customerName, amount: onlineRemaining, method: "Online", time: fallbackDate });
          } else {
            bookingCash += cashRemaining;
            bookingOnline += onlineRemaining;
            if (cashRemaining > 0) transactions.push({ source: "Futsal", customerName, amount: cashRemaining, method: "Cash", time: fallbackDate });
            if (onlineRemaining > 0) transactions.push({ source: "Futsal", customerName, amount: onlineRemaining, method: "Online", time: fallbackDate });
          }
          hasActivityInPeriod = true;
        }
      }

      if (hasActivityInPeriod && !addedBookingIds.has(b.id)) {
        revenueBookings.push(b);
        addedBookingIds.add(b.id);
      }
    });
    
    let totalGamezoneRevenue = 0;
    filteredGamezone.forEach(r => {
      const amount = r.money || 0;
      totalGamezoneRevenue += amount;
      if (amount > 0) {
        transactions.push({ source: "Gamezone", customerName: r.customerName || "Guest", amount, method: "Cash", time: r.date + (r.timestamp ? `T${r.timestamp}:00Z` : "T00:00:00Z") });
      }
    });
    
    let tournamentRevenue = 0;
    tournaments.filter(t => t.status === "completed" && t.paymentStatus === "paid" && isDateInFilter(t.completedAt || t.updatedAt)).forEach(t => {
      const amount = t.totalAmount || 0;
      tournamentRevenue += amount;
      if (amount > 0) {
        transactions.push({ source: "Tournament", customerName: t.name, amount, method: "Cash", time: t.completedAt || t.updatedAt });
      }
    });

    const totalCash = bookingCash + totalGamezoneRevenue + membershipCash + tournamentRevenue;
    const totalOnline = bookingOnline + membershipOnline; 
    const totalRevenue = totalCash + totalOnline;

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.price || 0), 0);
    const bookingsCount = matchBookings.length;
    
    // Inventory stats (Total items, low stock)
    const lowStockCount = products.filter(p => p.inventory <= p.lowStockThreshold).length;
    
    // Unique players from matches scheduled in this period
    const totalPlayers = new Set(matchBookings.map(b => b.customerName || b.id)).size;

    return {
      revenue: totalRevenue,
      cashRevenue: totalCash,
      onlineRevenue: totalOnline,
      gamezoneRevenue: totalGamezoneRevenue,
      expenses: totalExpenses,
      bookingsCount,
      players: totalPlayers,
      lowStockCount,
      membershipRevenue: membershipCash + membershipOnline,
      membershipCash,
      membershipOnline,
      futsalRevenue: bookingCash + bookingOnline,
      bookingCash,
      bookingOnline,
      tournamentRevenue,
      netProfit: Math.max(0, totalRevenue - totalExpenses),
      totalBusiness: totalRevenue + totalExpenses,
      inventorySales: (() => {
        // Complementary = 2 free bottles per settled booking (matches backend
        // charging in every flow). Membership settlements go through the same
        // booking update path, so they are included.
        const paidTournaments = tournaments.filter(
          (t) => t.status === "completed" && t.paymentStatus === "paid" && isDateInFilter(t.completedAt || t.updatedAt)
        );
        const salesLogs: any[] = (inventoryLogsQuery.data || []).filter(
          (log: any) => log.change < 0 && isDateInFilter(log.createdAt)
        );
        const nameOf = (log: any) =>
          products.find((p) => p.id === log.productId)?.name || log.product?.name || "";
        // Booking water deductions already write an inventory log
        // (`Booking Sale #id`), so only count booking bottles with no matching
        // log (pre-log era) to avoid double-counting. Tournaments never write
        // logs, so their water is always added.
        const loggedWater = salesLogs
          .filter((log: any) => isWaterProductName(nameOf(log)))
          .reduce((sum: number, log: any) => sum + Math.abs(log.change), 0);
        const legacyBookingWater = revenueBookings.reduce((sum, b) => {
          const bottles = (b as any).waterBottles || 0;
          if (bottles <= 0) return sum;
          const hasLog = salesLogs.some((log: any) => log.reason?.includes(b.id));
          return hasLog ? sum : sum + bottles;
        }, 0);
        const tournamentWater = paidTournaments.reduce((sum, t) => sum + (t.waterQuantity || 0), 0);
        const waterSold = loggedWater + legacyBookingWater + tournamentWater;
        const complementary = revenueBookings.length * 2;
        // Tournament water revenue lives in extras via waterCharge, so it is
        // excluded here — otherwise it would be counted twice (× 25 + charge).
        const waterRevenue = Math.max(0, waterSold - complementary - tournamentWater) * 25;
        return {
          waterSold,
          complementary,
          tournamentWater,
          waterRevenue,
          addOns: [
            ...revenueBookings
              .filter(b => b.addOns)
              .map(b => ({
                name: b.addOns,
                price: b.addOnsPrice,
                customer: b.customerName || b.customerPhone || "Guest"
              })),
            ...paidTournaments
              .filter(t => (t.waterCharge || 0) > 0)
              .map(t => ({
                name: `Mineral Water (${t.waterQuantity} units)`,
                price: t.waterCharge,
                customer: `Tournament: ${t.name}`
              })),
            ...salesLogs
              .filter((log: any) => !isWaterProductName(nameOf(log)))
              .map((log: any) => {
                const prod = products.find(p => p.id === log.productId);
                return {
                  name: prod?.name || log.product?.name || "Manual Deduction",
                  price: log.price || (Math.abs(log.change) * (prod?.price || log.product?.price || 0)),
                  customer: "Direct Sale (Manual)"
                };
              })
          ]
        };
      })(),
      playerTrend: Object.entries(
        matchBookings.reduce((acc, b) => {
          const dateStr = b.date;
          if (!acc[dateStr]) acc[dateStr] = new Set();
          acc[dateStr].add(b.customerPhone || b.customerName || b.id);
          return acc;
        }, {} as Record<string, Set<string>>)
      )
        .map(([date, players]) => ({
          date,
          count: players.size,
          label: format(parseISO(date), "MMM dd")
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7),
      transactions: transactions.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    };
  }, [bookings, expenses, gamezoneRecords, products, inventoryLogsQuery.data, tournaments, timeFilter, customStart, customEnd]);

  // Simple SVG Pie Chart Data
  const pieData = useMemo(() => {
    const { revenue, expenses } = stats;
    const total = revenue + expenses || 1;
    const revPercent = (revenue / total) * 100;
    const expPercent = (expenses / total) * 100;
    
    // Circular calculations for SVG
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const revOffset = circumference - (revPercent / 100) * circumference;
    const expOffset = circumference - (expPercent / 100) * circumference;

    return { revPercent, expPercent, radius, circumference, revOffset };
  }, [stats]);

  const isLoading =
    bookingsQuery.isLoading || expensesQuery.isLoading || settingsQuery.isLoading || gamezoneQuery.isLoading || inventoryQuery.isLoading || tournamentsQuery.isLoading || globalPlayerStatsQuery.isLoading;

  const handleSendToWhatsApp = async () => {
    try {
      let reportDateStr = "";
      const today = new Date();
      const yesterday = subDays(today, 1);
      const monthStart = startOfMonth(today);
      const yearStart = startOfYear(today);

      const isDateInFilter = (dateStr?: string | null) => {
        if (!dateStr) return false;
        const itemDate = toFilterDate(dateStr);
        if (!itemDate || Number.isNaN(itemDate.getTime())) return false;
        switch (timeFilter) {
          case "Today": return isSameDay(itemDate, today);
          case "Yesterday": return isSameDay(itemDate, yesterday);
          case "This Month": return isAfter(itemDate, subDays(monthStart, 1));
          case "This Year": return isAfter(itemDate, subDays(yearStart, 1));
          case "Custom":
            if (!customStart || !customEnd) return true;
            return isWithinInterval(itemDate, { 
              start: startOfDay(parseISO(customStart)), 
              end: endOfDay(parseISO(customEnd)) 
            });
          case "Lifetime":
          default: return true;
        }
      };

      switch (timeFilter) {
        case "Today":
          reportDateStr = format(today, "yyyy-MM-dd");
          break;
        case "Yesterday":
          reportDateStr = format(yesterday, "yyyy-MM-dd");
          break;
        case "This Month":
          reportDateStr = `${format(monthStart, "yyyy-MM-dd")} to ${format(today, "yyyy-MM-dd")}`;
          break;
        case "This Year":
          reportDateStr = `${format(yearStart, "yyyy-MM-dd")} to ${format(today, "yyyy-MM-dd")}`;
          break;
        case "Lifetime":
          reportDateStr = `All Time (up to ${format(today, "yyyy-MM-dd")})`;
          break;
        case "Custom":
          reportDateStr = `${customStart || "Start"} to ${customEnd || "End"}`;
          break;
        default:
          reportDateStr = format(today, "yyyy-MM-dd");
      }

      toast.loading("Generating report...", { id: "whatsapp-report" });

      // 1. Tournaments list
      let tournamentsList: { name: string; amount: number }[] = [];
      if (tournaments.length > 0) {
        const completedTournaments = tournaments.filter(t => t.status === "completed" && t.paymentStatus === "paid" && isDateInFilter(t.completedAt || t.updatedAt));
        tournamentsList = completedTournaments.map(t => ({
          name: t.name,
          amount: t.totalAmount || 0
        }));
      }

      // 2. Inventory sales
      const salesLogs = (inventoryLogsQuery.data || []).filter((log: any) => log.change < 0 && isDateInFilter(log.createdAt));
      const itemAggregates: Record<string, { qty: number, cash: number, online: number, price: number }> = {};
      
      salesLogs.forEach((log: any) => {
        // Fall back to the product embedded in the log so sales stay visible
        // even if the product list is stale or the product was deleted.
        const prod = products.find(p => p.id === log.productId);
        const name = prod?.name || log.product?.name || "Manual Deduction";
        const unitPrice = prod?.price || log.product?.price || 0;
        if (!itemAggregates[name]) {
          itemAggregates[name] = { qty: 0, cash: 0, online: 0, price: unitPrice };
        }
        itemAggregates[name].qty += Math.abs(log.change);
        itemAggregates[name].cash += Number(log.cashAmount) || 0;
        itemAggregates[name].online += Number(log.onlineAmount) || 0;
      });

      let inventorySalesItems: { name: string; qty: number; cash: number; online: number; price: number }[] = [];
      let totalInvCash = 0;
      let totalInvOnline = 0;
      for (const [name, data] of Object.entries(itemAggregates)) {
        inventorySalesItems.push({
          name,
          qty: data.qty,
          cash: data.cash,
          online: data.online,
          price: data.price
        });
        totalInvCash += data.cash;
        totalInvOnline += data.online;
      }

      // 3. Inventory Details (Stock left)
      const inventoryStockLeft = products.map(p => ({
        name: p.name,
        left: p.inventory,
        unit: p.unit
      }));

      // 4. Promocodes Stats
      const promoMap: Record<string, { count: number, discount: number }> = {};
      const matchBookings = bookings.filter(b => isDateInFilter(b.date));
      matchBookings.forEach(b => {
        if (b.promoCode && b.discountAmount > 0) {
          if (!promoMap[b.promoCode]) promoMap[b.promoCode] = { count: 0, discount: 0 };
          promoMap[b.promoCode].count += 1;
          promoMap[b.promoCode].discount += b.discountAmount;
        }
      });
      const promoCodes = Object.entries(promoMap).map(([code, data]) => ({
        code,
        count: data.count,
        discount: data.discount
      }));

      // 5. Expenses
      const filteredExpenses = expenses.filter(e => isDateInFilter(e.date));
      const expensesList = filteredExpenses.map(e => ({
        name: e.itemName,
        price: e.price
      }));

      // 6. Loyalty Claims
      const loyaltyBookings = matchBookings.filter(b => b.notes?.toLowerCase().includes('loyalty claim') || (b.basePrice > 0 && b.discountAmount === b.basePrice));
      const loyaltyClaims: string[] = [];
      loyaltyBookings.forEach(b => {
        loyaltyClaims.push(b.customerName || b.customerPhone || 'Unknown Player');
      });

      // 7. Daily Visitors
      const visitors = { registered: 0, guest: 0 };
      const uniquePhones = new Set();
      matchBookings.forEach(b => {
        if (!uniquePhones.has(b.customerPhone)) {
          uniquePhones.add(b.customerPhone);
          if (b.userId) visitors.registered++;
          else visitors.guest++;
        }
      });

      // Call PDF Generator with detailed data
      const doc = await generateDailyReportPDF({
        date: reportDateStr,
        futsalRevenue: {
          online: stats.bookingOnline || 0,
          cash: stats.bookingCash || 0,
          tournaments: tournamentsList,
        },
        gamezoneRevenue: stats.gamezoneRevenue || 0,
        playersCount: stats.players || 0,
        inventorySales: {
          items: inventorySalesItems,
          totalCash: totalInvCash,
          totalOnline: totalInvOnline,
        },
        inventoryStockLeft,
        promoCodes,
        expenses: expensesList,
        totalExpenses: stats.expenses || 0,
        loyaltyClaims,
        visitors,
        reportType: `${timeFilter.toUpperCase()} REPORT`,
        subTitle: `${timeFilter} Business Operations Report`,
      });

      // 2. Download PDF locally
      const cleanFileName = `DAILY-REPORT-${reportDateStr.replace(/\s+/g, "_")}.pdf`;
      doc.save(cleanFileName);

      // 3. Upload to backend/R2
      toast.loading("Uploading report link...", { id: "whatsapp-report" });
      const pdfBase64 = doc.output('datauristring');
      const { reportUrl } = await uploadDailyReport(pdfBase64);

      // 4. Send formatted message with link to WhatsApp
      const message = `*DAILY REPORT - UNIQUE FUTSAL* ⚽\n\n` +
        `Here is the official daily business operations report for *${reportDateStr}*:\n\n` +
        `📄 *View Full Report (PDF):* ${reportUrl}\n\n` +
        `📊 *Summary Metrics:*\n` +
        `• *Futsal Revenue:* Rs. ${stats.futsalRevenue.toLocaleString()}\n` +
        `• *Gamezone Revenue:* Rs. ${stats.gamezoneRevenue.toLocaleString()}\n` +
        `• *Tournament Revenue:* Rs. ${stats.tournamentRevenue.toLocaleString()}\n` +
        `• *Membership Revenue:* Rs. ${stats.membershipRevenue.toLocaleString()}\n` +
        `• *Operational Expenses:* Rs. ${stats.expenses.toLocaleString()}\n` +
        `• *Net Profit:* Rs. ${stats.netProfit.toLocaleString()}\n\n` +
        `Thank you! 🔥`;

      const whatsappUrl = `https://wa.me/9811940018?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, "_blank");

      toast.success("Report prepared, downloaded, and WhatsApp opened!", { id: "whatsapp-report" });
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate or send report", { id: "whatsapp-report" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[#0c0b5d]" size={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Welcome Banner & Time Filter */}
      <div className="flex flex-col gap-6">
        <div className="relative overflow-hidden rounded-[40px] bg-white border border-slate-100 p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
          <div className="absolute right-0 top-0 w-1/3 h-full bg-[#0c0b5d]/5 rounded-l-full blur-3xl" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
              Welcome, <span className="text-[#FA6400]">Admin</span>
            </h1>
            <p className="text-slate-400 font-medium text-sm mt-1">
              Overview for <span className="text-[#0c0b5d] font-black underline decoration-[#FA6400] underline-offset-4">{timeFilter}</span>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 z-10">
            <button
              onClick={handleSendToWhatsApp}
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white px-6 py-3 rounded-[20px] font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-green-500/20 active:scale-95 group"
            >
              <MessageCircle size={18} className="group-hover:rotate-12 transition-transform" />
              Send to WhatsApp
            </button>
          </div>


          {/* Time Filters */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-[22px] border border-slate-100 z-10">
            {["Today", "Yesterday", "This Month", "This Year", "Lifetime", "Custom"].map((f) => {
              const active = timeFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  className={`px-5 py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    active 
                      ? "bg-[#0c0b5d] text-white shadow-lg shadow-blue-900/20" 
                      : "text-slate-400 hover:text-[#0c0b5d] hover:bg-white"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Range Inputs */}
        {timeFilter === "Custom" && (
          <div className="flex flex-wrap items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
             <div className="flex flex-col gap-1.5">
               <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Start Date</label>
               <input 
                 type="date" 
                 value={customStart} 
                 max={new Date().toISOString().split("T")[0]}
                 onChange={(e) => setCustomStart(e.target.value)}
                 className="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none" 
               />
             </div>
             <div className="flex flex-col gap-1.5">
               <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">End Date</label>
               <input 
                 type="date" 
                 value={customEnd} 
                 max={new Date().toISOString().split("T")[0]}
                 onChange={(e) => setCustomEnd(e.target.value)}
                 className="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none" 
               />
             </div>
          </div>
        )}
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Revenue", value: `Rs. ${stats.revenue.toLocaleString()}`, color: "text-indigo-600", bg: "bg-indigo-50", icon: TrendingUp },
          { label: "Cash Revenue", value: `Rs. ${stats.cashRevenue.toLocaleString()}`, color: "text-green-600", bg: "bg-green-50", icon: DollarSign },
          { label: "Online Revenue", value: `Rs. ${stats.onlineRevenue.toLocaleString()}`, color: "text-blue-600", bg: "bg-blue-50", icon: ExternalLink },
          { label: "Net Profit", value: `Rs. ${Math.max(0, stats.revenue - stats.expenses).toLocaleString()}`, color: "text-[#FA6400]", bg: "bg-orange-50", icon: Activity },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-[32px] p-8 border border-slate-50 shadow-sm flex flex-col gap-4 hover:scale-[1.02] transition-all group">
            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center transition-colors`}>
              <stat.icon size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</span>
              <span className="text-2xl font-black text-[#0c0b5d]">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Membership Rev.", value: `Rs. ${stats.membershipRevenue.toLocaleString()}`, color: "text-[#FA6400]", bg: "bg-orange-50", icon: Users },
          { label: "Gamezone Rev.", value: `Rs. ${stats.gamezoneRevenue.toLocaleString()}`, color: "text-indigo-600", bg: "bg-indigo-50", icon: Gamepad2 },
          { label: "Tournament Rev.", value: `Rs. ${stats.tournamentRevenue.toLocaleString()}`, color: "text-emerald-600", bg: "bg-emerald-50", icon: CalendarCheck },
          { label: "Total Expenses", value: `Rs. ${stats.expenses.toLocaleString()}`, color: "text-red-500", bg: "bg-red-50", icon: Activity },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-[32px] p-6 border border-slate-50 shadow-sm flex flex-col gap-3 hover:scale-[1.02] transition-all group">
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center transition-colors`}>
                <stat.icon size={20} />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{stat.label}</span>
              <span className="text-xl font-black text-[#0c0b5d]">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Analytical Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Pie Chart Card */}
        <div className="lg:col-span-3 bg-[#0c0b5d] rounded-[48px] p-10 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[#FA6400]/10 rounded-full blur-[100px]" />
          
          <div className="relative z-10 flex flex-col h-full gap-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2">Financial <span className="text-[#FA6400]">Efficiency</span></h3>
                <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Revenue vs Expenditure Analysis</p>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                <PieIcon size={16} className="text-[#FA6400]" />
                <span className="text-[10px] font-black uppercase tracking-widest">Live Breakdown</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-10 flex-1">
              {/* SVG PIE CHART */}
              <div className="relative w-64 h-64 flex items-center justify-center">
                 <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
                    {/* Background Circle */}
                    <circle cx="100" cy="100" r={pieData.radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="30" />
                    {/* Revenue Arc */}
                    <circle 
                      cx="100" cy="100" r={pieData.radius} 
                      fill="transparent" stroke="#22c55e" strokeWidth="30"
                      strokeDasharray={pieData.circumference}
                      strokeDashoffset={pieData.revOffset}
                      strokeLinecap="round"
                    />
                    {/* Expense Arc (Starting after Revenue) */}
                    <circle 
                      cx="100" cy="100" r={pieData.radius} 
                      fill="transparent" stroke="#ef4444" strokeWidth="30"
                      strokeDasharray={pieData.circumference}
                      strokeDashoffset={pieData.circumference - (pieData.expPercent / 100) * pieData.circumference}
                      style={{ transform: `rotate(${(pieData.revPercent / 100) * 360}deg)`, transformOrigin: "center" }}
                      strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black">
                      {Math.round(pieData.revPercent)}%
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-tighter text-indigo-300">Net Profitability</span>
                 </div>
              </div>

              {/* Legend & Details */}
              <div className="flex flex-col gap-6 w-full md:w-auto">
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/5">
                       <div className="w-3 h-12 bg-green-500 rounded-full" />
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Total Revenue</span>
                          <span className="text-xl font-black">Rs. {stats.revenue.toLocaleString()}</span>
                       </div>
                       <ArrowUpRight className="text-green-500 ml-auto" size={24} />
                    </div>

                    <div className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/5">
                       <div className="w-3 h-12 bg-red-500 rounded-full" />
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Total Expenses</span>
                          <span className="text-xl font-black">Rs. {stats.expenses.toLocaleString()}</span>
                       </div>
                       <ArrowDownRight className="text-red-500 ml-auto" size={24} />
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Summary Cards */}
    <div className="lg:col-span-2 flex">
      <div className="bg-white rounded-[40px] p-8 border border-slate-50 shadow-sm flex flex-col justify-between w-full h-full">
        <h4 className="text-sm font-black uppercase tracking-widest text-[#0c0b5d] flex items-center gap-2">
          <DollarSign size={18} className="text-[#FA6400]" /> Revenue Breakdown
        </h4>
        <div className="flex-1 flex flex-col gap-4 mt-6">
          <div className="w-full p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Total Revenue
            </span>
            <p className="text-3xl font-black text-[#0c0b5d] mt-1">
              Rs. {stats.revenue.toLocaleString()}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
              <span className="text-[9px] font-black uppercase tracking-widest text-green-600 block mb-1">Cash</span>
              <p className="text-lg font-black text-green-700">Rs. {stats.cashRevenue.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 block mb-1">Online</span>
              <p className="text-lg font-black text-blue-700">Rs. {stats.onlineRevenue.toLocaleString()}</p>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full my-2" />

          <div className="flex flex-col gap-3">
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Futsal Revenue</span>
                <span className="text-xs font-black text-[#0c0b5d]">Rs. {stats.futsalRevenue.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Membership Revenue</span>
                <span className="text-xs font-black text-[#FA6400]">Rs. {stats.membershipRevenue.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gamezone Revenue</span>
                <span className="text-xs font-black text-indigo-600">Rs. {stats.gamezoneRevenue.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tournament Revenue</span>
                <span className="text-xs font-black text-emerald-600">Rs. {stats.tournamentRevenue.toLocaleString()}</span>
             </div>
           </div>
        </div>
      </div>
    </div>

   
      </div>
      
      {/* Inventory Sales Report */}
      <div className="bg-white rounded-[48px] p-10 border border-slate-50 shadow-sm flex flex-col gap-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
              Inventory <span className="text-[#FA6400]">Sales Report</span>
            </h3>
            <p className="text-slate-400 font-medium text-xs uppercase tracking-widest">
              Add-ons and Extras sold in this period
            </p>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            <Package size={16} /> Total Sales: Rs. {(stats.inventorySales.waterRevenue + stats.inventorySales.addOns.reduce((sum, item) => sum + (item.price || 0), 0)).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Water Bottles Breakdown */}
          <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Mineral Water Bottles</span>
              <span className="bg-[#0c0b5d] text-white px-3 py-1 rounded-full text-[10px] font-black">{stats.inventorySales.waterSold} Units</span>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-widest">Complementary Units</span>
                <span className="text-[#0c0b5d] font-black">{Math.min(stats.inventorySales.waterSold, stats.inventorySales.complementary)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-widest">Paid Units</span>
                <span className="text-[#0c0b5d] font-black">{Math.max(0, stats.inventorySales.waterSold - stats.inventorySales.complementary)}</span>
              </div>
              <div className="h-px bg-slate-200 w-full" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-[#0c0b5d] uppercase tracking-tighter italic">Total Water Revenue</span>
                <span className="text-xl font-black text-[#FA6400]">Rs. {stats.inventorySales.waterRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Add-ons/Extra Items Breakdown */}
          <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 flex flex-col gap-6 max-h-[400px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Other Items (Shoes, Socks, etc.)</span>
            <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
              {stats.inventorySales.addOns.length > 0 ? (
                stats.inventorySales.addOns.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-[#0c0b5d] uppercase italic">{item.name}</span>
                      <span className="text-[9px] font-bold text-slate-400">Sold to: {item.customer}</span>
                    </div>
                    <span className="text-sm font-black text-[#FA6400]">Rs. {item.price?.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                  <Package size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest mt-2">No items sold yet</p>
                </div>
              )}
            </div>
            {stats.inventorySales.addOns.length > 0 && (
              <>
                <div className="h-px bg-slate-200 w-full" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-[#0c0b5d] uppercase tracking-tighter italic">Total Extras Revenue</span>
                  <span className="text-xl font-black text-[#FA6400]">Rs. {stats.inventorySales.addOns.reduce((sum, item) => sum + (item.price || 0), 0).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Player Stats Section */}
      <div className="bg-white rounded-[48px] p-10 border border-slate-50 shadow-sm flex flex-col gap-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
              Player <span className="text-[#FA6400]">Activity</span>
            </h3>
            <p className="text-slate-400 font-medium text-xs uppercase tracking-widest">
              Unique Players Trend (Last 7 Days in Period)
            </p>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            <Users size={16} /> {stats.players} Total Players
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {stats.playerTrend.length > 0 ? (
            <div className="flex items-end justify-between gap-4 h-64 mt-4 px-4 bg-slate-50/50 rounded-[32px] p-8 border border-slate-100/50">
              {stats.playerTrend.map((data, i) => {
                const maxCount = Math.max(...stats.playerTrend.map(d => d.count)) || 1;
                const height = (data.count / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                    <div className="relative w-full flex flex-col items-center">
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-[#0c0b5d] text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-xl z-20">
                        {data.count} Players
                      </div>
                      <div className="w-full max-w-[50px] bg-slate-200/50 rounded-2xl overflow-hidden relative" style={{ height: '180px' }}>
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-[#0c0b5d] to-[#FA6400] transition-all duration-700 ease-out"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-[#0c0b5d] transition-colors text-center">
                      {data.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
              <Users size={40} className="text-slate-300 mb-2" />
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No activity data for this period</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Peak Daily Count</span>
               <div className="flex items-end gap-2">
                 <span className="text-2xl font-black text-[#0c0b5d]">{Math.max(...stats.playerTrend.map(d => d.count), 0)}</span>
                 <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Players</span>
               </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Active Matches</span>
               <div className="flex items-end gap-2">
                 <span className="text-2xl font-black text-[#0c0b5d]">{stats.bookingsCount}</span>
                 <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase">Slots</span>
               </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Retention Meta</span>
               <div className="flex items-end gap-2">
                 <span className="text-2xl font-black text-[#0c0b5d]">{Math.round((stats.players / (stats.bookingsCount || 1)) * 100)}%</span>
                 <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase">P/B Ratio</span>
               </div>
            </div>
            <div className="bg-green-50 p-6 rounded-[24px] border border-green-100">
               <span className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-2 block">Total Match Played</span>
               <div className="flex items-end gap-2">
                 <span className="text-2xl font-black text-green-700">{globalPlayerStats.totalMatches.toLocaleString()}</span>
                 <span className="text-[10px] font-bold text-green-500 mb-1 uppercase">All-Time</span>
               </div>
            </div>
            <div className="bg-blue-50 p-6 rounded-[24px] border border-blue-100">
               <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 block">Total Active Players</span>
               <div className="flex items-end gap-2">
                 <span className="text-2xl font-black text-blue-700">{globalPlayerStats.monthlyActiveCount.toLocaleString()}</span>
                 <span className="text-[10px] font-bold text-blue-500 mb-1 uppercase">This Month</span>
               </div>
            </div>
           </div>
            </div>
          </div>

      {/* Daily Page Visits Section */}
      {(() => {
        const today = new Date();
        const visitDays: { date: string; label: string; count: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          visitDays.push({
            date: dateStr,
            label: format(d, "MMM d"),
            count: pageVisitMap[dateStr] || 0,
          });
        }

        const yesterday = subDays(today, 1);
        const monthStart = startOfMonth(today);
        const yearStart = startOfYear(today);
        let filteredTotal = 0;
        for (const [dateStr, cnt] of Object.entries(pageVisitMap)) {
          const itemDate = parseISO(dateStr);
          let include = false;
          switch (timeFilter) {
            case "Today": include = isSameDay(itemDate, today); break;
            case "Yesterday": include = isSameDay(itemDate, yesterday); break;
            case "This Month": include = isAfter(itemDate, subDays(monthStart, 1)); break;
            case "This Year": include = isAfter(itemDate, subDays(yearStart, 1)); break;
            case "Custom":
              if (customStart && customEnd) {
                include = isWithinInterval(itemDate, { start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) });
              } else { include = true; }
              break;
            default: include = true;
          }
          if (include) filteredTotal += cnt;
        }

        const todayStr = getTodayStr();
        const todayVisits = pageVisitMap[todayStr] || 0;
        const maxVisit = Math.max(...visitDays.map(d => d.count), 1);
        const peakDay = visitDays.reduce((best, d) => d.count > best.count ? d : best, visitDays[0] || { date: "-", label: "-", count: 0 });

        return (
          <div className="bg-white rounded-[48px] p-10 border border-slate-50 shadow-sm flex flex-col gap-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  Daily Page <span className="text-[#FA6400]">Visits</span>
                </h3>
                <p className="text-slate-400 font-medium text-xs uppercase tracking-widest">
                  How many times the admin overview was opened — last 30 days
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                  <Eye size={16} /> Today: {todayVisits} visit{todayVisits !== 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-2 bg-[#FA6400]/10 text-[#FA6400] px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                  <TrendingUp size={16} /> {timeFilter}: {filteredTotal} visit{filteredTotal !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* Summary mini cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Today", value: pageVisitMap[format(today, "yyyy-MM-dd")] || 0, color: "text-indigo-600", bg: "bg-indigo-50" },
                { label: "Yesterday", value: pageVisitMap[format(subDays(today, 1), "yyyy-MM-dd")] || 0, color: "text-purple-600", bg: "bg-purple-50" },
                { label: "Peak Day", value: peakDay.count, color: "text-[#FA6400]", bg: "bg-orange-50", sub: peakDay.label },
                { label: `${timeFilter} Total`, value: filteredTotal, color: "text-emerald-600", bg: "bg-emerald-50" },
              ].map((s: any, i) => (
                <div key={i} className={`${s.bg} p-5 rounded-[24px] border border-white/60 flex flex-col gap-1`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${s.color} opacity-70`}>{s.label}</span>
                  <span className={`text-3xl font-black ${s.color}`}>{s.value}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.sub || "visits"}</span>
                </div>
              ))}
            </div>

            {/* Bar chart — last 30 days */}
            <div className="bg-slate-50/60 rounded-[32px] border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last 30 Days</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Peak: {peakDay.count} on {peakDay.label}</span>
              </div>
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-6">
                {visitDays.map((day, i) => {
                  const heightPct = maxVisit > 0 ? (day.count / maxVisit) * 100 : 0;
                  const isToday = day.date === todayStr;
                  return (
                    <div key={i} className="flex-1 min-w-[18px] flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-[#0c0b5d] text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg z-20 whitespace-nowrap pointer-events-none">
                        {day.count} visit{day.count !== 1 ? "s" : ""}
                        <br />
                        <span className="opacity-70">{day.label}</span>
                      </div>
                      <div className="w-full rounded-t-lg overflow-hidden relative" style={{ height: "120px" }}>
                        <div
                          className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500 ${
                            isToday
                              ? "bg-[#FA6400]"
                              : day.count > 0
                              ? "bg-[#0c0b5d]/70 group-hover:bg-[#0c0b5d]"
                              : "bg-slate-200"
                          }`}
                          style={{ height: `${Math.max(heightPct, day.count > 0 ? 4 : 2)}%` }}
                        />
                      </div>
                      {(i % 5 === 0 || isToday) && (
                        <span className={`text-[8px] font-black uppercase tracking-widest ${
                          isToday ? "text-[#FA6400]" : "text-slate-400"
                        }`} style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", marginTop: 2 }}>
                          {day.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#FA6400]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Today</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#0c0b5d]/70" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Past Days</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">No Visits</span>
                </div>
              </div>
            </div>

            {/* Per-day breakdown — last 14 days */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Daily Breakdown (Last 14 Days)</span>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {visitDays.slice(-14).map((day, i) => {
                  const isToday = day.date === todayStr;
                  return (
                    <div
                      key={i}
                      className={`p-4 rounded-[20px] border flex flex-col gap-1 ${
                        isToday
                          ? "bg-[#FA6400]/10 border-[#FA6400]/20"
                          : day.count > 0
                          ? "bg-indigo-50/60 border-indigo-100"
                          : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <span className={`text-[8px] font-black uppercase tracking-widest ${
                        isToday ? "text-[#FA6400]" : "text-slate-400"
                      }`}>{isToday ? "Today" : day.label}</span>
                      <span className={`text-2xl font-black ${
                        isToday ? "text-[#FA6400]" : day.count > 0 ? "text-[#0c0b5d]" : "text-slate-300"
                      }`}>{day.count}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">visit{day.count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
