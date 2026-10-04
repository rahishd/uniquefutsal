"use client";

import { PAY_METHODS, type PayMethod } from "@/lib/payment";

// eSewa, Fonepay or Pay at venue. Shared by booking and membership.
export default function PaymentMethodPicker({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="text-sm font-medium">Payment method</h2>
      <div role="radiogroup" aria-label="Payment method" className="mt-3 grid grid-cols-3 gap-3">
        {PAY_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={value === m.id}
            onClick={() => onChange(m.id)}
            className={`rounded-2xl px-2 py-3 text-center transition ${value === m.id ? "bg-brand text-white shadow-md" : "bg-white/60"}`}
          >
            <span className="block text-sm font-medium">{m.label}</span>
            <span className={`text-[10px] leading-tight ${value === m.id ? "text-white/70" : "text-slate-400"}`}>{m.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
