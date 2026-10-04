"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, ChevronLeft, Clock, Copy, Download } from "lucide-react";
import { METHOD_LABEL, QR_HOLD_MS, demoQrPayload, type OnlineMethod } from "@/lib/payment";

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  method: OnlineMethod;
  amount: number; // final amount after every promo code
  remarks: string; // e.g. "Regular game - UF-20261006-31166"
  heldAt: number; // when the QR was created (epoch ms)
  onPaid: (transactionRef?: string) => void;
  onBack: () => void;
}

// Shows the QR for the exact amount and tells the customer how to pay with it.
export default function PaymentQr({ method, amount, remarks, heldAt, onPaid, onBack }: Props) {
  const label = METHOD_LABEL[method];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [left, setLeft] = useState(QR_HOLD_MS);
  const [copied, setCopied] = useState(false);
  const [txn, setTxn] = useState("");

  useEffect(() => {
    const tick = () => setLeft(heldAt + QR_HOLD_MS - Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [heldAt]);

  const expired = left <= 0;

  function save() {
    const url = canvasRef.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `unique-futsal-${method}-qr.png`;
    a.click();
  }

  async function copyRemarks() {
    try {
      await navigator.clipboard.writeText(remarks);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the remarks are visible to type in
    }
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-brand">
        <ChevronLeft size={18} /> Change payment method
      </button>

      <header>
        <h1 className="text-2xl font-semibold">Pay with {label}</h1>
        <p className="text-sm text-slate-500">Scan or upload this QR in your payment app.</p>
      </header>

      <section className="glass rounded-3xl p-5 text-center">
        <p className="text-xs text-slate-400">Amount to pay</p>
        <p className="text-3xl font-semibold">{rs(amount)}</p>

        <div className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3 shadow-inner ring-1 ring-slate-100" style={expired ? { opacity: 0.25 } : undefined}>
          <QRCodeCanvas
            ref={canvasRef}
            value={demoQrPayload({ method, amount, remarks })}
            size={216}
            level="M"
            marginSize={2}
            role="img"
            aria-label={`${label} payment QR for ${rs(amount)}`}
          />
        </div>

        <p className={`mt-3 flex items-center justify-center gap-1.5 text-sm font-medium ${expired ? "text-rose-500" : left < 60000 ? "text-orange-500" : "text-slate-500"}`} role="timer" aria-live="off">
          <Clock size={15} /> {expired ? "This QR has expired" : `Valid for ${mmss(left)}`}
        </p>

        {!expired && (
          <button type="button" onClick={save} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-5 py-2.5 text-sm font-medium text-brand">
            <Download size={16} /> Save QR image
          </button>
        )}
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-medium">Payment remarks (filled in for you)</h2>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3">
          <span className="min-w-0 break-words text-sm font-medium">{remarks}</span>
          <button type="button" onClick={copyRemarks} className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand" aria-label="Copy remarks">
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">These remarks link your payment to this order. Please don&apos;t change them.</p>
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="text-sm font-medium">How to pay</h2>
        <ol className="mt-3 space-y-3 text-sm text-slate-600">
          {[
            "Take a screenshot of this QR, or tap Save QR image.",
            `Open your payment app (${label} or any app that scans QR) and choose Scan QR, then upload the screenshot from your gallery.`,
            "Check the amount and remarks match, then complete the payment.",
            "Come back here and tap “I've paid”.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-700">
        Demo mode: this QR is a placeholder and can&apos;t take a real payment. The real {label} QR is created by your server with your merchant account.
      </p>

      {expired ? (
        <button type="button" onClick={onBack} className="glass-btn block w-full rounded-full py-4 text-center text-base font-semibold text-white">
          Start again
        </button>
      ) : (
        <>
          <div>
            <label htmlFor="txn" className="text-xs text-slate-500">Transaction ID from your payment app (optional, speeds up confirmation)</label>
            <input
              id="txn"
              value={txn}
              onChange={(e) => setTxn(e.target.value.slice(0, 40))}
              placeholder="e.g. 0AB12CD"
              className="mt-1 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm outline-none ring-1 ring-white/80 focus:ring-brand"
            />
          </div>
          <button type="button" onClick={() => onPaid(txn.trim() || undefined)} className="glass-btn flex w-full items-center justify-center rounded-full py-4 text-base font-semibold text-white">
            I&apos;ve paid
          </button>
          <p className="text-center text-xs text-slate-400">We confirm the payment on our side. Tapping this doesn&apos;t mark it as paid.</p>
        </>
      )}
    </div>
  );
}
