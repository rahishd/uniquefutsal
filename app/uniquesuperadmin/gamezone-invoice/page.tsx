"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGamezoneRecords, createGamezoneRecord, deleteGamezoneRecord, GamezoneRecord } from "@/lib/api/gamezone";
import {
  Gamepad2,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Clock,
  User,
  MoreHorizontal,
  Calendar,
  IndianRupee,
  X,
  Printer,
  History,
  Calculator,
  MessageCircle,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { generateGamezonePDF } from "@/lib/utils/gamezone-pdf";
import { uploadGamezoneInvoice } from "@/lib/api/gamezone";

// Types are now imported from the API client

export default function GamezoneInvoicePage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRecord, setActiveRecord] = useState<GamezoneRecord | null>(null);
  const [reportRecords, setReportRecords] = useState<GamezoneRecord[] | null>(
    null,
  );
  const [reportTitle, setReportTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["gamezone-records"],
    queryFn: getGamezoneRecords,
  });

  const addMutation = useMutation({
    mutationFn: createGamezoneRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamezone-records"] });
      setIsModalOpen(false);
      resetForm();
      toast.success("Gamezone record added successfully!");
    },
    onError: () => {
      toast.error("Failed to add record");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGamezoneRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamezone-records"] });
      toast.success("Record deleted");
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    },
    onError: () => {
      toast.error("Failed to delete record");
    },
  });

  // Form State
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    hours: "1",
    rate: "300",
    date: new Date().toISOString().split("T")[0],
  });

  // Calculate money automatically
  const calculatedMoney =
    parseFloat(formData.hours) * parseFloat(formData.rate);

  // Local state for records is removed in favor of React Query

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();

    addMutation.mutate({
      customerName: formData.customerName,
      customerPhone: formData.customerPhone || undefined,
      hours: parseFloat(formData.hours),
      rate: parseFloat(formData.rate),
      money: calculatedMoney,
      date: formData.date,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  const resetForm = () => {
    setFormData({
      customerName: "",
      customerPhone: "",
      hours: "1",
      rate: "300",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const sendWhatsApp = async (record: GamezoneRecord) => {
    const rawPhone = record.customerPhone?.replace(/\D/g, "");
    if (!rawPhone) {
      toast.error("No phone number found for this record");
      return;
    }

    try {
      toast.loading("Preparing professional invoice...", { id: "gz-pdf" });
      
      // Generate PDF
      const doc = await generateGamezonePDF(record);
      const pdfBase64 = doc.output('datauristring');
      
      // Upload to backend/R2
      const { invoiceUrl } = await uploadGamezoneInvoice(record.id, pdfBase64);
      
      toast.success("Invoice prepared & link ready!", { id: "gz-pdf" });

      // Format phone number (ensure country code)
      const phone = rawPhone.startsWith("977") ? rawPhone : `977${rawPhone}`;
      
      const message = encodeURIComponent(
        `*INVOICE - UNIQUE GAMEZONE* 🎮\n\n` +
        `Hello *${record.customerName || "Gamer"}*, here is your gaming session invoice:\n\n` +
        `📄 *View Invoice:* ${invoiceUrl}\n\n` +
        `📌 *Invoice ID:* #GZ-${record.id.slice(-6).toUpperCase()}\n` +
        `📅 *Date:* ${record.date}\n` +
        `⏰ *Duration:* ${record.hours} Hour(s)\n` +
        `💰 *Total Price:* Rs. ${record.money.toLocaleString()}\n\n` +
        `Keep gaming at Unique Futsal! 🔥`
      );
      
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    } catch (error) {
      console.error("Gamezone invoice preparation failed:", error);
      toast.error("Failed to prepare invoice link", { id: "gz-pdf" });
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    deleteMutation.mutate(recordToDelete);
  };

  const handleDeleteClick = (id: string) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handlePrint = (record: GamezoneRecord) => {
    setReportRecords(null);
    setActiveRecord(record);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintReport = (type: "today" | "yesterday" | "all") => {
    let filtered: GamezoneRecord[] = [];
    let title = "";

    const today = new Date().toISOString().split("T")[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split("T")[0];

    if (type === "today") {
      filtered = records.filter((r) => r.date === today);
      title = `Daily Report - ${today}`;
    } else if (type === "yesterday") {
      filtered = records.filter((r) => r.date === yesterday);
      title = `Daily Report - ${yesterday}`;
    } else {
      filtered = [...records];
      title = "Complete Gamezone Report";
    }

    if (filtered.length === 0) {
      toast.error(`No records found for ${type}`);
      return;
    }

    setActiveRecord(null);
    setReportRecords(filtered);
    setReportTitle(title);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const filteredRecords = records.filter(
    (r) =>
      r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalRevenue = records.reduce((acc, curr) => acc + curr.money, 0);
  const totalHours = records.reduce((acc, curr) => acc + curr.hours, 0);
  
  const totalUniquePlayers = useMemo(() => {
    return new Set(records.map(r => r.customerName.toLowerCase().trim())).size;
  }, [records]);

  return (
    <div className="flex flex-col gap-8 pb-20">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice,
          #printable-invoice *,
          #printable-report,
          #printable-report * {
            visibility: visible;
          }
          #printable-invoice,
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      {/* Hidden Printable Invoice */}
      {activeRecord && (
        <div
          id="printable-invoice"
          className="hidden print:block p-10 bg-white text-black font-sans"
        >
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div>
              <h1 className="text-3xl font-black uppercase italic tracking-tighter">
                UNIQUE <span className="text-orange-600">FUTSAL</span>
              </h1>
              <p className="text-sm font-bold mt-1">GAMEZONE INVOICE</p>
              <p className="text-xs text-slate-500">
                Manigram, Tilottama-05, Nepal
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                Invoice No.
              </p>
              <p className="text-xl font-black">#GZ-{activeRecord.id}</p>
              <p className="text-xs font-bold mt-1">{activeRecord.date}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 mb-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Billed To
              </p>
              <p className="text-lg font-black uppercase tracking-tight">
                {activeRecord.customerName}
              </p>
            </div>
          </div>

          <table className="w-full border-collapse mb-10">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-4 text-left text-xs font-black uppercase tracking-widest">
                  Description
                </th>
                <th className="py-4 text-center text-xs font-black uppercase tracking-widest">
                  Hours
                </th>
                <th className="py-4 text-center text-xs font-black uppercase tracking-widest">
                  Rate (Rs.)
                </th>
                <th className="py-4 text-right text-xs font-black uppercase tracking-widest">
                  Total (Rs.)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-6">
                  <p className="text-sm font-bold uppercase tracking-tight">
                    Gamezone Play Time
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Played on {activeRecord.date} at {activeRecord.timestamp}
                  </p>
                </td>
                <td className="py-6 text-center font-bold text-sm">
                  {activeRecord.hours} hr(s)
                </td>
                <td className="py-6 text-center font-bold text-sm">
                  {activeRecord.rate}
                </td>
                <td className="py-6 text-right font-black text-sm">
                  Rs. {activeRecord.money.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end pr-2">
            <div className="w-64">
              <div className="flex justify-between py-2">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Subtotal
                </span>
                <span className="text-sm font-bold">
                  Rs. {activeRecord.money.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-4 border-t border-slate-900 mt-2">
                <span className="text-sm font-black uppercase tracking-widest">
                  Grand Total
                </span>
                <span className="text-lg font-black">
                  Rs. {activeRecord.money.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-10 border-t border-slate-100 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Thank you for playing at Unique Futsal!
            </p>
          </div>
        </div>
      )}

      {/* Hidden Printable Report */}
      {reportRecords && (
        <div
          id="printable-report"
          className="hidden print:block p-10 bg-white text-black font-sans"
        >
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
            <div>
              <h1 className="text-3xl font-black uppercase italic tracking-tighter">
                UNIQUE <span className="text-orange-600">FUTSAL</span>
              </h1>
              <p className="text-sm font-bold mt-1 uppercase tracking-widest text-slate-500">
                {reportTitle}
              </p>
              <p className="text-xs text-slate-400 mt-1 italic">
                Manigram, Tilottama-05, Nepal
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Exported On
              </p>
              <p className="text-sm font-black">
                {new Date().toLocaleDateString()}{" "}
                {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>

          <table className="w-full border-collapse mb-10">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-4 px-2 text-left text-[10px] font-black uppercase tracking-widest">
                  Date / Time
                </th>
                <th className="py-4 px-2 text-left text-[10px] font-black uppercase tracking-widest">
                  Customer
                </th>
                <th className="py-4 px-2 text-center text-[10px] font-black uppercase tracking-widest">
                  Duration
                </th>
                <th className="py-4 px-2 text-right text-[10px] font-black uppercase tracking-widest">
                  Amount (Rs.)
                </th>
              </tr>
            </thead>
            <tbody>
              {reportRecords.map((record) => (
                <tr key={record.id} className="border-b border-slate-100">
                  <td className="py-4 px-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{record.date}</span>
                      <span className="text-[9px] text-slate-400">
                        {record.timestamp}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase">
                        {record.customerName}
                      </span>
                      <span className="text-[9px] text-slate-400 leading-none">
                        #GZ-{record.id}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-center font-bold text-xs">
                    {record.hours} hr(s)
                  </td>
                  <td className="py-4 px-2 text-right font-black text-xs">
                    Rs. {record.money.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td
                  colSpan={2}
                  className="py-6 px-4 font-black uppercase tracking-widest text-xs"
                >
                  Total Records: {reportRecords.length}
                </td>
                <td className="py-6 px-2 text-center font-black text-xs">
                  {reportRecords.reduce((sum, r) => sum + r.hours, 0)} hrs
                </td>
                <td className="py-6 px-4 text-right font-black text-lg">
                  Rs.{" "}
                  {reportRecords
                    .reduce((sum, r) => sum + r.money, 0)
                    .toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <div className="w-32 h-px bg-slate-900 mb-2"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Authorized Signature
              </p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">
              Unique Futsal Management System
            </p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Gamezone <span className="text-[#FA6400]">Invoice</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Track play time, manage payments, and generate invoices for gamezone
            customers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-2xl border border-slate-100 p-1.5 shadow-sm">
            <button
              onClick={() => handlePrintReport("today")}
              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 hover:bg-[#0c0b5d] hover:text-white transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => handlePrintReport("yesterday")}
              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-[#0c0b5d] hover:text-white transition-all cursor-pointer"
            >
              Yesterday
            </button>
            <button
              onClick={() => handlePrintReport("all")}
              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-[#0c0b5d] hover:text-white transition-all cursor-pointer border-l border-slate-100 ml-1"
            >
              All Reports
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#0c0b5d] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            New Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1 hover:shadow-md transition-shadow">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Revenue
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#0c0b5d]">
              Rs. {totalRevenue.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#FA6400]">
              <TrendingUp size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Total earnings
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Hours
          </span>
          <span className="text-2xl font-black text-indigo-600">
            {totalHours.toLocaleString()} Hrs
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Total play time recorded
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Entries
          </span>
          <span className="text-2xl font-black text-emerald-600">
            {isLoading ? "..." : records.length} Records
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <History size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Invoices generated
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Total Players
          </span>
          <span className="text-2xl font-black text-rose-600">
            {isLoading ? "..." : totalUniquePlayers} Players
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <User size={16} />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Unique customers
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
        {/* Filters Header */}
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="relative flex-1 max-w-xl">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by customer name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
            />
          </div>

          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Showing {filteredRecords.length} records
          </div>
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Customer Details
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Hours
                </th>
                <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date
                </th>
                <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total Amount (Rs.)
                </th>
                <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
            {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="w-8 h-8 border-4 border-[#FA6400]/20 border-t-[#FA6400] rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Gamepad2 size={48} />
                      <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                        No records found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0"
                  >
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#0c0b5d] uppercase tracking-tight">
                          {record.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Invoice: #GZ-{record.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-[#FA6400]" />
                        {record.hours} hr(s)
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar size={14} />
                        <span className="text-[11px] font-bold">
                          {new Date(record.date).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-sm font-black text-[#0c0b5d]">
                        Rs. {record.money.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {record.customerPhone && (
                          <button
                            onClick={() => sendWhatsApp(record)}
                            className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                            title="Send on WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handlePrint(record)}
                          className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                          title="Print Invoice"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(record.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0c0b5d]/20 backdrop-blur-sm"
            onClick={() => {
              setIsModalOpen(false);
              resetForm();
            }}
          />

          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 max-h-full overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                  New Gamezone <span className="text-[#FA6400]">Entry</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Create a new invoice record
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleAddRecord}
              className="p-8 flex flex-col gap-6"
            >
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Customer Name
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FA6400]"
                    size={18}
                  />
                  <input
                    required
                    type="text"
                    placeholder="Enter customer name..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.customerName}
                    onChange={(e) =>
                      setFormData({ ...formData, customerName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Customer Phone (Optional)
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FA6400]"
                    size={18}
                  />
                  <input
                    type="tel"
                    placeholder="Enter phone number (e.g. 9867...)"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.customerPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, customerPhone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Hours Played
                  </label>
                  <div className="relative">
                    <Clock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FA6400]"
                      size={18}
                    />
                    <input
                      required
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                      value={formData.hours}
                      onChange={(e) =>
                        setFormData({ ...formData, hours: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                    Date
                  </label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Rate per Hour (Rs.)
                </label>
                <div className="relative">
                  <IndianRupee
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FA6400]"
                    size={18}
                  />
                  <input
                    required
                    type="number"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all text-[#0c0b5d]"
                    value={formData.rate}
                    onChange={(e) =>
                      setFormData({ ...formData, rate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Total Money
                  </span>
                  <span className="text-2xl font-black text-[#0c0b5d]">
                    Rs. {calculatedMoney.toLocaleString()}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-[#FA6400] shadow-sm">
                  <Calculator size={24} />
                </div>
              </div>

              <button
                type="submit"
                disabled={addMutation.isPending}
                className="mt-2 flex items-center justify-center gap-2 bg-[#FA6400] text-white py-5 rounded-[20px] font-black uppercase tracking-widest text-xs shadow-xl shadow-[#FA6400]/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {addMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {addMutation.isPending ? "Generating..." : "Generate Invoice"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Gamezone Record"
        description="Are you sure you want to delete this record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous
        onConfirm={handleDeleteRecord}
      />
    </div>
  );
}
