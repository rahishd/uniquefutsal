"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User as UserIcon,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Database,
  Info,
  CheckCircle2,
  X,
  UserCheck,
  CalendarDays,
  Crown,
  Trophy,
  ReceiptText,
  PackageOpen,
  Settings,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { auditApi, AuditLog } from "@/lib/api/audit";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  User: <UserIcon size={16} />,
  Booking: <CalendarDays size={16} />,
  MembershipPlan: <Crown size={16} />,
  MembershipSubscription: <Crown size={16} />,
  Tournament: <Trophy size={16} />,
  Expense: <ReceiptText size={16} />,
  Product: <PackageOpen size={16} />,
  Settings: <Settings size={16} />,
};

const ENTITY_COLORS: Record<string, string> = {
  User: "bg-blue-50 text-blue-600 border-blue-100",
  Booking: "bg-emerald-50 text-emerald-600 border-emerald-100",
  MembershipPlan: "bg-violet-50 text-violet-600 border-violet-100",
  MembershipSubscription: "bg-orange-50 text-orange-600 border-orange-100",
  Tournament: "bg-amber-50 text-amber-600 border-amber-100",
  Expense: "bg-rose-50 text-rose-600 border-rose-100",
  Product: "bg-teal-50 text-teal-600 border-teal-100",
  Settings: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-rose-100 text-rose-800",
  VERIFY: "bg-amber-100 text-amber-800",
  SETTLE: "bg-purple-100 text-purple-800",
  CLAIM: "bg-orange-100 text-orange-800",
  AWARD: "bg-indigo-100 text-indigo-800",
  COMPLETE: "bg-teal-100 text-teal-800",
};

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ actions: string[]; entities: string[] }>({
    actions: [],
    entities: [],
  });
  
  // Query States
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Log Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchFilters = async () => {
    try {
      const res = await auditApi.getFilters();
      if (res.success) {
        setFilters(res.data);
      }
    } catch (error) {
      console.error("Failed to load audit filters", error);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.getAuditLogs({
        page,
        limit,
        action: selectedAction || undefined,
        entity: selectedEntity || undefined,
        search: debouncedSearch || undefined,
      });
      if (res.success) {
        setLogs(res.data);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.pages);
      }
    } catch (error) {
      console.error("Failed to load audit logs", error);
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [page, limit, selectedAction, selectedEntity, debouncedSearch]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset filters
  const resetFilters = () => {
    setSelectedAction("");
    setSelectedEntity("");
    setSearchTerm("");
    setDebouncedSearch("");
    setPage(1);
  };

  const getActionBadgeClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("CREATE")) return ACTION_COLORS.CREATE;
    if (act.includes("UPDATE")) return ACTION_COLORS.UPDATE;
    if (act.includes("DELETE")) return ACTION_COLORS.DELETE;
    if (act.includes("VERIFY")) return ACTION_COLORS.VERIFY;
    if (act.includes("SETTLE")) return ACTION_COLORS.SETTLE;
    if (act.includes("CLAIM")) return ACTION_COLORS.CLAIM;
    if (act.includes("AWARD")) return ACTION_COLORS.AWARD;
    if (act.includes("COMPLETE")) return ACTION_COLORS.COMPLETE;
    return "bg-slate-100 text-slate-800";
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            System <span className="text-[#FA6400]">Activity Log</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Audit history of all administrative actions, data edits, and critical updates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="w-12 h-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-[#0c0b5d] hover:border-[#0c0b5d] transition-all cursor-pointer disabled:opacity-40"
            title="Refresh logs"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          {(selectedAction || selectedEntity || searchTerm) && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 border border-slate-200 bg-white text-slate-500 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:text-red-500 hover:border-red-200 transition-all cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Filter Panel */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-1 max-w-4xl">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by action, changes, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0c0b5d]/5 transition-all"
            />
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
            <Activity className="text-slate-400" size={18} />
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer border-none focus:ring-0 max-w-[180px]"
            >
              <option value="">All Actions</option>
              {filters.actions.map((act) => (
                <option key={act} value={act}>
                  {act.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
            <Layers className="text-slate-400" size={18} />
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer border-none focus:ring-0 max-w-[180px]"
            >
              <option value="">All Modules</option>
              {filters.entities.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 self-center md:self-end">
          Total actions: {total}
        </div>
      </div>

      {/* Audit Timeline / Feed */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
        <div className="flex-1">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-[#FA6400] border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
                Fetching Audit Feed...
              </p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-center p-6 gap-3">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                <Database size={32} />
              </div>
              <h3 className="text-base font-black italic text-[#0c0b5d] uppercase tracking-tighter">
                No Activities Found
              </h3>
              <p className="text-slate-400 text-sm max-w-md">
                No administrative log entries match your search criteria. Try modifying your filters or search terms.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline layout list */}
              <div className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const entityName = log.entity;
                  const isSystemAction = !log.userId || !log.user;
                  return (
                    <div
                      key={log.id}
                      className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Left: Indicator, Action, Timestamp */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Module Colored Icon */}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                            ENTITY_COLORS[entityName] || "bg-slate-50 text-slate-500 border-slate-200"
                          }`}
                        >
                          {ENTITY_ICONS[entityName] || <Database size={16} />}
                        </div>

                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Action Tag */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${getActionBadgeClass(
                                log.action
                              )}`}
                            >
                              {log.action.replace(/_/g, " ")}
                            </span>
                            
                            {/* Entity ID / Details */}
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              {entityName} #{log.entityId.slice(0, 8)}
                            </span>
                          </div>

                          {/* Action Summary Sentence */}
                          <p className="text-sm font-semibold text-[#0c0b5d] leading-relaxed">
                            {log.changes}
                          </p>

                          {/* Metadata: User details & exact time */}
                          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            {/* User details */}
                            <div className="flex items-center gap-1">
                              <UserIcon size={12} className="text-slate-400" />
                              {isSystemAction ? (
                                <span className="text-slate-400 italic">SYSTEM</span>
                              ) : (
                                <span className="text-[#0c0b5d]">
                                  {log.user?.name || "Admin"} ({log.user?.role})
                                </span>
                              )}
                            </div>

                            {/* Exact Timestamp */}
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              <span>
                                {format(new Date(log.timestamp), "MMM dd, yyyy 'at' hh:mm:ss a")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Info / Details Button */}
                      <div className="flex items-center justify-end shrink-0 pl-14 md:pl-0">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-[#0c0b5d] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                        >
                          <Info size={14} />
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Paginated Controls */}
        {!loading && totalPages > 1 && (
          <div className="p-6 border-t border-slate-50 flex items-center justify-between bg-slate-50/20">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-[#0c0b5d] disabled:opacity-40 cursor-pointer transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-[#0c0b5d] disabled:opacity-40 cursor-pointer transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0c0b5d]/20 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          />

          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl relative z-10 max-h-full overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tighter flex items-center gap-2">
                  Log <span className="text-[#FA6400]">Inspection</span>
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Detail audit report for log ID: {selectedLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Action</span>
                  <span className="text-sm font-black text-[#0c0b5d]">{selectedLog.action}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Affected Module</span>
                  <span className="text-sm font-black text-[#0c0b5d]">{selectedLog.entity}</span>
                </div>
              </div>

              {/* Timestamp & User */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Performed At</span>
                  <span className="text-xs font-bold text-slate-600">
                    {format(new Date(selectedLog.timestamp), "PPpp")}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Operator</span>
                  <span className="text-xs font-bold text-[#FA6400]">
                    {selectedLog.user ? (
                      `${selectedLog.user.name || "Admin"} (${selectedLog.user.email})`
                    ) : (
                      "SYSTEM AUTOMATION"
                    )}
                  </span>
                </div>
              </div>

              {/* Action Description */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">
                  Description
                </label>
                <div className="bg-indigo-50/30 p-4 border border-indigo-50 rounded-2xl text-sm font-bold text-[#0c0b5d] leading-relaxed">
                  {selectedLog.changes}
                </div>
              </div>


            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-[#0c0b5d] text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/10 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
