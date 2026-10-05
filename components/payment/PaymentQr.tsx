"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, ChevronLeft, Clock, Copy, Download, Loader2 } from "lucide-react";
import { METHOD_LABEL, PAYMENT_POLL_MS, fetchPaymentStatus, isTestQr, testPay, type OnlineMethod } from "@/lib/payment";

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  method: OnlineMethod;
  orderId: string; // the booking / session ID the server is waiting to see paid
  amount: number; // final amount after every promo code (decided by the server)
  remarks: string; // e.g. "Regular game - <booking id>"
  payload: string; // the QR content the server created
  expiresAt: string; // when the QR (and the held slot) runs out
  guestPhone?: string; // a guest has no account: the server checks the order against this number
  onPaid: () => void; // called automatically once the server reports the order as paid
  onBack: () => void;
}

// Shows the QR for the exact amount, then watches for the payment. The customer never has to
// confirm anything: the screen moves on by itself when the server reports "paid".
export default function PaymentQr({ method, orderId, amount, remarks, payload, expiresAt, guestPhone, onPaid, onBack }: Props) {
  const label = METHOD_LABEL[method];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reported = useRef(false);
  const onPaidRef = useRef(onPaid); // always call the latest callback without restarting the polling
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  const [serverExpired, setServerExpired] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    onPaidRef.current = onPaid;
  });

  useEffect(() => {
    const tick = () => setLeft(new Date(expiresAt).getTime() - Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [expiresAt]);

  const expired = left <= 0 || serverExpired;

  // Ask the server whether the order is paid, every few seconds and whenever the customer
  // comes back to this tab (it may have been paused while they were in their payment app).
  useEffect(() => {
    if (expired) return;
    let cancelled = false;
    const check = async () => {
      if (reported.current) return;
      const status = await fetchPaymentStatus(orderId, guestPhone);
      if (cancelled) return;
      if (status === "paid" && !reported.current) {
        reported.current = true;
        onPaidRef.current();
      } else if (status === "expired") {
        setServerExpired(true); // the server released the slot
      }
    };
    const t = setInterval(check, PAYMENT_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [expired, orderId, guestPhone]);

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
            value={payload}
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

      {/* Live status: the customer just waits; no confirmation button */}
      {!expired && (
        <p role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-2xl bg-brand/5 px-4 py-3 text-sm font-medium text-brand">
          <Loader2 size={16} className="animate-spin" /> Waiting for your payment… we&apos;ll confirm it automatically
        </p>
      )}

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
            "That's it. This page detects your payment and confirms automatically.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {isTestQr(payload) && (
        <div className="rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-700">
          <p>
            Test mode: the server is using its test payment gateway, so this QR can&apos;t take a real payment. With the real gateway the server learns about your payment from {label} and this screen updates by itself.
          </p>
          {!expired && (
            <button
              type="button"
              disabled={testBusy}
              onClick={async () => {
                setTestBusy(true);
                try {
                  await testPay(orderId);
                } catch {
                  // not available outside test mode
                }
                setTestBusy(false);
              }}
              className="mt-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Test: simulate payment received
            </button>
          )}
        </div>
      )}

      {expired && (
        <>
          <p className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-500">
            Already paid? You don&apos;t need to do anything. Once the payment reaches us, your order updates automatically.
          </p>
          <button type="button" onClick={onBack} className="glass-btn block w-full rounded-full py-4 text-center text-base font-semibold text-white">
            Start again
          </button>
        </>
      )}
    </div>
  );
}
