"use client";

import { useState } from "react";
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Loader2, 
  Link as LinkIcon, 
  Eye, 
  EyeOff, 
  Image as ImageIcon,
  ExternalLink,
  X,
  Save,
  AlertCircle
} from "lucide-react";
import { getAds, createAd, updateAd, deleteAd, Ad } from "@/lib/api/ads";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function AdsManagement() {
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adToDelete, setAdToDelete] = useState<string | null>(null);
  
  // Form state
  const [newAdImage, setNewAdImage] = useState<string>("");
  const [newAdLink, setNewAdLink] = useState<string>("");
  const [newAdIsActive, setNewAdIsActive] = useState(true);

  const queryClient = useQueryClient();
  const adsQuery = useQuery({
    queryKey: ["ads", "list"] as const,
    queryFn: () => getAds(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: true,
  });

  const createAdMutation = useMutation({
    mutationFn: createAd,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ads"] }),
  });
  const updateAdMutation = useMutation({
    mutationFn: (params: {
      id: string;
      updates: Partial<{ image: string; link: string; isActive: boolean }>;
    }) => updateAd(params.id, params.updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ads"] }),
  });
  const deleteAdMutation = useMutation({
    mutationFn: deleteAd,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ads"] }),
  });

  const ads: Ad[] = adsQuery.data || [];
  const isLoading = adsQuery.isLoading;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewAdImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAd = async () => {
    if (!newAdImage) {
      toast.error("Please upload an advertisement image");
      return;
    }

    try {
      setIsSubmitLoading(true);
      await createAdMutation.mutateAsync({
        image: newAdImage,
        link: newAdLink || undefined,
        isActive: newAdIsActive
      });
      
      toast.success("Advertisement created successfully!");
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error creating ad:", err);
      toast.error("Failed to create advertisement");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleToggleActive = async (ad: Ad) => {
    try {
      await updateAdMutation.mutateAsync({
        id: ad.id,
        updates: { isActive: !ad.isActive },
      });
      toast.success(`Ad ${!ad.isActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      console.error("Error toggling ad status:", err);
      toast.error("Failed to update ad status");
    }
  };

  const handleDeleteAd = (id: string) => {
    setAdToDelete(id);
  };

  const confirmDelete = async () => {
    if (!adToDelete) return;
    try {
      await deleteAdMutation.mutateAsync(adToDelete);
      toast.success("Advertisement deleted");
    } catch (err) {
      console.error("Error deleting ad:", err);
      toast.error("Failed to delete advertisement");
    } finally {
      setAdToDelete(null);
    }
  };

  const resetForm = () => {
    setNewAdImage("");
    setNewAdLink("");
    setNewAdIsActive(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#0c0b5d] animate-spin" />
          <p className="text-slate-500 font-medium">Loading advertisements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Ads <span className="text-[#FA6400]">Panel</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Manage popup advertisements that players see when visiting the homepage.
          </p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#0c0b5d] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all cursor-pointer"
        >
          <Plus size={16} />
          Create New Ad
        </button>
      </div>

      {/* Ads Grid */}
      {ads.length === 0 ? (
        <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-100 p-20 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200">
            <Megaphone size={40} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-black text-[#0c0b5d] uppercase tracking-wide">No Advertisements Found</h3>
            <p className="text-slate-400 text-xs font-medium max-w-xs">
              Click the button above to create your first popup advertisement.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ads.map((ad) => (
            <motion.div
              layout
              key={ad.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col group relative"
            >
              {/* Status Badge */}
              <div className="absolute top-4 right-4 z-10">
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${
                  ad.isActive ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
                }`}>
                  {ad.isActive ? "Active" : "Inactive"}
                </div>
              </div>

              {/* Image Container */}
              <div className="aspect-4/5 relative bg-slate-50 overflow-hidden">
                <img 
                  src={ad.image} 
                  alt="Advertisement" 
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${!ad.isActive && 'grayscale opacity-60'}`}
                />
                
                {/* Hover Actions */}
                <div className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                  <button 
                    onClick={() => handleToggleActive(ad)}
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#0c0b5d] hover:bg-[#FA6400] hover:text-white transition-all shadow-xl"
                    title={ad.isActive ? "Deactivate" : "Activate"}
                  >
                    {ad.isActive ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  <button 
                    onClick={() => handleDeleteAd(ad.id)}
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl"
                    title="Delete"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Info Area */}
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Link</span>
                  {ad.link ? (
                    <a 
                      href={ad.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#0c0b5d] flex items-center gap-1 hover:text-[#FA6400] transition-colors truncate"
                    >
                      {ad.link} <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="text-xs font-bold text-slate-300 italic">No link provided</span>
                  )}
                </div>
                
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    Added {new Date(ad.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                     <Megaphone size={14} className="text-slate-200" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0c0b5d]/40 backdrop-blur-md"
              onClick={() => !isSubmitLoading && setIsModalOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl max-h-full bg-white rounded-[40px] shadow-2xl overflow-y-auto"
            >
              <div className="p-8 md:p-10 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0c0b5d]">
                      <Megaphone size={24} />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black text-[#0c0b5d] uppercase tracking-wide">New Advertisement</h2>
                      <p className="text-xs font-bold text-slate-400">Capture your players&apos; attention</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors"
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Image Upload */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ad Creative (Image)</label>
                    {newAdImage ? (
                      <div className="relative aspect-video rounded-[32px] overflow-hidden group">
                        <img src={newAdImage} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            onClick={() => setNewAdImage("")}
                            className="bg-white text-red-500 p-3 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Remove Image
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="aspect-video rounded-[32px] border-2 border-dashed border-slate-100 bg-slate-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors">
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm">
                          <ImageIcon size={28} />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-black text-[#0c0b5d] uppercase tracking-wide">Upload Creative</span>
                          <span className="text-[10px] font-medium text-slate-400">JPG, PNG up to 2MB</span>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Target Link */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Target Link (Optional)</label>
                    <div className="relative">
                      <input
                        type="url"
                        value={newAdLink}
                        onChange={(e) => setNewAdLink(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/5 outline-none transition-all pl-12"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <LinkIcon size={18} />
                      </div>
                    </div>
                    <p className="text-[9px] font-medium text-slate-400 mt-1 px-1 italic flex items-center gap-1">
                      <AlertCircle size={10} /> Clicking the ad will take users to this URL.
                    </p>
                  </div>

                  {/* Settings */}
                  <div className="flex items-center gap-6 pt-2">
                     <button 
                       onClick={() => setNewAdIsActive(!newAdIsActive)}
                       className="flex items-center gap-3 group"
                     >
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${newAdIsActive ? "bg-green-500" : "bg-slate-200"}`}>
                           <div className={`w-4 h-4 bg-white rounded-full transition-transform ${newAdIsActive ? "translate-x-6" : "translate-x-0"}`} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-[#0c0b5d]">Start Immediately</span>
                     </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    disabled={isSubmitLoading}
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isSubmitLoading || !newAdImage}
                    onClick={handleCreateAd}
                    className="flex-2 flex items-center justify-center gap-2 bg-[#0c0b5d] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isSubmitLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Finalize Advertisement
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {adToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0c0b5d]/40 backdrop-blur-md"
              onClick={() => setAdToDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[32px] p-8 max-w-sm w-full flex flex-col gap-5 text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-[20px] flex items-center justify-center mx-auto">
                <Trash2 size={28} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-black text-[#0c0b5d] uppercase tracking-wide">Delete Advertisement?</h3>
                <p className="text-slate-500 text-sm font-medium">This action cannot be undone. The ad will be permanently removed.</p>
              </div>
              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => setAdToDelete(null)} 
                  className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-[20px] font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete} 
                  className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-[20px] font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
