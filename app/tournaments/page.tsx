"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getActiveTournaments, submitRegistration, Tournament, Registration } from "@/lib/api/tournaments";
import { Trophy, Calendar, Users, DollarSign, ChevronRight, AlertCircle, X, CheckCircle2, User, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function TournamentsPage() {
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["activeTournaments"],
    queryFn: getActiveTournaments,
  });

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    teamName: "",
    captainName: "",
    contactEmail: "",
    contactPhone: "",
    playersText: "",
  });

  const registerMutation = useMutation({
    mutationFn: submitRegistration,
    onSuccess: () => {
      setIsSuccess(true);
    },
  });

  const handleOpenModal = (t: Tournament) => {
    setSelectedTournament(t);
    setIsSuccess(false);
    setFormData({
      teamName: "", captainName: "", contactEmail: "", contactPhone: "", playersText: ""
    });
  };

  const handleCloseModal = () => {
    setSelectedTournament(null);
    setIsSuccess(false);
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = selectedTournament ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [selectedTournament]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;

    const players = formData.playersText
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const regData: Registration = {
      id: `reg-${Date.now()}`,
      tournamentId: selectedTournament.id,
      teamName: formData.teamName,
      captainName: formData.captainName,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      players,
    };

    registerMutation.mutate(regData);
  };

  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
      <Navbar />

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 md:px-20 pt-32 pb-20">
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100/50 border border-orange-200 text-orange-600 text-xs font-black uppercase tracking-widest mb-6 border-dashed">
            <Trophy size={14} /> Compete & Win
          </div>
          <h1 className="text-5xl md:text-7xl font-black uppercase text-[#0c0b5d] tracking-tight mb-6 drop-shadow-sm">
            Active <span className="text-[#FA6400]">Tournaments</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium leading-relaxed">
            Gather your squad and prove your dominance. Register for our upcoming tournaments and battle for the ultimate prize!
          </p>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center">
             <div className="w-12 h-12 border-4 border-[#FA6400]/20 border-t-[#FA6400] rounded-full animate-spin" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white/60 backdrop-blur-xl rounded-[40px] border border-gray-200 border-dashed text-slate-400 shadow-sm">
            <AlertCircle size={64} className="mb-6 opacity-20 text-[#0c0b5d]" />
            <h3 className="text-2xl font-black text-[#0c0b5d] uppercase mb-2">No Active Tournaments</h3>
            <p className="font-medium text-center max-w-sm">There are no tournaments currently available for registration. Check back soon for new events!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tournaments.map((t) => (
              <div key={t.id} className="group relative bg-white/90 backdrop-blur-2xl rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                <div className="absolute top-0 right-0 p-6 z-20">
                  <div className="px-3 py-1.5 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-green-500/30 border border-green-400">
                    Registrations Open
                  </div>
                </div>
                
                <div className="h-48 bg-gradient-to-br from-[#0c0b5d] to-[#1a18a9] p-8 flex flex-col justify-end relative overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-10"></div>
                  <Trophy size={140} className="absolute -top-10 -right-10 text-white opacity-5 rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-0" />
                  
                  <h3 className="text-3xl font-black text-white uppercase leading-tight z-10 relative drop-shadow-md">{t.name}</h3>
                </div>
                
                <div className="p-8 flex flex-col flex-grow relative z-10 bg-white">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-[#FA6400] shrink-0 border border-orange-100">
                           <DollarSign size={18} />
                        </div>
                        <div className="flex flex-col pb-1">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prize Pool</span>
                           <span className="text-lg font-black text-[#0c0b5d]">Rs. {t.prizePool}</span>
                        </div>
                     </div>
                     <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
                           <Users size={18} />
                        </div>
                        <div className="flex flex-col pb-1">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacity</span>
                           <span className="text-sm font-black text-[#0c0b5d] mt-1">{t.minTeams} - {t.maxTeams} Teams</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-6">
                     <Calendar size={20} className="text-slate-400 shrink-0 mt-0.5" />
                     <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-[#0c0b5d]">
                          {t.startDate ? format(parseISO(t.startDate), "MMM d, yyyy") : "TBD"} - {t.endDate ? format(parseISO(t.endDate), "MMM d, yyyy") : "TBD"}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tournament Dates</span>
                     </div>
                  </div>
                  
                  <p className="text-sm font-medium text-slate-500 line-clamp-3 mb-8 flex-grow">
                    {t.description}
                  </p>
                  
                  <button onClick={() => handleOpenModal(t)} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#0c0b5d] text-white font-black uppercase tracking-widest text-sm hover:bg-[#FA6400] transition-colors shadow-xl shadow-[#0c0b5d]/10 mt-auto cursor-pointer border border-[#0c0b5d]">
                    Register Team <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Registration Modal Overlay */}
      {selectedTournament && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 py-16 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-md" onClick={handleCloseModal} />
          
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[40px] shadow-2xl z-10 animate-in zoom-in-95 fade-in duration-300" style={{ scrollbarWidth: "none" }}>
            
            <div className="absolute top-6 right-6 z-30">
               <button onClick={handleCloseModal} className="p-3 bg-white/20 hover:bg-white text-white hover:text-[#0c0b5d] rounded-full backdrop-blur-md transition-all cursor-pointer shadow-lg group">
                  <X size={20} className="drop-shadow-sm group-hover:scale-110 transition-transform" />
               </button>
            </div>

            {isSuccess ? (
              <div className="p-12 md:p-24 flex flex-col items-center justify-center text-center min-h-[60vh]">
                <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-8 animate-in zoom-in">
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-4xl md:text-5xl font-black uppercase text-[#0c0b5d] tracking-tight mb-4">
                  Registration <span className="text-[#FA6400]">Successful!</span>
                </h2>
                <p className="text-lg text-slate-500 font-medium mb-12 max-w-lg">
                  Your team <strong className="text-[#0c0b5d]">{formData.teamName}</strong> has been successfully registered for <strong className="text-[#0c0b5d]">{selectedTournament.name}</strong>. We will contact {formData.captainName} soon with further details and fixtures.
                </p>
                <button onClick={handleCloseModal} className="px-10 py-5 bg-[#0c0b5d] text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FA6400] transition-colors shadow-xl shadow-[#0c0b5d]/20 cursor-pointer">
                  Close & Return
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#0c0b5d] to-[#1a18a9] p-8 md:p-14 relative overflow-hidden text-white">
                   <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-10"></div>
                   <Trophy size={200} className="absolute -top-10 -right-10 opacity-5 rotate-12" />
                   <div className="relative z-10 pr-12">
                      <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 inline-block">
                         Official Tournament Entry
                      </span>
                      <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4 drop-shadow-md">
                        Join <span className="text-[#FA6400]">{selectedTournament.name}</span>
                      </h2>
                      <p className="text-white/80 font-medium max-w-xl text-lg relative z-20">
                         Fill out the form below to secure your team&apos;s spot. Your team matters!
                      </p>
                   </div>
                </div>

                {/* Modal Form */}
                <div className="p-8 md:p-14">
                  <form onSubmit={handleSubmit} className="flex flex-col gap-10">
                    
                    {/* Team Info */}
                    <div className="flex flex-col gap-6">
                       <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-widest flex items-center gap-3 border-b border-gray-100 pb-4">
                          <Users size={24} className="text-[#FA6400]" /> Team Details
                       </h3>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Team Name</label>
                            <input required type="text" value={formData.teamName} onChange={e => setFormData({...formData, teamName: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all focus:bg-white" placeholder="e.g. Kathmandu Kings" />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Captain Name</label>
                            <div className="relative">
                              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input required type="text" value={formData.captainName} onChange={e => setFormData({...formData, captainName: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all focus:bg-white" placeholder="Full Name" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Contact Email</label>
                            <div className="relative">
                              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input required type="email" value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all focus:bg-white" placeholder="email@example.com" />
                            </div>
                          </div>
                          <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Contact Phone</label>
                            <div className="relative">
                              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input required type="tel" value={formData.contactPhone} onChange={e => setFormData({...formData, contactPhone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all focus:bg-white" placeholder="+977 9812345678" />
                            </div>
                          </div>
                       </div>
                    </div>

                    {/* Roster */}
                    <div className="flex flex-col gap-6">
                       <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-widest flex items-center gap-3 border-b border-gray-100 pb-4">
                          <Users size={24} className="text-[#FA6400]" /> Roster Entry
                       </h3>
                       <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex justify-between">
                             <span>Player Names</span>
                             <span className="text-[#FA6400]">List your full squad</span>
                          </label>
                          <textarea 
                             required 
                             rows={6} 
                             value={formData.playersText} 
                             onChange={e => setFormData({...formData, playersText: e.target.value})} 
                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-medium focus:ring-2 focus:ring-[#0c0b5d]/20 outline-none transition-all leading-relaxed focus:bg-white resize-y" 
                             placeholder={`Enter player names, one per line:\nPlayer 1 (Captain)\nPlayer 2\nPlayer 3...`} 
                          />
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-1 pl-1">Please list one player per line. The first name should ideally be the captain.</p>
                       </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                       <div className="text-xs font-bold tracking-wide text-slate-400 max-w-md text-left leading-relaxed">
                          By submitting this form, you agree to the tournament rules and confirm that all roster details are accurate.
                       </div>
                       <button 
                         type="submit" 
                         disabled={registerMutation.isPending} 
                         className="w-full md:w-auto px-12 py-5 rounded-2xl bg-[#0c0b5d] text-white font-black uppercase tracking-widest text-sm hover:bg-[#FA6400] transition-colors shadow-xl shadow-[#0c0b5d]/20 disabled:opacity-50 cursor-pointer border border-[#0c0b5d]"
                       >
                         {registerMutation.isPending ? "Submitting..." : "Confirm & Register"}
                       </button>
                    </div>

                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
