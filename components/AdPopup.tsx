"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Megaphone } from "lucide-react";
import { getActiveAds, Ad } from "@/lib/api/ads";
import { motion, AnimatePresence } from "framer-motion";

export default function AdPopup() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);

  useEffect(() => {
    const checkAndShowAd = async () => {
      // Check if ad was already shown in this session
      const sessShown = sessionStorage.getItem("uf_ad_shown");
      if (sessShown) return;

      try {
        const activeAds = await getActiveAds();
        if (activeAds && activeAds.length > 0) {
          // Pick a random ad
          const randomIndex = Math.floor(Math.random() * activeAds.length);
          setAd(activeAds[randomIndex]);
          
          // Show after a short delay for better impact
          setTimeout(() => {
            setIsOpen(true);
            sessionStorage.setItem("uf_ad_shown", "true");
          }, 2000);
        }
      } catch (err) {
        console.error("Failed to fetch ads for popup:", err);
      }
    };

    checkAndShowAd();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setHasDismissed(true), 500); // Fully remove after animation
  };

  if (hasDismissed || !ad) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 md:p-10">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0c0b5d]/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Ad Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-[48px] shadow-2xl overflow-hidden group"
          >
            {/* Close Button */}
            <button 
              onClick={handleClose}
              className="absolute top-6 right-6 z-50 w-10 h-10 bg-black/10 hover:bg-black/20 text-white backdrop-blur-md rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            >
              <X size={20} />
            </button>

            {/* Ad Content */}
            <div className="relative aspect-[4/5] w-full">
              {ad.link ? (
                <a 
                  href={ad.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full h-full relative"
                >
                  <img src={ad.image} alt="Advertisement" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-10">
                    <div className="bg-white text-[#0c0b5d] px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-xl">
                      Learn More <ExternalLink size={12} />
                    </div>
                  </div>
                </a>
              ) : (
                <img src={ad.image} alt="Advertisement" className="w-full h-full object-cover" />
              )}
            </div>

            {/* Subtle Branding */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-30">
               <Megaphone size={10} className="text-white" />
               <span className="text-white text-[8px] font-black uppercase tracking-[0.2em]">Promotion</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
