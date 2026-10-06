"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { errorText } from "@/lib/api";
import { loadDigitalId, replaceDigitalId, type DigitalId } from "@/lib/digitalid";
import { cardToBlob, drawIdCard } from "@/lib/idcard";

// The customer's portrait Digital ID card: view, download, share (WhatsApp) and replace.
export default function DigitalIdSheet({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState<DigitalId | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    loadDigitalId().then((d) => alive && setId(d)).catch((e) => alive && setError(errorText(e)));
    return () => { alive = false; };
  }, []);

  // draw the card picture whenever the ID changes
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let url: string | null = null;
    const canvas = document.createElement("canvas");
    drawIdCard(canvas, id)
      .then(() => cardToBlob(canvas))
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        setBlob(b);
        setImage(url);
      })
      .catch(() => alive && setError("Could not draw your card. Please try again."));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const file = blob && id ? new File([blob], `unique-futsal-id-${id.phone}.png`, { type: "image/png" }) : null;

  function download() {
    if (!file) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  async function share() {
    if (!file || !id) return;
    setNote(null);
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: "My Unique Futsal Digital ID" });
      } else {
        download();
        window.open(`https://wa.me/?text=${encodeURIComponent("My Unique Futsal Digital ID (attach the downloaded picture)")}`, "_blank", "noopener");
        setNote("The card was saved. Attach it in the WhatsApp chat that opened.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("Could not share. Use Download instead.");
    }
  }

  async function replace() {
    if (!window.confirm("Make a new QR? Your old card will stop working and any copy you sent will no longer be accepted.")) return;
    setBusy(true);
    setError(null);
    try {
      setImage(null);
      setId(await replaceDigitalId());
      setNote("New QR made. Download or share the new card.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="My Digital ID" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-[#f4f6fb] p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Digital ID</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/70 p-2"><X size={18} /></button>
        </div>

        {error && <p role="alert" className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`Digital ID card of ${id?.name}`} className="mx-auto w-64 rounded-3xl shadow-lg" />
        ) : !error ? (
          <div className="mx-auto flex h-96 w-64 items-center justify-center rounded-3xl bg-white/60"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : null}

        <p className="mt-3 text-center text-xs text-slate-500">Show this QR at the venue. It only works inside Unique Futsal: other apps cannot read your details from it.</p>

        {image && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={download} className="flex items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-medium"><Download size={16} /> Download</button>
            <button type="button" onClick={share} className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3 text-sm font-medium text-white"><MessageCircle size={16} /> WhatsApp</button>
          </div>
        )}
        {note && <p role="status" className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-600">{note}</p>}
        {id && <button type="button" onClick={replace} disabled={busy} className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 disabled:opacity-50"><RefreshCw size={13} /> Lost it or shared it by mistake? Make a new QR</button>}
      </div>
    </div>
  );
}
