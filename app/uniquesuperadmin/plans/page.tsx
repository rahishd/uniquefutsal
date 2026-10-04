"use client";

import { useState } from "react";
import { 
  Plus, Edit2, Trash2, Save, X, Star,
  CheckCircle, AlertCircle, Loader2, Users
} from "lucide-react";
import {
  MembershipPlan,
  MembershipSubscription,
  PricingMatrix,
} from "@/lib/api/membership";
import {
  useAllSubscriptions,
  useCreatePlan,
  useDeletePlan,
  useMembershipPlans,
  useSetFeaturedPlan,
  useUpdatePlan,
} from "@/lib/hooks";

interface PlanFormData {
  name: string;
  description: string;
  price: string;
  
  // 3x3 Grid
  price3DaysMorning: string;
  price3DaysDay: string;
  price3DaysEvening: string;
  price1MonthMorning: string;
  price1MonthDay: string;
  price1MonthEvening: string;
  price3MonthsMorning: string;
  price3MonthsDay: string;
  price3MonthsEvening: string;
  
  // Discounts
  discount3DaysMorning: string;
  discount3DaysDay: string;
  discount3DaysEvening: string;
  discount1MonthMorning: string;
  discount1MonthDay: string;
  discount1MonthEvening: string;
  discount3MonthsMorning: string;
  discount3MonthsDay: string;
  discount3MonthsEvening: string;

  isMatrix: boolean;
  perks: string[];
  featured: boolean;
}

const EMPTY_PLAN: PlanFormData = {
  name: "",
  description: "",
  price: "",
  price3DaysMorning: "",
  price3DaysDay: "",
  price3DaysEvening: "",
  price1MonthMorning: "",
  price1MonthDay: "",
  price1MonthEvening: "",
  price3MonthsMorning: "",
  price3MonthsDay: "",
  price3MonthsEvening: "",
  discount3DaysMorning: "0",
  discount3DaysDay: "0",
  discount3DaysEvening: "0",
  discount1MonthMorning: "0",
  discount1MonthDay: "0",
  discount1MonthEvening: "0",
  discount3MonthsMorning: "0",
  discount3MonthsDay: "0",
  discount3MonthsEvening: "0",
  isMatrix: false,
  perks: [""],
  featured: false,
};

