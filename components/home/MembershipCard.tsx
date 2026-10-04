"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface MembershipCardProps {
  tier: {
    name: string;
    price: string;
    features: string[];
    featured: boolean;
  };
  light?: boolean;
  isSelected?: boolean;
  isEnrolled?: boolean;
  onSelect?: () => void;
}

export default function MembershipCard({ 
  tier, 
  light = false, 
  isSelected = false,
  isEnrolled = false,
  onSelect 
}: MembershipCardProps) {
  const router = useRouter();

  const handleSelect = () => {
    if (onSelect) {
      onSelect();
    } else {
      router.push(`/membership?plan=${tier.name}`);
    }
  };

  return (
    <div 
      className={`relative flex flex-col gap-8 rounded-[28px] border p-8 transition-all duration-500 group overflow-hidden ${
        isEnrolled
          ? "border-green-500 shadow-[0_40px_80px_-20px_rgba(34,197,94,0.2)] ring-2 ring-green-500/30 scale-[1.02]"
          : isSelected
          ? "border-[#FA6400] shadow-[0_40px_80px_-20px_rgba(250,100,0,0.2)] ring-2 ring-[#FA6400]/30 scale-[1.02]"
          : tier.featured 
            ? light
              ? "md:scale-105 border-[#0c0b5d] shadow-[0_40px_80px_-20px_rgba(12,11,93,0.15)] ring-1 ring-[#0c0b5d]/30"
              : "md:scale-105 border-[#0c0b5d] shadow-[0_40px_80px_-20px_rgba(12,11,93,0.4)] ring-1 ring-[#0c0b5d]/30" 
            : light
              ? "border-gray-100 bg-white hover:border-[#0c0b5d]/30 hover:bg-gray-50/50"
              : "border-white/5 bg-[#161B22]/40 hover:border-[#0c0b5d]/30 hover:bg-[#161B22]/60"
      }`}
      style={{ 
        background: isEnrolled
          ? light ? "rgba(255, 255, 255, 1)" : "rgba(5, 4, 38, 0.9)"
          : isSelected
          ? light ? "rgba(255, 255, 255, 1)" : "rgba(5, 4, 38, 0.9)"
          : tier.featured 
            ? light ? "rgba(255, 255, 255, 0.95)" : "rgba(5, 4, 38, 0.8)" 
            : undefined, 
        zIndex: (isSelected || isEnrolled) ? 2 : tier.featured ? 1 : 0
      }}
    >
      {/* Glossy Backdrop for Featured/Selected */}
      {(tier.featured || isSelected) && !light && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c0b5d]/10 via-transparent to-[#FA6400]/5 pointer-events-none" />
      )}
      {(tier.featured || isSelected || isEnrolled) && light && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-orange-50/30 pointer-events-none" />
      )}

      {(tier.featured || isSelected || isEnrolled) && (
        <div 
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-5 py-1.5 whitespace-nowrap shadow-xl z-10"
          style={{ background: isEnrolled ? "#22c55e" : isSelected ? "#FA6400" : "linear-gradient(135deg, #0c0b5d 0%, #FA6400 100%)" }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
            {isEnrolled ? "Membership Enrolled" : isSelected ? "Selected Plan" : "Most Popular"}
          </span>
        </div>
      )}

      <div className="relative z-10">
        <h3 className={`text-2xl font-black uppercase tracking-tight ${light ? "text-[#0c0b5d]" : "text-white"}`}>{tier.name}</h3>
        <div className="flex items-baseline gap-1 mt-3">
          <span className={`text-3xl font-black ${light ? "text-[#0c0b5d]" : "text-white"}`}>{tier.price}</span>
          <span className={`text-sm font-medium ${light ? "text-slate-400" : "text-[#94A3B8]"}`}>/period</span>
        </div>
      </div>

      <ul className="relative z-10 flex flex-1 flex-col gap-5">
        {tier.features.map((feature, fIndex) => (
          <li key={fIndex} className="flex items-start gap-3 group/item">
            <div 
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform group-hover/item:scale-110 shadow-[0_0_10px_rgba(250,100,0,0.2)]"
              style={{ background: "#FA6400" }}
            >
              <Check size={12} className="text-white font-black" />
            </div>

            <span className={`text-[15px] font-medium transition-colors ${
              light 
                ? "text-slate-600 group-hover/item:text-[#0c0b5d]" 
                : "text-[#CBD5E1] group-hover/item:text-white"
            }`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="relative z-10 pt-4">
        <button
          onClick={handleSelect}
          className={`w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-xl cursor-pointer ${
            isEnrolled
              ? "bg-green-500 text-white border-none shadow-[0_15px_30px_-5px_rgba(34,197,94,0.3)] hover:scale-100 cursor-default"
              : isSelected
              ? "bg-[#FA6400] text-white border-none shadow-[0_15px_30px_-5px_rgba(250,100,0,0.3)]"
              : tier.featured 
                ? light 
                  ? "bg-[#0c0b5d] text-white border-none shadow-[0_15px_30px_-5px_rgba(12,11,93,0.15)] hover:bg-[#FA6400]" 
                  : "bg-white text-[#0c0b5d] border-none shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] hover:bg-[#FA6400] hover:text-white"
                : light
                  ? "bg-[#0c0b5d] text-white border-none shadow-[0_15px_30px_-5px_rgba(12,11,93,0.15)] hover:bg-[#FA6400]"
                  : "bg-white/5 text-white border border-white/10 hover:bg-white hover:text-[#0c0b5d] shadow-none hover:shadow-lg"
          }`}
          disabled={isEnrolled}
        >
          {isEnrolled ? "Enrolled" : isSelected ? "Selected" : tier.name === "Elite" ? "Join Elite" : tier.name === "Legend" ? "Go Legend" : "Select Plan"}
        </button>
      </div>

      {/* Hover Light Effect */}
      {!light && (
        <div className="absolute -inset-full bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      )}
    </div>
  );
}
