"use client";

import { useState } from "react";
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Loader2, 
  Eye, 
  EyeOff, 
  X,
  Save,
  Grid3X3,
  Type,
  AlignLeft
} from "lucide-react";
import { getGalleryItems, createGalleryItem, updateGalleryItem, deleteGalleryItem, GalleryItem } from "@/lib/api/gallery";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function GalleryManagement() {
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [newImage, setNewImage] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");
  const [newIsActive, setNewIsActive] = useState(true);

  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: ["gallery", "items", { activeOnly: false }] as const,
    queryFn: () => getGalleryItems(false),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: true,
  });

  const createItemMutation = useMutation({
    mutationFn: createGalleryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gallery"] }),
  });
  const updateItemMutation = useMutation({
    mutationFn: (params: {
      id: string;
      updates: Partial<{ image: string; title: string; description: string; isActive: boolean }>;
    }) => updateGalleryItem(params.id, params.updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gallery"] }),
  });
  const deleteItemMutation = useMutation({
    mutationFn: deleteGalleryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gallery"] }),
  });

  const items: GalleryItem[] = itemsQuery.data || [];
  const isLoading = itemsQuery.isLoading;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateItem = async () => {
    if (!newImage) {
      toast.error("Please upload an image");
      return;
    }

    try {
      setIsSubmitLoading(true);
      await createItemMutation.mutateAsync({
        image: newImage,
        title: newTitle || undefined,
        description: newDescription || undefined,
        isActive: newIsActive
      });
      
      toast.success("Gallery item added successfully!");
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Error creating gallery item:", err);
      toast.error("Failed to add gallery item");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleToggleActive = async (item: GalleryItem) => {
    try {
      await updateItemMutation.mutateAsync({
        id: item.id,
        updates: { isActive: !item.isActive },
      });
      toast.success(`Item ${!item.isActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      console.error("Error toggling item status:", err);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this photo from the gallery?")) return;

    try {
      await deleteItemMutation.mutateAsync(id);
      toast.success("Photo deleted from gallery");
    } catch (err) {
      console.error("Error deleting gallery item:", err);
      toast.error("Failed to delete photo");
    }
  };

  const resetForm = () => {
    setNewImage("");
    setNewTitle("");
    setNewDescription("");
    setNewIsActive(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#0c0b5d] animate-spin" />
          <p className="text-slate-500 font-medium">Loading gallery...</p>
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
            Gallery <span className="text-[#FA6400]">Manager</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Upload and manage photos of events or futsal related activities.
          </p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#0c0b5d] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all cursor-pointer"
        >
          <Plus size={16} />
          Add To Gallery
        </button>
      </div>

      {/* Gallery Grid */}
      {items.length === 0 ? (
        <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-100 p-20 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200">
            <Grid3X3 size={40} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-black text-[#0c0b5d] uppercase tracking-wide">No Photos Found</h3>
            <p className="text-slate-400 text-xs font-medium max-w-xs">
              Click the button above to add your first photo to the gallery.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col group relative"
            >
              {/* Status Badge */}
              <div className="absolute top-4 right-4 z-10">
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${
                  item.isActive ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
                }`}>
                  {item.isActive ? "Visible" : "Hidden"}
                </div>
              </div>

              {/* Image Container */}
              <div className="aspect-square relative bg-slate-50 overflow-hidden">
                <img 
                  src={item.image} 
                  alt={item.title || "Gallery"} 
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${!item.isActive && 'grayscale opacity-60'}`}
                />
                
                {/* Hover Actions */}
                <div className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                  <button 
                    onClick={() => handleToggleActive(item)}
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#0c0b5d] hover:bg-[#FA6400] hover:text-white transition-all shadow-xl"
                    title={item.isActive ? "Hide" : "Show"}
                  >
                    {item.isActive ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                  <button 
                    onClick={() => handleDeleteItem(item.id)}
                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl"
                    title="Delete"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Info Area */}
              <div className="p-6 flex flex-col gap-2">
                <h4 className="text-sm font-black text-[#0c0b5d] uppercase tracking-tight truncate">
                  {item.title || "Untitled Photo"}
                </h4>
                {item.description && (
                  <p className="text-[10px] font-medium text-slate-400 line-clamp-2">
                    {item.description}
                  </p>
                )}
                
                <div className="pt-3 mt-1 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    Added {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2 text-slate-200">
                     <ImageIcon size={14} />
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
                      <ImageIcon size={24} />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black text-[#0c0b5d] uppercase tracking-wide">Add To Gallery</h2>
                      <p className="text-xs font-bold text-slate-400">Share futsal moments</p>
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Photo</label>
                    {newImage ? (
                      <div className="relative aspect-video rounded-[32px] overflow-hidden group">
                        <img src={newImage} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            onClick={() => setNewImage("")}
                            className="bg-white text-red-500 p-3 rounded-2xl font-black uppercase tracking-widest text-[9px] flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Change Photo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="aspect-video rounded-[32px] border-2 border-dashed border-slate-100 bg-slate-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors">
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm">
                          <Plus size={28} />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-black text-[#0c0b5d] uppercase tracking-wide">Upload Photo</span>
                          <span className="text-[10px] font-medium text-slate-400">JPG, PNG up to 5MB</span>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Title (Optional)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="E.g. Sunday Match Highlights"
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/5 outline-none transition-all pl-12"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <Type size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description (Optional)</label>
                    <div className="relative">
                      <textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Tell players more about this photo..."
                        rows={3}
                        className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#0c0b5d] focus:ring-2 focus:ring-[#0c0b5d]/5 outline-none transition-all pl-12 resize-none"
                      />
                      <div className="absolute left-4 top-6 text-slate-300">
                        <AlignLeft size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="flex items-center gap-6 pt-2">
                     <button 
                       onClick={() => setNewIsActive(!newIsActive)}
                       className="flex items-center gap-3 group"
                     >
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${newIsActive ? "bg-green-500" : "bg-slate-200"}`}>
                           <div className={`w-4 h-4 bg-white rounded-full transition-transform ${newIsActive ? "translate-x-6" : "translate-x-0"}`} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-[#0c0b5d]">Visible to Clients</span>
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
                    disabled={isSubmitLoading || !newImage}
                    onClick={handleCreateItem}
                    className="flex-2 flex items-center justify-center gap-2 bg-[#0c0b5d] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {isSubmitLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Add To Gallery
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
