"use client";

import { useEffect, useRef, useState } from "react";
import { FaWhatsapp } from "react-icons/fa6";
import { CalendarX2, CreditCard, Crown, HelpCircle, Phone, X, Zap } from "lucide-react";
import { site } from "@/lib/site";

// Floating "urgent help" button on Home. It opens a WhatsApp chat with the venue admin in the
// WhatsApp app. The message is pre-written from the topic the customer picks (no personal data
// is put in the link). A chat INSIDE this app would need the backend; this is the simple, reliable way.
const TOPICS = [
  { label: "Booking problem", icon: CalendarX2, text: "Hello Unique Futsal, I need urgent help with my booking." },
  { label: "Payment issue", icon: CreditCard, text: "Hello Unique Futsal, I need urgent help with a payment." },
  { label: "Change or cancel", icon: Zap, text: "Hello Unique Futsal, I want to change or cancel my booking." },
  { label: "Membership", icon: Crown, text: "Hello Unique Futsal, I have a question about membership." },
  { label: "Something else", icon: HelpCircle, text: "Hello Unique Futsal, I need help." },
];

const link = (text: string) => `${site.whatsapp}?text=${encodeURIComponent(text)}`;

export default function WhatsAppChat() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Need urgent help? Chat with us on WhatsApp"
        aria-haspopup="dialog"
        className="fixed bottom-28 right-4 z-40 desk:bottom-6 desk:right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.5)] transition active:scale-95"
      >
        <FaWhatsapp size={30} />
        <span aria-hidden className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366]/40" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white"><FaWhatsapp size={26} /></span>
                <div>
                  <h2 id="wa-title" className="text-lg font-semibold">Need urgent help?</h2>
                  <p className="text-xs text-slate-500">Chat with the Unique Futsal team on WhatsApp.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18} /></button>
            </div>

            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">What do you need help with?</p>
            <ul className="mt-2 space-y-2">
              {TOPICS.map((t) => {
                const Icon = t.icon;
                return (
                  <li key={t.label}>
                    <a
                      href={link(t.text)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium"
                    >
                      <Icon size={18} className="text-brand" /> {t.label}
                    </a>
                  </li>
                );
              })}
            </ul>

            <a href={`tel:${site.phone}`} className="mt-4 flex items-center justify-center gap-2 rounded-full border border-slate-200 py-3 text-sm font-medium text-brand">
              <Phone size={16} /> Prefer to call? {site.phone}
            </a>
            <p className="mt-3 text-center text-[11px] text-slate-400">Opens WhatsApp on your phone. Your message is pre-filled.</p>
          </div>
        </div>
      )}
    </>
  );
}
