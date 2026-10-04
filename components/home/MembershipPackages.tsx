"use client";

import { MembershipPlan } from "@/lib/api/membership";
import { useEffect } from "react";
import { useMembershipPlans } from "@/lib/hooks";
import MembershipCard from "./MembershipCard";
import { Loader2 } from "lucide-react";

export default function MembershipPackages({ 
  light = false,
  selectedPlan,
  onSelect,
  compact = false,
  onPlansLoaded,
  enrolledPlanName,
}: { 
  light?: boolean;
  selectedPlan?: string;
  onSelect?: (tier: MembershipPlan) => void;
  compact?: boolean;
  onPlansLoaded?: (plans: MembershipPlan[]) => void;
  enrolledPlanName?: string;
}) {
  const plansQuery = useMembershipPlans();
  const plans = plansQuery.data || [];
  const loading = plansQuery.isLoading || plansQuery.isFetching;
  const error = plansQuery.isError ? "Failed to load membership plans" : null;

  useEffect(() => {
    if (!plansQuery.data) return;
    onPlansLoaded?.(plansQuery.data);
  }, [plansQuery.data, onPlansLoaded]);

  // Convert MembershipPlan to the shape MembershipCard expects
  const toTier = (p: MembershipPlan) => {
    // If it's a matrix plan, find the lowest starting price (usually 3 days/week Morning)
    if (p.pricingMatrix) {
      const minPrice = p.price3DaysMorning || p.price3DaysDay || p.price3DaysEvening || p.price;
      
      return {
        name: p.name,
        price: `Starting from Rs. ${minPrice.toLocaleString()}`,
        numericPrice: minPrice,
        features: p.perks,
        featured: p.featured,
        description: p.description || "",
        isMatrix: true
      };
    }

    return {
      name: p.name,
      price: `Rs. ${p.price.toLocaleString()}`,
      numericPrice: p.price,
      features: p.perks,
      featured: p.featured,
      description: p.description || "",
      isMatrix: false
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${light ? "text-[#0c0b5d]" : "text-white"}`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${light ? "text-slate-500" : "text-white/60"}`}>
        <p>{error}</p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className={`text-center py-12 ${light ? "text-slate-500" : "text-white/60"}`}>
        <p>No membership plans available at the moment.</p>
      </div>
    );
  }

  const content = (
    <div className={`relative z-10 grid grid-cols-1 gap-8 ${compact ? "md:grid-cols-1" : "md:grid-cols-3 md:gap-10"}`}>
      {plans.map((plan) => (
        <MembershipCard 
          key={plan.id} 
          tier={toTier(plan)} 
          light={light} 
          isSelected={selectedPlan === plan.name && !enrolledPlanName}
          isEnrolled={enrolledPlanName === plan.name}
          onSelect={onSelect ? () => onSelect(plan) : undefined}
        />
      ))}
    </div>
  );

  if (compact) return content;

  return (
    <section 
      className={`relative flex flex-col gap-20 border-t px-6 py-28 md:px-20 overflow-hidden transition-colors duration-500 ${
        light ? "bg-white/10 border-gray-100/20" : "bg-[#0d1117] border-white/5"
      }`}
    >
      {/* Dynamic Background Glows */}
      {light ? (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-50/50 blur-[150px] rounded-full pointer-events-none" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-50/40 blur-[100px] rounded-full pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0c0b5d]/10 blur-[150px] rounded-full pointer-events-none" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#FA6400]/5 blur-[100px] rounded-full pointer-events-none" />
        </>
      )}

      {/* Heading Section */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center lg:mb-10">
         <div className={`inline-flex items-center gap-2 rounded-full px-5 py-2 border backdrop-blur-md mb-2 ${
                  light 
                    ? "bg-[#0c0b5d]/5 border-[#0c0b5d]/10 text-[#0c0b5d]" 
                    : "bg-white/10 border-white/20 text-white"
                }`}>
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Join the Elite</span>
              </div>
        <h2 className={`text-6xl md:text-8xl font-black tracking-tighter leading-none ${light ? "text-[#0c0b5d]" : "text-white"}`}>
          Membership <span className="text-[#FA6400]">Plans</span>
        </h2>
        <p className={`max-w-2xl text-lg font-medium leading-relaxed ${light ? "text-slate-500" : "text-white/60"}`}>
          Unlock premium benefits, priority bookings, and exclusive discounts designed for true futsal enthusiasts.
        </p>
      </div>

      {/* Tiers Grid */}
      {content}

      {/* Trust Footer */}
      <div className="relative z-10 mt-12 flex flex-col items-center gap-6 text-center">
        <div className={`h-px w-24 bg-linear-to-r from-transparent to-transparent ${light ? "via-[#0c0b5d]/20" : "via-white/20"}`} />
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-gray-500">
          Cancel or upgrade anytime • 100% Player Satisfaction
        </p>
      </div>
    </section>
  );
}
