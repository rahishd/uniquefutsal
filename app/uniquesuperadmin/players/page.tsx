"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Users, Search, CreditCard, Mail, ChevronRight, TrendingUp, Activity,
  CalendarCheck, X, UserPlus, ArrowUpRight, Info, Phone, Calendar,
  CheckCircle, Clock, Send, Loader2, ChevronLeft, Edit3, Trash2, AlertTriangle, ShieldAlert
} from "lucide-react";
import { usersApi, type PlayerData, type UserBooking } from "@/lib/api/users";
import { usePlayerBookings, usePlayers } from "@/lib/hooks/players";
import { toast } from "sonner";
import { formatTimeTo12h } from "@/lib/utils/time";

type Player = {
  id: string; // This is phoneNumber
  name: string;
  email: string | null;
  phone: string;
  joined: string;
  lastBooked: string;
  bookings: number;
  spend: string;
  realBookings: UserBooking[];
  freeMatches: number;
  loyaltyProgress: {
    count: number;
    isEligible: boolean;
    remainingDays?: number;
  };
};

type ActivePanel = { type: "message" | "payments" | "profile" | "history"; player: Player } | null;

export default function PlayersDirectory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", password: "" });
  const [editFormData, setEditFormData] = useState({ name: "", email: "", phone: "" });
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const playersPerPage = 7;
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const playersQuery = usePlayers({ page: currentPage, limit: playersPerPage, search: debouncedSearch });
  const apiPlayers = (playersQuery.data?.players || []) as PlayerData[];
  const totalPlayers = playersQuery.data?.total || 0;
  const globalStats = (playersQuery.data as any)?.stats || { totalMatches: 0, monthlyActiveCount: 0 };
  const isLoading = playersQuery.isLoading;

  const activePhone = activePanel?.player.phone;
  const playerBookingsQuery = usePlayerBookings(activePhone);

  const players = useMemo(() => {
    return apiPlayers.map(p => {
      // Calculation is now pre-done on backend
      return {
        id: p.phoneNumber,
        name: p.name || "Unknown",
        email: p.email,
        phone: p.phoneNumber,
        joined: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        lastBooked: p.lastBookedDate || "Never",
        bookings: p.totalMatches || 0,
        spend: p.totalSpend ? `Rs. ${p.totalSpend.toLocaleString()}` : "Rs. 0",
        realBookings: [],
        freeMatches: p.freeMatchesAvailable || 0,
        isRegistered: (p as any).isRegistered,
        loyaltyProgress: {
          count: p.loyaltyProgress || 0,
          isEligible: p.loyaltyEligible || false
        }
      };
    });
  }, [apiPlayers]);

  const handleAddPlayer = async () => {
    if (!formData.name || !formData.phone || !formData.password) {
      toast.error("Name, Phone, and Password are required");
      return;
    }

    try {
      const newPlayer = await usersApi.createPlayer({
        name: formData.name,
        email: formData.email || undefined,
        phoneNumber: formData.phone,
        password: formData.password,
      });

      toast.success("Player registered successfully!");
      setJustAdded(newPlayer.phoneNumber);
      setFormData({ name: "", email: "", phone: "", password: "" });
      setIsAddModalOpen(false);
      await playersQuery.refetch();

      // Clear highlight after 3 seconds
      setTimeout(() => setJustAdded(null), 3000);
    } catch (err: unknown) {
      console.error("Error adding player:", err);
      toast.error(err instanceof Error ? err.message : "Failed to register player");
    }
  };

  const handleUpdatePlayer = async () => {
    if (!panel || !editFormData.name || !editFormData.phone) return;

    const loadingToast = toast.loading("Updating player...");
    try {
      await usersApi.updatePlayer(panel.player.phone, {
        name: editFormData.name,
        email: editFormData.email || undefined,
        phoneNumber: editFormData.phone
      });

      toast.success("Player updated successfully!", { id: loadingToast });
      setIsEditModalOpen(false);
      setActivePanel(null);
      await playersQuery.refetch();
    } catch (err: any) {
      console.error("Error updating player:", err);
      toast.error(err.message || "Failed to update player", { id: loadingToast });
    }
  };

  const handleDeletePlayer = async () => {
    if (!panel) return;

    const loadingToast = toast.loading("Deleting player...");
    try {
      await usersApi.deletePlayer(panel.player.phone);
      toast.success("Player deleted successfully!", { id: loadingToast });
      setIsDeleteModalOpen(false);
      setActivePanel(null);
      await playersQuery.refetch();
    } catch (err: any) {
      console.error("Error deleting player:", err);
      toast.error(err.message || "Failed to delete player", { id: loadingToast });
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !panel?.player.phone) return;

    const loadingToast = toast.loading("Sending SMS...");
    try {
      await usersApi.sendCustomSms(panel.player.phone, messageText.trim());
      setMessageSent(true);
      toast.success("SMS sent successfully!", { id: loadingToast });

      setTimeout(() => {
        setMessageSent(false);
        setMessageText("");
        setActivePanel(null);
      }, 1500);
    } catch (err: any) {
      console.error("Error sending SMS:", err);
      toast.error(err.message || "Failed to send SMS", { id: loadingToast });
    }
  };

  const openPanel = async (type: "message" | "payments" | "profile" | "history", player: Player) => {
    setActivePanel({ type, player });
    setMessageText("");
    setMessageSent(false);
    if (type === "profile") {
      setEditFormData({
        name: player.name,
        email: player.email || "",
        phone: player.phone
      });
    }
  };

  const activePanelWithBookings = useMemo(() => {
    if (!activePanel) return null;
    if (activePanel.player.phone !== activePhone) return activePanel;

    const bookings = playerBookingsQuery.data || [];
    const completedBookings = bookings.filter((b) => b.status === "completed");
    const totalSpend = completedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const lastBooked = completedBookings.length > 0 ? completedBookings[0].date : activePanel.player.lastBooked;

    return {
      ...activePanel,
      player: {
        ...activePanel.player,
        realBookings: bookings,
        bookings: completedBookings.reduce((s, b) => s + ((b as any).duration || 1), 0),
        spend: `Rs. ${totalSpend.toLocaleString()}`,
        lastBooked,
      },
    };
  }, [activePanel, activePhone, playerBookingsQuery.data]);

  const panel = activePanelWithBookings || activePanel;

  const handleClaimFreeMatch = async (player: Player) => {
    try {
      await usersApi.claimFreeMatch(player.phone);
      toast.success("Free match claimed successfully!");
      await playersQuery.refetch();
      setActivePanel(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to claim free match");
    }
  };

  const handleAwardFreeMatch = async (player: Player) => {
    try {
      await usersApi.awardFreeMatch(player.phone);
      toast.success("Free match awarded to player!");
      await playersQuery.refetch();
      setActivePanel(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to award free match");
    }
  };

  // We no longer need to filter client-side since the backend handles it across all records,
  // but we can keep it as a pass-through or a quick local filter if desired. 
  // Backend filtering handles the 'search across all pages' requirement.
  const filteredPlayers = players;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
        <Loader2 className="animate-spin text-[#0c0b5d]" size={48} />
        <span className="text-xs font-black uppercase tracking-widest text-[#0c0b5d]">Loading Player Directory...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Player <span className="text-[#FA6400]">Directory</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">Manage regular bookings, player profiles, and pay-per-match history.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-blue-50 border border-blue-100 px-4 py-3 rounded-2xl">
            <Info size={14} className="text-blue-400" /> New signups appear here automatically
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-[#0c0b5d] text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/10 hover:scale-[1.02] transition-all cursor-pointer">
            <UserPlus size={18} /> Add New Player
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Users size={28} /></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Players</span>
            <span className="text-2xl font-black text-[#0c0b5d]">{totalPlayers.toLocaleString()}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-green-500 font-bold text-xs bg-green-50 px-2 py-1 rounded-lg"><TrendingUp size={12} /> +24%</div>
        </div>
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center"><Activity size={28} /></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Active</span>
            <span className="text-2xl font-black text-[#0c0b5d]">{globalStats.monthlyActiveCount}</span>
          </div>
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-300">Active this month</span>
        </div>
        <div className="bg-white/95 backdrop-blur-md p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><CalendarCheck size={28} /></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Matches</span>
            <span className="text-2xl font-black text-[#0c0b5d]">{globalStats.totalMatches.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Area: Table + Side Panel */}
      <div className="flex gap-6 relative z-10">
        {/* Table */}
        <div className={`bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm flex flex-col min-h-[600px] transition-all duration-300 ${activePanel ? "flex-1" : "w-full"}`}>
          <div className="p-4 border-b border-slate-50 flex items-center justify-between gap-4">
            <div className="relative group w-full lg:w-96">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0c0b5d] transition-colors" size={16} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search players by name, phone, or email..." className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-14 pr-4 text-xs font-bold focus:ring-1 focus:ring-[#0c0b5d] transition-all outline-none" />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex-shrink-0">{filteredPlayers.length} Players</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                  <th className="px-8 py-6">Player Identity</th>
                  {!activePanel && <th className="px-6 py-6 text-center">Last Booked</th>}
                  <th className="px-6 py-6 text-center">Activity</th>
                  <th className="px-8 py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className={`hover:bg-slate-50/50 transition-colors ${justAdded === player.id ? "bg-green-50/60" : ""} ${activePanel?.player.id === player.id ? "bg-indigo-50/40" : ""}`}>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{player.name.split(' ').map(n => n[0]).join('')}</div>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-[#0c0b5d]">{player.name}</span>
                            {justAdded === player.id && <span className="text-[8px] font-black uppercase tracking-widest bg-green-100 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">New</span>}
                            {(player as any).isRegistered ? (
                              <span className="text-[7px] font-black uppercase tracking-widest bg-blue-50 text-blue-500 border border-blue-100 px-1.5 py-0.5 rounded-md">Reg</span>
                            ) : (
                              <span className="text-[7px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded-md">Guest</span>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-slate-400">{player.id}</span>
                        </div>
                      </div>
                    </td>
                    {!activePanel && <td className="px-6 py-5 text-center"><span className="text-xs font-bold text-slate-600">{player.lastBooked}</span></td>}
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-black text-[#0c0b5d]">{player.bookings} <span className="text-[9px] text-slate-400 font-bold uppercase">Matchs</span></span>
                        <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">{player.spend}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openPanel("message", player)} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${activePanel?.type === "message" && activePanel.player.id === player.id ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50"}`}>
                          <Mail size={13} /> {!activePanel && "Message"}
                        </button>
                        <button onClick={() => openPanel("history", player)} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${activePanel?.type === "history" && activePanel.player.id === player.id ? "bg-orange-100 text-orange-700" : "text-slate-500 hover:text-orange-600 hover:bg-orange-50"}`}>
                          <Calendar size={13} /> {!activePanel && "History"}
                        </button>
                        <button onClick={() => openPanel("payments", player)} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer ${activePanel?.type === "payments" && activePanel.player.id === player.id ? "bg-green-100 text-green-700" : "text-slate-500 hover:text-green-600 hover:bg-green-50"}`}>
                          <CreditCard size={13} /> {!activePanel && "Payments"}
                        </button>
                        <button onClick={() => openPanel("profile", player)} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-sm ${activePanel?.type === "profile" && activePanel.player.id === player.id ? "bg-[#0c0b5d] text-white" : "bg-slate-50 text-slate-600 hover:bg-[#0c0b5d] hover:text-white"}`}>
                          {!activePanel && "Profile"} <ChevronRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between p-6 border-t border-slate-50 bg-slate-50/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Showing {(currentPage - 1) * playersPerPage + 1} to {Math.min(currentPage * playersPerPage, totalPlayers)} of {totalPlayers} players
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                {Array.from({ length: Math.ceil(totalPlayers / playersPerPage) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black transition-all cursor-pointer ${currentPage === i + 1 ? "bg-[#0c0b5d] text-white shadow-lg shadow-blue-900/20" : "bg-white border border-slate-100 text-slate-500 hover:border-blue-100"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                disabled={currentPage >= Math.ceil(totalPlayers / playersPerPage)}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        {panel && (
          <div className="w-96 bg-white/95 backdrop-blur-md rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-right duration-200">
            {/* Panel Header */}
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                  {panel.player.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-[#0c0b5d]">{panel.player.name}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{panel.player.id}</span>
                </div>
              </div>
              <button onClick={() => setActivePanel(null)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer">
                <X size={15} />
              </button>
            </div>

            {/* Message Panel */}
            {panel.type === "message" && (
              <div className="flex flex-col flex-1 p-6 gap-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#0c0b5d] flex items-center gap-2"><Mail size={14} className="text-blue-500" /> Send Message</h3>
                <div className="flex flex-col gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-400 font-medium"><span className="font-black text-slate-600">To:</span> {panel.player.name} ({panel.player.id})</div>
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-all"
                />

                <button onClick={handleSendMessage} disabled={!messageText.trim()} className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer disabled:opacity-40 ${messageSent ? "bg-green-500 text-white" : "bg-[#0c0b5d] text-white hover:scale-[1.02] shadow-lg shadow-blue-900/20"}`}>
                  {messageSent ? <><CheckCircle size={14} /> Sent!</> : <><Send size={14} /> Send Message</>}
                </button>

                <div className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Quick Templates:</div>
                <div className="flex flex-col gap-2">
                  {[
                    "Your booking is confirmed for today.",
                    "Reminder: Your slot starts in 1 hour.",
                    "Payment due for your last booking."
                  ].map((tpl) => (
                    <button key={tpl} onClick={() => setMessageText(tpl)} className="text-left text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all cursor-pointer">{tpl}</button>
                  ))}
                </div>
              </div>
            )}

            {panel.type === "payments" && (
              <div className="flex flex-col flex-1 p-6 gap-4 overflow-y-auto">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#0c0b5d] flex items-center gap-2"><CreditCard size={14} className="text-green-500" /> Payment History</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Bookings</div>
                    <div className="text-lg font-black text-[#0c0b5d] mt-1">{panel.player.bookings}</div>
                  </div>
                  <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                    <div className="text-[9px] font-black uppercase tracking-widest text-orange-500">Total Spent</div>
                    <div className="text-lg font-black text-[#FA6400] mt-1">{panel.player.spend}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recent Transactions</span>
                  {panel.player.realBookings.length > 0 ? panel.player.realBookings.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-[#0c0b5d]">{formatTimeTo12h(p.startTime)}</span>
                        <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1"><Calendar size={10} /> {p.date}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-black text-[#0c0b5d]">Rs. {p.totalPrice.toLocaleString()}</span>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full 
                            ${p.paymentStatus === 'completed' ? 'bg-green-50 text-green-600' :
                              p.paymentStatus === 'partially_paid' ? 'bg-amber-50 text-amber-600' :
                                'bg-red-50 text-red-600'}`}
                          >
                            {p.paymentStatus?.replace('_', ' ').toUpperCase() || p.status.toUpperCase()}
                          </span>
                          {p.paymentStatus !== 'completed' && p.remainingAmount > 0 && (
                            <span className="text-[9px] font-bold text-red-500">
                              Due: Rs. {p.remainingAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-400 text-sm font-medium">
                      {playerBookingsQuery.isLoading ? "Loading transactions..." : "No transactions yet"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {panel.type === "history" && (
              <div className="flex flex-col flex-1 p-6 gap-4 overflow-y-auto">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#0c0b5d] flex items-center gap-2"><Calendar size={14} className="text-orange-500" /> Match History</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                    <div className="text-[9px] font-black uppercase tracking-widest text-orange-500">Total Matches</div>
                    <div className="text-lg font-black text-[#FA6400] mt-1">{panel.player.bookings}</div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Last Match</div>
                    <div className="text-xs font-bold text-[#0c0b5d] mt-2">{panel.player.lastBooked}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booking History</span>
                  {panel.player.realBookings.length > 0 ? panel.player.realBookings.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-[#0c0b5d]">{p.date}</span>
                        <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1"><Clock size={10} /> {formatTimeTo12h(p.startTime)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {p.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 italic">#{p.id.slice(-6)}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-400 text-sm font-medium">
                      {playerBookingsQuery.isLoading ? "Loading history..." : "No matches played yet"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile Panel */}
            {panel.type === "profile" && (
              <div className="flex flex-col flex-1 p-6 gap-5 overflow-y-auto">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#0c0b5d] flex items-center gap-2"><Users size={14} className="text-indigo-500" /> Player Profile</h3>

                <div className="flex flex-col items-center gap-3 py-4 bg-slate-50 rounded-2xl">
                  <div className="w-16 h-16 rounded-full bg-[#0c0b5d] flex items-center justify-center text-white text-xl font-black">
                    {panel.player.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="text-center">
                    <div className="text-base font-black text-[#0c0b5d]">{panel.player.name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{panel.player.id}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    { icon: Mail, label: "Email", value: panel.player.email },
                    { icon: Phone, label: "Phone", value: panel.player.phone },
                    { icon: Calendar, label: "Member Since", value: panel.player.joined },
                    { icon: Clock, label: "Last Booked", value: panel.player.lastBooked },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm shrink-0"><Icon size={15} /></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                        <span className="text-xs font-bold text-[#0c0b5d]">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 text-center">
                    <div className="text-2xl font-black text-[#0c0b5d]">{panel.player.bookings}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mt-1">Matches</div>
                  </div>
                  <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 text-center">
                    <div className="text-base font-black text-[#FA6400]">{panel.player.spend}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-orange-400 mt-1">Total Spent</div>
                  </div>
                </div>

                {/* Loyalty Program Section */}
                <div className="bg-[#0c0b5d] rounded-[24px] p-6 text-white border border-blue-900 shadow-xl flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 text-white/5 rotate-12"><CalendarCheck size={100} /></div>
                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Loyalty Program</span>
                    {panel.player.freeMatches > 0 && (
                      <span className="bg-[#FA6400] text-white text-[8px] font-black px-2 py-1 rounded-full animate-bounce">1 FREE MATCH</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 relative z-10">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black italic uppercase tracking-tight">Match Counter</span>
                      <span className="text-sm font-black">{panel.player.loyaltyProgress.count}/10</span>
                    </div>
                    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-[#FA6400] transition-all duration-1000"
                        style={{ width: `${(panel.player.loyaltyProgress.count / 10) * 100}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-blue-200/70 font-medium leading-relaxed">
                      Complete 10 matches within 5 months to get the next one free.
                    </p>
                  </div>

                  {panel.player.freeMatches > 0 ? (
                    <div className="relative z-10 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-500/20 border border-green-500/30 text-green-400 cursor-not-allowed">
                      <CheckCircle size={14} />
                      Free Match Granted
                    </div>
                  ) : panel.player.loyaltyProgress.isEligible ? (
                    <button
                      onClick={() => handleAwardFreeMatch(panel.player)}
                      className="relative z-10 w-full bg-green-500 hover:bg-green-600 text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={14} /> Grant Free Match
                    </button>
                  ) : (
                    <div className="relative z-10 p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 opacity-60">Not Eligible Yet</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-slate-100">
                  <button onClick={() => setActivePanel((prev) => prev ? { ...prev, type: "message" } : prev)} className="flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors cursor-pointer">
                    <Mail size={14} /> Send Message
                  </button>
                  <button onClick={() => setActivePanel((prev) => prev ? { ...prev, type: "history" } : prev)} className="flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors cursor-pointer">
                    <Calendar size={14} /> View History
                  </button>
                  <button onClick={() => setActivePanel((prev) => prev ? { ...prev, type: "payments" } : prev)} className="flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors cursor-pointer">
                    <CreditCard size={14} /> View Payments
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setIsEditModalOpen(true)} className="flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 rounded-2xl hover:bg-indigo-100 transition-colors cursor-pointer">
                      <Edit3 size={14} /> Edit Profile
                    </button>
                    <button onClick={() => setIsDeleteModalOpen(true)} className="flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 rounded-2xl hover:bg-red-100 transition-colors cursor-pointer">
                      <Trash2 size={14} /> Delete Player
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Player Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-8 flex flex-col gap-6 max-h-full overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tight">Add New <span className="text-[#FA6400]">Player</span></h2>
                <p className="text-[10px] font-medium text-slate-400 mt-1">New website signups are added automatically. This is for manual entry.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name (*)</label>
                <input type="text" placeholder="e.g. Aarav Sharma" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email (Optional)</label>
                <input type="email" placeholder="player@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone (*)</label>
                <input type="tel" placeholder="98XXXXXXXX" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Set Password (*)</label>
                <input type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all" />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-50">
              <button onClick={() => setIsAddModalOpen(false)} className="w-full bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleAddPlayer} disabled={!formData.name || !formData.phone || !formData.password} className="w-full bg-[#0c0b5d] text-white font-black uppercase tracking-[0.15em] text-[10px] py-4 rounded-2xl hover:scale-[1.02] shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer">
                Register Player <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {isEditModalOpen && panel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-8 flex flex-col gap-6 max-h-full overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tight">Edit <span className="text-[#FA6400]">Player</span></h2>
                <p className="text-[10px] font-medium text-slate-400 mt-1">Updating these details will reflect across all systems including login and SMS.</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
                <input type="text" placeholder="Full Name" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email (Optional)</label>
                <input type="email" placeholder="Email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number (Login ID)</label>
                <input type="tel" placeholder="Phone Number" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/10 outline-none transition-all" />
                <p className="text-[9px] font-bold text-orange-500 bg-orange-50 p-2 rounded-lg mt-1 flex items-center gap-2">
                  <AlertTriangle size={12} /> Changing the phone number will update the player's Login ID.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-50">
              <button onClick={() => setIsEditModalOpen(false)} className="w-full bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleUpdatePlayer} disabled={!editFormData.name || !editFormData.phone} className="w-full bg-[#0c0b5d] text-white font-black uppercase tracking-[0.15em] text-[10px] py-4 rounded-2xl hover:scale-[1.02] shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer">
                Save Changes <CheckCircle size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Player Modal */}
      {isDeleteModalOpen && panel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                <ShieldAlert size={32} />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-black text-[#0c0b5d] uppercase tracking-tight">Delete Player?</h2>
                <p className="text-xs font-medium text-slate-500">
                  Are you sure you want to delete <span className="font-black text-[#0c0b5d]">{panel.player.name}</span>?
                  This action will remove their profile and they won't appear in the directory anymore.
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Warning</p>
              <p className="text-[10px] font-medium text-red-500 leading-relaxed">
                Their booking history will be preserved but anonymized. The player will no longer be able to login with this phone number.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsDeleteModalOpen(false)} className="w-full bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleDeletePlayer} className="w-full bg-red-600 text-white font-black uppercase tracking-[0.15em] text-[10px] py-4 rounded-2xl hover:bg-red-700 shadow-xl shadow-red-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                Confirm Delete <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