export default function MembershipPlansManager() {
  const plansQuery = useMembershipPlans({ includeInactive: true });
  const subscriptionsQuery = useAllSubscriptions();
  const plans: MembershipPlan[] = plansQuery.data || [];
  const subscriptions: MembershipSubscription[] = subscriptionsQuery.data || [];

  const createPlanMutation = useCreatePlan();
  const updatePlanMutation = useUpdatePlan();
  const deletePlanMutation = useDeletePlan();
  const setFeaturedPlanMutation = useSetFeaturedPlan();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newPlan, setNewPlan] = useState<PlanFormData>(EMPTY_PLAN);
  const [editForm, setEditForm] = useState<PlanFormData & { id: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const loading = plansQuery.isLoading || subscriptionsQuery.isLoading;

  const getActiveSubscriptionCount = (planId: string) => {
    const now = new Date();
    return subscriptions.filter(
      (s) => s.planId === planId && s.status === "active" && new Date(s.endDate) > now
    ).length;
  };

  const handleAddPerk = (target: "new" | "edit") => {
    if (target === "new") setNewPlan({ ...newPlan, perks: [...newPlan.perks, ""] });
    else if (editForm) setEditForm({ ...editForm, perks: [...editForm.perks, ""] });
  };

  const handlePerkChange = (idx: number, val: string, target: "new" | "edit") => {
    if (target === "new") {
      const p = [...newPlan.perks]; p[idx] = val;
      setNewPlan({ ...newPlan, perks: p });
    } else if (editForm) {
      const p = [...editForm.perks]; p[idx] = val;
      setEditForm({ ...editForm, perks: p });
    }
  };

  const removePerk = (idx: number, target: "new" | "edit") => {
    if (target === "new") setNewPlan({ ...newPlan, perks: newPlan.perks.filter((_, i) => i !== idx) });
    else if (editForm) setEditForm({ ...editForm, perks: editForm.perks.filter((_, i) => i !== idx) });
  };

  const handleCreate = async () => {
    if (!newPlan.name || (!newPlan.price && !newPlan.isMatrix)) {
      showToast("Name and base price are required.", "error");
      return;
    }
    
    try {
      setSaving(true);
      await createPlanMutation.mutateAsync({
        name: newPlan.name,
        description: newPlan.description || undefined,
        price: parseInt(newPlan.price.replace(/,/g, "")) || 0,
        perks: newPlan.perks.filter(p => p.trim()),
        featured: newPlan.featured,
        pricingMatrix: newPlan.isMatrix ? JSON.stringify({ version: 2 }) : undefined,
        
        price3DaysMorning: parseInt(newPlan.price3DaysMorning.replace(/,/g, "")) || undefined,
        price3DaysDay: parseInt(newPlan.price3DaysDay.replace(/,/g, "")) || undefined,
        price3DaysEvening: parseInt(newPlan.price3DaysEvening.replace(/,/g, "")) || undefined,
        price1MonthMorning: parseInt(newPlan.price1MonthMorning.replace(/,/g, "")) || undefined,
        price1MonthDay: parseInt(newPlan.price1MonthDay.replace(/,/g, "")) || undefined,
        price1MonthEvening: parseInt(newPlan.price1MonthEvening.replace(/,/g, "")) || undefined,
        price3MonthsMorning: parseInt(newPlan.price3MonthsMorning.replace(/,/g, "")) || undefined,
        price3MonthsDay: parseInt(newPlan.price3MonthsDay.replace(/,/g, "")) || undefined,
        price3MonthsEvening: parseInt(newPlan.price3MonthsEvening.replace(/,/g, "")) || undefined,

        discount3DaysMorning: parseInt(newPlan.discount3DaysMorning) || 0,
        discount3DaysDay: parseInt(newPlan.discount3DaysDay) || 0,
        discount3DaysEvening: parseInt(newPlan.discount3DaysEvening) || 0,
        discount1MonthMorning: parseInt(newPlan.discount1MonthMorning) || 0,
        discount1MonthDay: parseInt(newPlan.discount1MonthDay) || 0,
        discount1MonthEvening: parseInt(newPlan.discount1MonthEvening) || 0,
        discount3MonthsMorning: parseInt(newPlan.discount3MonthsMorning) || 0,
        discount3MonthsDay: parseInt(newPlan.discount3MonthsDay) || 0,
        discount3MonthsEvening: parseInt(newPlan.discount3MonthsEvening) || 0,
      });
      setIsAdding(false);
      setNewPlan(EMPTY_PLAN);
      showToast(`"${newPlan.name}" plan created!`);
    } catch (error) {
      console.error("Failed to create plan:", error);
      showToast("Failed to create plan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (plan: MembershipPlan) => {
    setEditingId(plan.id);
    setEditForm({
      id: plan.id,
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toLocaleString(),
      
      price3DaysMorning: plan.price3DaysMorning?.toLocaleString() || "",
      price3DaysDay: plan.price3DaysDay?.toLocaleString() || "",
      price3DaysEvening: plan.price3DaysEvening?.toLocaleString() || "",
      price1MonthMorning: plan.price1MonthMorning?.toLocaleString() || "",
      price1MonthDay: plan.price1MonthDay?.toLocaleString() || "",
      price1MonthEvening: plan.price1MonthEvening?.toLocaleString() || "",
      price3MonthsMorning: plan.price3MonthsMorning?.toLocaleString() || "",
      price3MonthsDay: plan.price3MonthsDay?.toLocaleString() || "",
      price3MonthsEvening: plan.price3MonthsEvening?.toLocaleString() || "",

      discount3DaysMorning: plan.discount3DaysMorning?.toString() || "0",
      discount3DaysDay: plan.discount3DaysDay?.toString() || "0",
      discount3DaysEvening: plan.discount3DaysEvening?.toString() || "0",
      discount1MonthMorning: plan.discount1MonthMorning?.toString() || "0",
      discount1MonthDay: plan.discount1MonthDay?.toString() || "0",
      discount1MonthEvening: plan.discount1MonthEvening?.toString() || "0",
      discount3MonthsMorning: plan.discount3MonthsMorning?.toString() || "0",
      discount3MonthsDay: plan.discount3MonthsDay?.toString() || "0",
      discount3MonthsEvening: plan.discount3MonthsEvening?.toString() || "0",

      isMatrix: !!plan.pricingMatrix,
      perks: plan.perks.length > 0 ? plan.perks : [""],
      featured: plan.featured,
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;

    try {
      setSaving(true);
      await updatePlanMutation.mutateAsync({
        id: editForm.id,
        data: {
          name: editForm.name,
          description: editForm.description || undefined,
          price: parseInt(editForm.price.replace(/,/g, "")) || 0,
          perks: editForm.perks.filter(k => k.trim()),
          featured: editForm.featured,
          pricingMatrix: editForm.isMatrix ? JSON.stringify({ version: 2 }) : undefined,
          
          price3DaysMorning: parseInt(editForm.price3DaysMorning.replace(/,/g, "")) || undefined,
          price3DaysDay: parseInt(editForm.price3DaysDay.replace(/,/g, "")) || undefined,
          price3DaysEvening: parseInt(editForm.price3DaysEvening.replace(/,/g, "")) || undefined,
          price1MonthMorning: parseInt(editForm.price1MonthMorning.replace(/,/g, "")) || undefined,
          price1MonthDay: parseInt(editForm.price1MonthDay.replace(/,/g, "")) || undefined,
          price1MonthEvening: parseInt(editForm.price1MonthEvening.replace(/,/g, "")) || undefined,
          price3MonthsMorning: parseInt(editForm.price3MonthsMorning.replace(/,/g, "")) || undefined,
          price3MonthsDay: parseInt(editForm.price3MonthsDay.replace(/,/g, "")) || undefined,
          price3MonthsEvening: parseInt(editForm.price3MonthsEvening.replace(/,/g, "")) || undefined,

          discount3DaysMorning: parseInt(editForm.discount3DaysMorning) || 0,
          discount3DaysDay: parseInt(editForm.discount3DaysDay) || 0,
          discount3DaysEvening: parseInt(editForm.discount3DaysEvening) || 0,
          discount1MonthMorning: parseInt(editForm.discount1MonthMorning) || 0,
          discount1MonthDay: parseInt(editForm.discount1MonthDay) || 0,
          discount1MonthEvening: parseInt(editForm.discount1MonthEvening) || 0,
          discount3MonthsMorning: parseInt(editForm.discount3MonthsMorning) || 0,
          discount3MonthsDay: parseInt(editForm.discount3MonthsDay) || 0,
          discount3MonthsEvening: parseInt(editForm.discount3MonthsEvening) || 0,
        },
      });
      setEditingId(null);
      setEditForm(null);
      showToast("Plan updated successfully!");
    } catch (error) {
      console.error("Failed to update plan:", error);
      showToast("Failed to update plan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setSaving(true);
      await deletePlanMutation.mutateAsync(id);
      setDeleteId(null);
      showToast("Plan deleted.");
    } catch (error) {
      console.error("Failed to delete plan:", error);
      showToast("Failed to delete plan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      setSaving(true);
      await setFeaturedPlanMutation.mutateAsync(id);
      showToast("Featured plan updated!");
    } catch (error) {
      console.error("Failed to update featured plan:", error);
      showToast("Failed to update featured plan", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FA6400]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 relative px-4 md:px-0">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl font-black text-xs uppercase tracking-widest text-white ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] p-8 shadow-2xl flex flex-col gap-5 w-full max-w-sm">
            <Trash2 size={32} className="text-red-500" />
            <div>
              <h3 className="text-lg font-black text-[#0c0b5d]">Delete Plan?</h3>
              <p className="text-sm text-slate-500 mt-1">This will remove the plan permanently.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={saving} className="flex-1 bg-slate-100 text-slate-600 font-black uppercase text-[10px] py-3 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={saving} className="flex-1 bg-red-500 text-white font-black uppercase text-[10px] py-3 rounded-2xl hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black italic text-[#0c0b5d] uppercase tracking-tighter">
            Membership <span className="text-[#FA6400]">Plans</span>
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">Configure your membership pricing grid and perks.</p>
        </div>
        <button onClick={() => { setIsAdding(true); setNewPlan(EMPTY_PLAN); }} disabled={isAdding || saving} className="flex items-center gap-2 bg-[#FA6400] text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50">
          <Plus size={18} /> New Plan
        </button>
      </div>

      {/* Add New Plan Form */}
      {isAdding && (
        <div className="bg-white/95 backdrop-blur-md rounded-[32px] border-2 border-dashed border-[#FA6400]/30 p-8 flex flex-col gap-6 relative z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#0c0b5d] uppercase tracking-widest flex items-center gap-2"><Plus size={16} className="text-[#FA6400]" /> New Plan</h2>
            <button onClick={() => setIsAdding(false)} disabled={saving} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"><X size={14} /></button>
          </div>
          <PlanForm plan={newPlan} onChange={(v) => setNewPlan(prev => ({ ...prev, ...v }))} onAddPerk={() => handleAddPerk("new")} onPerkChange={(i, v) => handlePerkChange(i, v, "new")} onRemovePerk={(i) => removePerk(i, "new")} />
          <button onClick={handleCreate} disabled={saving} className="flex items-center justify-center gap-2 bg-[#FA6400] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save size={15} /> Save & Publish</>}
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className={`rounded-[28px] border-2 p-6 flex flex-col gap-5 relative transition-all border-slate-200 bg-slate-50 ${plan.featured ? "shadow-xl ring-2 ring-[#FA6400]/20" : "shadow-sm"} ${!plan.isActive ? "opacity-60" : ""}`}>
            {editingId === plan.id && editForm ? (
               <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#FA6400]">Editing Plan</span>
                  <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                </div>
                <PlanForm plan={editForm} onChange={(v) => setEditForm(prev => prev ? ({ ...prev, ...v }) : null)} onAddPerk={() => handleAddPerk("edit")} onPerkChange={(i, v) => handlePerkChange(i, v, "edit")} onRemovePerk={(i) => removePerk(i, "edit")} />
                <button onClick={handleSaveEdit} disabled={saving} className="w-full bg-[#0c0b5d] text-white py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#FA6400] transition-colors">{saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Update Plan"}</button>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-xl font-black text-[#0c0b5d] uppercase italic tracking-tighter">{plan.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-2">{plan.description}</p>
                  </div>
                  {plan.featured && <Star size={16} className="text-[#FA6400]" fill="#FA6400" />}
                </div>

                <div className="bg-white/60 p-4 rounded-2xl border border-white/80 my-4">
                   {plan.pricingMatrix ? (
                      <div className="grid grid-cols-3 gap-2 text-center">
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-slate-400">3 Days</span>
                            <span className="text-xs font-black text-[#0c0b5d]">Rs. {plan.price3DaysMorning || 0}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-slate-400">1 Mo</span>
                            <span className="text-xs font-black text-[#0c0b5d]">Rs. {plan.price1MonthMorning || 0}</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-slate-400">3 Mo</span>
                            <span className="text-xs font-black text-[#0c0b5d]">Rs. {plan.price3MonthsMorning || 0}</span>
                         </div>
                         <span className="col-span-3 text-[7px] font-bold text-slate-400 mt-2 uppercase">(Morning Base Rates Shown)</span>
                      </div>
                   ) : (
                      <span className="text-2xl font-black text-[#0c0b5d]">Rs. {plan.price.toLocaleString()}<span className="text-xs font-medium text-slate-400"> /mo</span></span>
                   )}
                </div>

                <div className="flex flex-col gap-2 grow">
                   {plan.perks.slice(0, 3).map((perk, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                         <CheckCircle size={10} className="text-[#FA6400]" /> {perk}
                      </div>
                   ))}
                   {plan.perks.length > 3 && <span className="text-[8px] font-black text-[#FA6400]/60">+{plan.perks.length - 3} MORE BENEFITS</span>}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button onClick={() => handleEdit(plan)} className="bg-white text-slate-600 border border-slate-200 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-[#0c0b5d] hover:text-white transition-all shadow-sm">Edit</button>
                  <button onClick={() => setDeleteId(plan.id)} className="bg-white text-red-500 border border-red-100 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanForm({ plan, onChange, onAddPerk, onPerkChange, onRemovePerk }: {
  plan: PlanFormData;
  onChange: (val: Partial<PlanFormData>) => void;
  onAddPerk: () => void;
  onPerkChange: (i: number, v: string) => void;
  onRemovePerk: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 focus-within:relative">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan Name (*)</label>
          <input type="text" value={plan.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Men's Day Package" className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-[#FA6400]/10 outline-none transition-all" />
      </div>

      <div className="flex items-center gap-4 bg-white/60 p-5 rounded-2xl border border-slate-100">
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#0c0b5d]">Matrix Pricing</p>
          <p className="text-[9px] text-slate-500 font-medium">Enable a 3x3 pricing grid (Morning/Day/Evening variations)</p>
        </div>
        <button 
          onClick={() => onChange({ isMatrix: !plan.isMatrix })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${plan.isMatrix ? 'bg-[#FA6400]' : 'bg-slate-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${plan.isMatrix ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {plan.isMatrix ? (
         <div className="flex flex-col gap-4">
            {/* 3 Days/Week Subgrid */}
            <div className="p-5 bg-orange-50/40 rounded-3xl border border-orange-100">
               <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FA6400] mb-4">Base Prices: 3 Days/Week</h4>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Morning</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price3DaysMorning} onChange={(e) => onChange({ price3DaysMorning: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-orange-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount3DaysMorning} onChange={(e) => onChange({ discount3DaysMorning: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-orange-600">% OFF</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Day</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price3DaysDay} onChange={(e) => onChange({ price3DaysDay: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-orange-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount3DaysDay} onChange={(e) => onChange({ discount3DaysDay: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-orange-600">% OFF</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Evening</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price3DaysEvening} onChange={(e) => onChange({ price3DaysEvening: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-orange-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount3DaysEvening} onChange={(e) => onChange({ discount3DaysEvening: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-orange-600">% OFF</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* 1 Month Subgrid */}
            <div className="p-5 bg-blue-50/40 rounded-3xl border border-blue-100">
               <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0c0b5d] mb-4">Base Prices: 1 Month</h4>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Morning</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price1MonthMorning} onChange={(e) => onChange({ price1MonthMorning: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-blue-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount1MonthMorning} onChange={(e) => onChange({ discount1MonthMorning: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-blue-600">% OFF</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Day</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price1MonthDay} onChange={(e) => onChange({ price1MonthDay: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-blue-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount1MonthDay} onChange={(e) => onChange({ discount1MonthDay: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-blue-600">% OFF</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Evening</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price1MonthEvening} onChange={(e) => onChange({ price1MonthEvening: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-blue-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount1MonthEvening} onChange={(e) => onChange({ discount1MonthEvening: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-blue-600">% OFF</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* 3 Months Subgrid */}
            <div className="p-5 bg-indigo-50/40 rounded-3xl border border-indigo-100">
               <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-4">Base Prices: 3 Months</h4>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Morning</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price3MonthsMorning} onChange={(e) => onChange({ price3MonthsMorning: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-indigo-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount3MonthsMorning} onChange={(e) => onChange({ discount3MonthsMorning: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-indigo-600">% OFF</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Day</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price3MonthsDay} onChange={(e) => onChange({ price3MonthsDay: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-indigo-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount3MonthsDay} onChange={(e) => onChange({ discount3MonthsDay: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-indigo-600">% OFF</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 bg-white/50 rounded-2xl">
                     <label className="text-[8px] font-black uppercase text-slate-400">Evening</label>
                     <div className="flex items-center gap-2">
                        <input type="text" value={plan.price3MonthsEvening} onChange={(e) => onChange({ price3MonthsEvening: e.target.value })} placeholder="Price" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold" />
                        <div className="flex items-center bg-indigo-100/50 rounded-xl px-2">
                           <input type="text" value={plan.discount3MonthsEvening} onChange={(e) => onChange({ discount3MonthsEvening: e.target.value })} placeholder="%" className="w-8 bg-transparent text-[10px] font-black py-2.5 text-center" />
                           <span className="text-[10px] font-black text-indigo-600">% OFF</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      ) : (
         <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Standard Price / Month (Rs.) (*)</label>
            <input type="text" value={plan.price} onChange={(e) => onChange({ price: e.target.value })} placeholder="e.g. 5,500" className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-[#FA6400]/10 outline-none transition-all" />
         </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label>
        <textarea value={plan.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Short description..." rows={2} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-[#FA6400]/10 outline-none resize-none transition-all" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perks & Benefits</label>
          <button onClick={onAddPerk} className="flex items-center gap-1 text-[10px] font-black text-[#FA6400] tracking-widest hover:underline"><Plus size={12} /> Add</button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {plan.perks.map((perk, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <input type="text" value={perk} onChange={(e) => onPerkChange(i, e.target.value)} placeholder={`Benefit #${i + 1}`} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-bold" />
              <button onClick={() => onRemovePerk(i)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
         <input type="checkbox" id="featured" checked={plan.featured} onChange={(e) => onChange({ featured: e.target.checked })} className="w-4 h-4 rounded text-[#FA6400] focus:ring-[#FA6400]" />
         <label htmlFor="featured" className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer">Set as Featured Plan</label>
      </div>
    </div>
  );
}
