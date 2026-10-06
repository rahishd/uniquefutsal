"use client";

import { useState } from "react";
import { QrCode } from "lucide-react";
import { useSession } from "@/lib/session";
import DigitalIdSheet from "@/components/digitalid/DigitalIdSheet";

// Small QR button (next to "Hello" on Home) or a full row (Profile) that opens the customer's Digital ID card. Registered customers only.
export default function DigitalIdButton({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  if (!session?.registered) return null;
  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="My Digital ID" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-brand shadow-sm">
          <QrCode size={18} />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="glass flex w-full items-center gap-3 rounded-3xl p-4 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><QrCode size={22} /></span>
          <span>
            <span className="block text-sm font-semibold">My Digital ID</span>
            <span className="block text-xs text-slate-500">Your QR card. Show it at the venue, download it or send it on WhatsApp.</span>
          </span>
        </button>
      )}
      {open && <DigitalIdSheet onClose={() => setOpen(false)} />}
    </>
  );
}
