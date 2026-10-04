"use client"
import { useState } from "react";
import { ArrowUpRight, BarChart3, Download, TrendingUp, Calendar as CalendarIcon, Zap, PieChart, CreditCard, Banknote, Printer } from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/DatePickerWithRange";
import { DateRange } from "react-day-picker";
import { addDays, format, isSameDay, subDays, startOfMonth, startOfYear, isAfter, isBefore } from "date-fns";
import { Booking } from "@/lib/api/bookings";
import { formatTimeTo12h } from "@/lib/utils/time";
import { useBookings } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api/inventory";

interface Expense {
  id: string;
  itemName: string;
  category: string;
  price: number;
  date: string;
}

interface GamezoneRecord {
  id: string;
  customerName: string;
  money: number;
  date: string;
}

const REVENUE_DATA = [
  { day: "Mon", value: 35000, height: "45%" },
  { day: "Tue", value: 42000, height: "55%" },
  { day: "Wed", value: 28000, height: "35%" },
  { day: "Thu", value: 55000, height: "70%" },
  { day: "Fri", value: 85000, height: "95%" },
  { day: "Sat", value: 92000, height: "100%" },
  { day: "Sun", value: 78000, height: "85%" },
];

const TIME_UTILIZATION = [
  { id: "Day", name: "Day Time (05:00 AM - 05:00 PM)", bookings: 142, revenue: "Nrs. 142,000", utilization: "65%" },
  { id: "Night", name: "Prime Time (05:00 PM - 10:00 PM)", bookings: 128, revenue: "Nrs. 192,000", utilization: "92%" },
];

