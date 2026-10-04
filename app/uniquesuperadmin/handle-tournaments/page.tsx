"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Trophy, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  Loader2,
  ShieldAlert,
  ArrowRight,
  CalendarDays,
  Crown
} from "lucide-react";
import { toast } from "sonner";
import { getTournaments, getAffectedItems, applyTournamentActions, Tournament } from "@/lib/api/tournaments";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function HandleTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [fetchingAffected, setFetchingAffected] = useState(false);
  const [applying, setApplying] = useState(false);
  const [affectedItems, setAffectedItems] = useState<{
    bookings: any[];
    memberships: any[];
  } | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    date?: string;
    items: any[];
  }>({ open: false, items: [] });

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const data = await getTournaments();
      setTournaments(data.filter(t => t.isActive));
    } catch (err) {
      toast.error("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  const selectedTournament = useMemo(() => 
    tournaments.find(t => t.id === selectedTournamentId),
    [tournaments, selectedTournamentId]
  );

  useEffect(() => {
    if (selectedTournament) {
      fetchAffected();
    } else {
      setAffectedItems(null);
    }
  }, [selectedTournamentId, selectedTournament]);

  const fetchAffected = async () => {
    if (!selectedTournament) return;
    setFetchingAffected(true);
    try {
      const data = await getAffectedItems(
        selectedTournament.startDate, 
        selectedTournament.endDate,
        selectedTournament.id
      );
      setAffectedItems(data);
    } catch (err) {
      toast.error("Failed to fetch affected bookings");
    } finally {
      setFetchingAffected(false);
    }
  };

  const groupedItems = useMemo(() => {
    if (!affectedItems) return {};
    const groups: Record<string, { bookings: any[], memberships: any[] }> = {};
    
    // Combine and group by date
    affectedItems.bookings.forEach(b => {
      if (!groups[b.date]) groups[b.date] = { bookings: [], memberships: [] };
      groups[b.date].bookings.push(b);
    });
    
    affectedItems.memberships.forEach(m => {
      if (!groups[m.date]) groups[m.date] = { bookings: [], memberships: [] };
      groups[m.date].memberships.push(m);
    });

    return Object.keys(groups).sort().reduce((acc, date) => {
      acc[date] = groups[date];
      return acc;
    }, {} as typeof groups);
  }, [affectedItems]);

  const handleApply = async (date?: string) => {
    if (!affectedItems) return;

    let itemsToProcess: any[] = [];
    if (date) {
      itemsToProcess = [
        ...groupedItems[date].bookings,
        ...groupedItems[date].memberships
      ];
    } else {
      itemsToProcess = [
        ...affectedItems.bookings,
        ...affectedItems.memberships
      ];
    }

    if (itemsToProcess.length === 0) {
      toast.info("No items to process");
      return;
    }

    setConfirmState({
      open: true,
      date,
      items: itemsToProcess
    });
  };

  const executeApply = async () => {
    const itemsToProcess = confirmState.items;
    if (itemsToProcess.length === 0) return;

    setApplying(true);
    try {
      const actions = itemsToProcess.map(item => ({
        type: item.type,
        id: item.id,
        date: item.date,
        action: item.type === 'booking' ? 'cancel' : 'skip'
      }));

      await applyTournamentActions(actions);
      toast.success("Actions applied successfully");
      fetchAffected(); // Refresh
    } catch (err) {
      toast.error("Failed to apply actions");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Trophy size={120} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <ShieldAlert size={20} />
            </div>
            <h1 className="text-2xl font-black italic text-[#0c0b5d] uppercase tracking-tight">Handle Tournaments</h1>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl mb-8">
            Manage court availability and existing bookings during tournaments. Skip membership slots or cancel normal bookings for specific tournament days.
          </p>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Tournament</label>
              <select 
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="">Select an active tournament...</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.startDate} to {t.endDate})
                  </option>
                ))}
              </select>
            </div>
            {selectedTournament && (
              <button 
                onClick={() => handleApply()}
                disabled={applying || fetchingAffected || (!affectedItems?.bookings.length && !affectedItems?.memberships.length)}
                className="bg-[#0c0b5d] text-white px-8 py-3.5 rounded-2xl font-black italic uppercase tracking-widest text-xs hover:bg-indigo-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/10 flex items-center gap-2"
              >
                {applying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Apply All Skips/Cancels
              </button>
            )}
          </div>
        </div>
      </div>

      {fetchingAffected ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
           <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-4" />
           <p className="text-slate-400 text-sm font-medium italic">Analyzing affected bookings...</p>
        </div>
      ) : selectedTournamentId ? (
        Object.keys(groupedItems).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([date, { bookings, memberships }]) => (
              <div key={date} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                      <span className="text-[9px] font-black uppercase text-slate-400 leading-none">{format(new Date(date), 'MMM')}</span>
                      <span className="text-lg font-black text-[#0c0b5d] leading-none">{format(new Date(date), 'dd')}</span>
                    </div>
                    <div>
                      <h3 className="font-black italic text-[#0c0b5d] uppercase tracking-tight">{format(new Date(date), 'EEEE, MMMM do, yyyy')}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {bookings.length + memberships.length} Total Affected Slots
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleApply(date)}
                    disabled={applying || (bookings.length === 0 && memberships.length === 0)}
                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    Apply for this day <ArrowRight size={12} />
                  </button>
                </div>

                <div className="divide-y divide-slate-50">
                  {/* Memberships first as they are recurring */}
                  {memberships.map((m: any) => (
                    <div key={`${m.id}-${m.date}`} className="px-6 py-4 flex items-center justify-between group hover:bg-slate-50/30 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 border border-orange-100/50">
                          <Crown size={20} />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <span className="text-sm font-black text-[#0c0b5d]">{m.userName}</span>
                             <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase">Membership</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <Clock size={12} /> {m.timeSlot}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <CalendarDays size={12} /> Main Court
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                         <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                           Will extend expiry by 1 day
                         </span>
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                           Status: {m.status} | {m.paymentStatus}
                         </span>
                      </div>
                    </div>
                  ))}

                  {/* Normal Bookings */}
                  {bookings.map((b: any) => (
                    <div key={b.id} className="px-6 py-4 flex items-center justify-between group hover:bg-slate-50/30 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-100/50">
                          <User size={20} />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <span className="text-sm font-black text-[#0c0b5d]">{b.userName}</span>
                             <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase">Regular</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <Clock size={12} /> {b.timeSlot}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <CalendarDays size={12} /> Main Court
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                         <span className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1 rounded-full uppercase tracking-widest">
                           Will cancel & refund
                         </span>
                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                           Status: {b.status} | {b.paymentStatus}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm text-center px-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-black italic text-[#0c0b5d] uppercase tracking-tight mb-2">Clear Schedule</h2>
            <p className="text-slate-500 text-sm max-w-sm">
              No existing bookings or membership slots found during this tournament range. The court is already clear!
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 text-center px-8">
          <Calendar size={48} className="text-slate-300 mb-6" />
          <h2 className="text-lg font-black italic text-slate-400 uppercase tracking-tight mb-2">No Tournament Selected</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Select an active tournament above to view affected bookings
          </p>
        </div>
      )}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState(prev => ({ ...prev, open }))}
        title="Confirm Tournament Actions"
        description={`Are you sure you want to skip/cancel ${confirmState.items.length} bookings for ${confirmState.date || 'all tournament dates'}?`}
        confirmText="Apply Changes"
        cancelText="Cancel"
        isDangerous={true}
        isLoading={applying}
        onConfirm={executeApply}
      />
    </div>
  );
}
