"use client";

import { useState } from "react";
import { 
  Loader2, 
  Image as ImageIcon,
  Expand,
  X,
  Camera,
  Trophy,
  Users,
  Star
} from "lucide-react";
import { getGalleryItems, GalleryItem } from "@/lib/api/gallery";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function GalleryPage() {
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);

  const galleryQuery = useQuery({
    queryKey: ["gallery", "items", { activeOnly: true }] as const,
    queryFn: () => getGalleryItems(true),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const items = galleryQuery.data || [];
  const isLoading = galleryQuery.isLoading;

  const stats = [
    { label: "High-Res Photos", value: "500+", icon: Camera },
    { label: "Past Tournaments", value: "24", icon: Trophy },
    { label: "Community Players", value: "1200+", icon: Users },
    { label: "Review Rating", value: "4.9/5", icon: Star },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white selection:bg-[#FA6400]/30">
      <Navbar />
      
      <main className="pt-32 pb-20 px-4 md:px-8 lg:px-20 max-w-[1600px] mx-auto min-h-[calc(100vh-400px)]">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center gap-6 mb-20 relative">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#0c0b5d]/30 blur-[120px] rounded-full pointer-events-none" />
           
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
           >
              <div className="w-1.5 h-1.5 bg-[#FA6400] rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FA6400]">Visual Journey</span>
           </motion.div>
           
           <motion.h1 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter"
           >
             The <span className="text-transparent bg-clip-text bg-linear-to-r from-[#FA6400] to-orange-400">Unique</span> Moments
           </motion.h1>
           
           <motion.p
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
             className="text-slate-400 font-medium max-w-2xl text-base md:text-lg leading-relaxed"
           >
             Experience the energy, passion, and excitement of every match played at Unique Futsal. 
             Explore our gallery of events, tournaments, and community highlights.
           </motion.p>

           {/* Stats Row */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-12 mt-8">
              {stats.map((stat, idx) => (
                <motion.div 
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + (idx * 0.1) }}
                  className="flex flex-col items-center gap-1"
                >
                   <span className="text-2xl font-black italic text-white flex items-center gap-2">
                      <stat.icon size={18} className="text-[#FA6400]" />
                      {stat.value}
                   </span>
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                </motion.div>
              ))}
           </div>
        </div>

        {/* Gallery Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
             <div className="relative">
                <div className="w-16 h-16 border-4 border-white/5 border-t-[#FA6400] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <ImageIcon size={20} className="text-white/20" />
                </div>
             </div>
             <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Curating Memories...</p>
          </div>
        ) : items.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 gap-6 bg-white/5 rounded-[40px] border border-white/10"
          >
             <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center text-white/10">
                <ImageIcon size={40} />
             </div>
             <div className="flex flex-col items-center text-center gap-2">
                <h3 className="text-xl font-bold uppercase tracking-tight">No Photos Shared Yet</h3>
                <p className="text-slate-400 text-sm max-w-xs px-4">Our photographers are working hard to capture the latest highlights. Please check back soon!</p>
             </div>
          </motion.div>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative group rounded-[32px] overflow-hidden border border-white/10 bg-white/5 cursor-pointer"
                onClick={() => setSelectedImage(item)}
              >
                <img 
                  src={item.image} 
                  alt={item.title || "Gallery"} 
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8">
                   <div className="flex flex-col gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                      <div className="flex items-center gap-2">
                         <div className="px-3 py-1 rounded-full bg-[#FA6400] text-[8px] font-black uppercase tracking-[0.2em]">Shot</div>
                         <span className="text-[10px] text-white/60 font-medium">#{idx + 1} View</span>
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight italic">
                        {item.title || "Match Moment"}
                      </h3>
                      {item.description && (
                        <p className="text-[10px] text-slate-300 font-medium line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-4">
                         <button className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-white hover:bg-[#FA6400] transition-colors border border-white/10">
                            <Expand size={18} />
                         </button>
                      </div>
                   </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-12 overflow-hidden">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/95 backdrop-blur-xl"
               onClick={() => setSelectedImage(null)}
             />
             
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="relative max-w-6xl w-full h-full flex flex-col items-center justify-center gap-6"
             >
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-0 right-0 md:-top-12 md:-right-12 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all backdrop-blur-md"
                >
                   <X size={24} />
                </button>
                
                <div className="w-full h-full max-h-[80vh] flex items-center justify-center rounded-[40px] overflow-hidden border border-white/10 bg-black shadow-2xl">
                   <img 
                     src={selectedImage.image} 
                     alt={selectedImage.title || "Gallery"} 
                     className="max-w-full max-h-full object-contain"
                   />
                </div>
                
                <div className="flex flex-col items-center text-center gap-2 max-w-2xl px-4">
                   <h2 className="text-2xl font-black italic uppercase tracking-tight">
                     {selectedImage.title || "Unique Futsal Moment"}
                   </h2>
                   <p className="text-slate-400 font-medium text-sm leading-relaxed">
                     {selectedImage.description || "Every shot tells a story of victory, teamwork, and pure futsal spirit."}
                   </p>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