export default function ReportsAnalytics() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });

  const bookingsQuery = useBookings(undefined, { refetchIntervalMs: false });
  const bookings: Booking[] = bookingsQuery.data || [];
  
  const { data: inventoryLogs = [] } = useQuery({
    queryKey: ["inventory-logs-report"],
    queryFn: () => inventoryApi.getInventoryLogs(),
  });

  const [expenses] = useState<Expense[]>(() => {
    const e = localStorage.getItem("uf_admin_expenses");
    return e ? (JSON.parse(e) as Expense[]) : [];
  });
  const [gamezone] = useState<GamezoneRecord[]>(() => {
    const g = localStorage.getItem("uf_admin_gamezone_records");
    return g ? (JSON.parse(g) as GamezoneRecord[]) : [];
  });
  const [activeReport, setActiveReport] = useState<{
    title: string;
    items: { type: string; name: string; amount: number; method: string; date: string }[];
    totalIncome: number;
    totalExpense: number;
  } | null>(null);

  // Note: expenses & gamezone are stored locally for this panel.

  const handlePrintCard = (label: string) => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    
    let filteredBookings: Booking[] = [];
    let filteredExpenses: Expense[] = [];
    let filteredGamezone: GamezoneRecord[] = [];
    let filteredLogs: any[] = [];

    if (label === "Today") {
      filteredBookings = bookings.filter(b => isSameDay(new Date(b.date), today));
      filteredExpenses = expenses.filter(e => isSameDay(new Date(e.date), today));
      filteredGamezone = gamezone.filter(g => isSameDay(new Date(g.date), today));
      filteredLogs = inventoryLogs.filter((l: any) => isSameDay(new Date(l.createdAt), today));
    } else if (label === "Yesterday") {
      filteredBookings = bookings.filter(b => isSameDay(new Date(b.date), yesterday));
      filteredExpenses = expenses.filter(e => isSameDay(new Date(e.date), yesterday));
      filteredGamezone = gamezone.filter(g => isSameDay(new Date(g.date), yesterday));
      filteredLogs = inventoryLogs.filter((l: any) => isSameDay(new Date(l.createdAt), yesterday));
    } else if (label === "This Month") {
      const start = startOfMonth(today);
      filteredBookings = bookings.filter(b => isAfter(new Date(b.date), start) || isSameDay(new Date(b.date), start));
      filteredExpenses = expenses.filter(e => isAfter(new Date(e.date), start) || isSameDay(new Date(e.date), start));
      filteredGamezone = gamezone.filter(g => isAfter(new Date(g.date), start) || isSameDay(new Date(g.date), start));
      filteredLogs = inventoryLogs.filter((l: any) => isAfter(new Date(l.createdAt), start) || isSameDay(new Date(l.createdAt), start));
    } else if (label === "This Year") {
      const start = startOfYear(today);
      filteredBookings = bookings.filter(b => isAfter(new Date(b.date), start) || isSameDay(new Date(b.date), start));
      filteredExpenses = expenses.filter(e => isAfter(new Date(e.date), start) || isSameDay(new Date(e.date), start));
      filteredGamezone = gamezone.filter(g => isAfter(new Date(g.date), start) || isSameDay(new Date(g.date), start));
      filteredLogs = inventoryLogs.filter((l: any) => isAfter(new Date(l.createdAt), start) || isSameDay(new Date(l.createdAt), start));
    } else {
      filteredBookings = [...bookings];
      filteredExpenses = [...expenses];
      filteredGamezone = [...gamezone];
      filteredLogs = [...inventoryLogs];
    }

    const reportItems = [
      ...filteredBookings.map(b => ({ 
        type: "Booking", 
        name: `${b.customerName || "Guest"}${b.customerPhone ? ` - ${b.customerPhone}` : ""}`, 
        amount: b.totalPrice, 
        method: b.paymentMethod === 'cash' ? 'Cash' : 'Online', 
        date: `${b.date} @ ${formatTimeTo12h(b.startTime)}` 
      })),
      ...filteredGamezone.map(g => ({ type: "Gamezone", name: g.customerName, amount: g.money, method: "Cash/Online", date: g.date })),
      ...filteredExpenses.map(e => ({ type: "Expense", name: e.itemName, amount: -e.price, method: "Paid", date: e.date })),
      ...filteredLogs.map(l => {
        if (l.change > 0) {
          // Inventory Purchase
          const cost = l.change * (l.product?.costPrice || 0);
          if (cost > 0) {
            return { type: "Inventory Purchase", name: `Restock: ${l.product?.name}`, amount: -cost, method: "Paid", date: new Date(l.createdAt).toLocaleDateString() };
          }
          return null;
        } else if (l.change < 0 && l.price) {
          // Inventory Sale
          return { type: "Inventory Sale", name: `Sold: ${l.product?.name}`, amount: Math.abs(l.change) * l.price, method: "Cash/Online", date: new Date(l.createdAt).toLocaleDateString() };
        }
        return null;
      }).filter(Boolean) as { type: string; name: string; amount: number; method: string; date: string }[]
    ];

    const totalIncome = reportItems.filter(i => i.amount > 0).reduce((a, b) => a + b.amount, 0);
    const totalExpense = Math.abs(reportItems.filter(i => i.amount < 0).reduce((a, b) => a + b.amount, 0));

    setActiveReport({
      title: `${label} Financial Report`,
      items: reportItems,
      totalIncome,
      totalExpense
    });

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const FINANCIAL_SUMMARY = [
    { label: "Today", total: `Rs. ${bookings.filter(b => isSameDay(new Date(b.date), new Date())).reduce((a,b)=>a+b.totalPrice,0).toLocaleString()}`, online: "Mixed", cash: "Mixed", highlight: true },
    { label: "Yesterday", total: "Rs. 18,500", online: "Rs. 12,000", cash: "Rs. 6,500", highlight: false },
    { label: "This Month", total: "Rs. 415,000", online: "Rs. 300,000", cash: "Rs. 115,000", highlight: false },
    { label: "This Year", total: "Rs. 2,450,000", online: "Rs. 1,800,000", cash: "Rs. 650,000", highlight: false },
    { label: "Lifetime", total: "Rs. 8,920,000", online: "Rs. 5,100,000", cash: "Rs. 3,820,000", highlight: false }
  ];

  return (
    <div className="flex flex-col gap-8">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      {activeReport && (
        <div id="printable-report" className="hidden print:block p-10 bg-white text-black font-sans">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div>
              <h1 className="text-3xl font-black uppercase italic tracking-tighter">
                UNIQUE <span className="text-orange-600">FUTSAL</span>
              </h1>
              <p className="text-sm font-bold mt-1 uppercase tracking-widest text-slate-500">{activeReport.title}</p>
              <p className="text-xs text-slate-400 mt-1 italic">Manigram, Tilottama-05, Nepal</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Generated On</p>
              <p className="text-sm font-black">{new Date().toLocaleString("en-US", { hour: "numeric", minute: "numeric", hour12: true, month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>

          <table className="w-full border-collapse mb-10">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-4 px-2 text-left text-[10px] font-black uppercase tracking-widest">Type</th>
                <th className="py-4 px-2 text-left text-[10px] font-black uppercase tracking-widest">Description</th>
                <th className="py-4 px-2 text-left text-[10px] font-black uppercase tracking-widest">Method</th>
                <th className="py-4 px-2 text-right text-[10px] font-black uppercase tracking-widest">In (Rs.)</th>
                <th className="py-4 px-2 text-right text-[10px] font-black uppercase tracking-widest">Out (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {activeReport.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-3 px-2 text-[10px] font-bold uppercase">{item.type}</td>
                  <td className="py-3 px-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{item.name}</span>
                      <span className="text-[9px] text-slate-400">{item.date}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-[10px] font-medium">{item.method}</td>
                  <td className="py-3 px-2 text-right font-bold text-xs">
                    {item.amount > 0 ? `Rs. ${item.amount.toLocaleString()}` : "-"}
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-xs text-red-600">
                    {item.amount < 0 ? `Rs. ${Math.abs(item.amount).toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-900">
                <td colSpan={3} className="py-6 px-4 font-black uppercase tracking-widest text-xs">Net Balance</td>
                <td className="py-6 px-4 text-right font-black text-sm text-green-600">
                  + Rs. {activeReport.totalIncome.toLocaleString()}
                </td>
                <td className="py-6 px-4 text-right font-black text-sm text-red-600">
                  - Rs. {activeReport.totalExpense.toLocaleString()}
                </td>
              </tr>
              <tr className="bg-[#0c0b5d] text-white">
                <td colSpan={3} className="py-4 px-4 font-black uppercase tracking-widest text-sm">Grand Total (Profit/Loss)</td>
                <td colSpan={2} className="py-4 px-4 text-right font-black text-xl">
                  Rs. {(activeReport.totalIncome - activeReport.totalExpense).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-20 pt-10 border-t border-slate-100 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">This is an automatically generated financial summary from Unique Futsal Admin Panel.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
         <div className="flex flex-col">
            <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
               Analytics & <span className="text-[#FA6400]">Reports</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
               Comprehensive overview of venue performance and financial trends.
            </p>
         </div>
         <div className="flex items-center gap-3">
             <DatePickerWithRange date={date} setDate={setDate} />
             <button 
               onClick={() => handlePrintCard("Custom Range")}
               className="flex items-center gap-2 bg-[#FA6400] text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#FA6400]/20 hover:scale-[1.02] transition-all cursor-pointer"
             >
                <Download size={16} /> Export PDF
             </button>
         </div>
      </div>

      {/* Financial Overview Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10 w-full">
         {FINANCIAL_SUMMARY.map((period) => (
           <div 
             key={period.label} 
             className={`backdrop-blur-md rounded-[24px] border shadow-sm p-6 flex flex-col gap-4 group relative ${
               period.highlight ? "bg-[#0c0b5d] text-white border-blue-900 shadow-xl" : "bg-white/95 border-slate-100"
             }`}
           >
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-black uppercase tracking-widest ${period.highlight ? "text-blue-300" : "text-[#0c0b5d]"}`}>
                  {period.label}
                </span>
                <button 
                  onClick={() => handlePrintCard(period.label)}
                  className={`p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110 cursor-pointer ${period.highlight ? "bg-white/10 text-white" : "bg-slate-50 text-slate-400 hover:text-[#0c0b5d]"}`}
                >
                  <Printer size={14} />
                </button>
              </div>
              <span className={`text-2xl font-black ${period.highlight ? "text-white" : "text-[#FA6400]"}`}>
                 {period.total}
              </span>
              <div className={`flex flex-col gap-2 pt-4 border-t ${period.highlight ? "border-white/10" : "border-slate-50"}`}>
                 <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className={`flex items-center gap-1.5 ${period.highlight ? "text-white/70" : "text-slate-400"}`}>
                       <CreditCard size={12} /> Online
                    </span>
                    <span className={period.highlight ? "text-white" : "text-slate-700"}>{period.online}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className={`flex items-center gap-1.5 ${period.highlight ? "text-white/70" : "text-slate-400"}`}>
                       <Banknote size={12} /> Cash
                    </span>
                    <span className={period.highlight ? "text-white" : "text-slate-700"}>{period.cash}</span>
                 </div>
              </div>
           </div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10 w-full">
         
         {/* Main Chart Section */}
         <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm p-8 flex flex-col gap-8 h-full">
               <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <h3 className="text-lg font-black text-[#0c0b5d] uppercase tracking-wide flex items-center gap-2">
                        <BarChart3 size={20} className="text-[#FA6400]" /> 7-Day Revenue Trend
                     </h3>
                     <p className="text-xs font-semibold text-slate-400">Total: Nrs. 415,000</p>
                  </div>
                  <div className="flex items-center gap-1 bg-green-50 text-green-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                     <TrendingUp size={14} /> +24% vs Last Week
                  </div>
               </div>

               {/* CSS Bar Chart */}
               <div className="flex-1 flex items-end justify-between gap-2 mt-4 min-h-[250px] relative">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                    {[1,2,3,4,5].map(i => <div key={i} className="w-full border-t border-[#0c0b5d]" />)}
                  </div>
                  
                  {REVENUE_DATA.map((data, index) => (
                    <div key={index} className="flex flex-col items-center gap-3 w-full group relative z-10">
                       <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-[#0c0b5d] px-2 py-1 rounded-lg">
                         {data.value.toLocaleString()}
                       </span>
                       <div 
                         className="w-full max-w-[40px] bg-slate-100 rounded-t-xl relative overflow-hidden group-hover:shadow-[0_0_20px_rgba(250,100,0,0.2)] transition-all cursor-pointer"
                         style={{ height: "200px" }}
                       >
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-[#0c0b5d] to-[#4341b1] rounded-t-xl group-hover:from-[#FA6400] group-hover:to-[#ff8a3d] transition-colors"
                            style={{ height: data.height }}
                          />
                       </div>
                       <span className="text-xs font-black uppercase tracking-widest text-slate-400">{data.day}</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Side Metrics Section */}
         <div className="flex flex-col gap-8">
            <div className="bg-[#0c0b5d] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl flex flex-col gap-6">
                <div className="absolute -right-10 -top-10 text-blue-900/30 rotate-12">
                   <PieChart size={150} />
                </div>
                <div className="flex flex-col relative z-10">
                   <h3 className="text-lg font-black italic tracking-tighter mix-blend-overlay opacity-80 mb-6 uppercase">
                      Time Utilization
                   </h3>

                   <div className="flex flex-col gap-6">
                     {TIME_UTILIZATION.map(time => (
                       <div key={time.id} className="flex flex-col gap-2">
                         <div className="flex justify-between items-end">
                           <span className="text-xs font-bold uppercase tracking-widest text-white/70">{time.name}</span>
                           <span className="text-sm font-black text-white">{time.utilization}</span>
                         </div>
                         <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                           <div 
                             className={`h-full rounded-full ${time.id === 'Night' ? 'bg-[#FA6400]' : 'bg-blue-400'}`}
                             style={{ width: time.utilization }}
                           />
                         </div>
                         <span className="text-[10px] font-medium text-white/50">{time.bookings} Bookings • {time.revenue}</span>
                       </div>
                     ))}
                   </div>
                </div>
            </div>

            <div className="bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm p-8 flex flex-col gap-6">
               <h3 className="text-lg font-black text-[#0c0b5d] uppercase tracking-wide flex items-center gap-2">
                  <Zap size={20} className="text-[#FA6400]" /> Quick Insights
               </h3>
               
               <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                     <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                        <CalendarIcon size={18} />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-widest text-[#0c0b5d]">Peak Hours</span>
                        <span className="text-[10px] font-medium text-slate-500 mt-1">05:00 PM to 08:00 PM accounts for 65% of daily revenue.</span>
                     </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                     <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <TrendingUp size={18} />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-widest text-[#0c0b5d]">Growth</span>
                        <span className="text-[10px] font-medium text-slate-500 mt-1">Weekend bookings increased by 12% following the Elite tier rollout.</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
