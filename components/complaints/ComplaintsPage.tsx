"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, MessageSquareWarning, UserRound, X } from "lucide-react";
import { openSignIn, useSession } from "@/lib/session";
import { errorText } from "@/lib/api";
import { markReadByTypes } from "@/lib/notifications";
import { FALLBACK_RULES, STATUS_TEXT, loadMine, loadRules, photoUrl, sendComplaint, shrinkPhoto, type Complaint, type ComplaintRules } from "@/lib/complaints";

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ComplaintsPage() {
  const session = useSession();
  const [rules, setRules] = useState<ComplaintRules>(FALLBACK_RULES);
  const [mine, setMine] = useState<Complaint[] | null>(null);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [photos, setPhotos] = useState<string[]>([]); // already shrunk, ready to send
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Complaint | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const registered = session?.registered === true;

  useEffect(() => {
    let live = true;
    loadRules().then((r) => live && setRules(r)).catch(() => {});
    return () => { live = false; };
  }, []);

  const refresh = useCallback(() => loadMine().then(setMine).catch(() => setMine([])), []);
  useEffect(() => {
    if (!registered) return;
    let live = true;
    loadMine().then((m) => live && setMine(m)).catch(() => live && setMine([]));
    markReadByTypes(["complaint"]); // opening this page clears the replies badge
    return () => { live = false; };
  }, [registered]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const room = rules.maxPhotos - photos.length;
      const next: string[] = [];
      for (const f of Array.from(files).slice(0, room)) next.push(await shrinkPhoto(f));
      setPhotos((p) => [...p, ...next]);
      if (files.length > room) setError(`You can attach up to ${rules.maxPhotos} photos.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That photo could not be added.");
    } finally {
      setPhotoBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!category) return setError("Choose what your complaint is about.");
    if (message.trim().length < rules.messageMin) return setError(`Please describe the problem (at least ${rules.messageMin} characters).`);
    setBusy(true);
    try {
      const c = await sendComplaint({ category, message: message.trim(), bookingCode: bookingCode.trim() || undefined, photos });
      setSent(c);
      setCategory("");
      setMessage("");
      setBookingCode("");
      setPhotos([]);
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <div className="h-96 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />;

  if (!registered) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand"><UserRound size={34} /></span>
        <h1 className="mt-6 text-2xl font-semibold">Complaints</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Sign in so we can follow up with you and show you our reply.</p>
        <button type="button" onClick={openSignIn} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400/20 text-emerald-600"><CheckCircle2 size={38} /></span>
        <h1 className="mt-6 text-2xl font-semibold">We got your complaint</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-500">Your reference is <strong className="font-mono text-slate-700">{sent.code}</strong>. The venue will look into it and reply here and in your notifications.</p>
        <button type="button" onClick={() => setSent(null)} className="glass-btn mt-6 rounded-full px-8 py-3.5 text-sm font-semibold text-white">See my complaints</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      <header>
        <h1 className="text-2xl font-semibold">Complaints</h1>
        <p className="text-sm text-slate-500">Something went wrong? Tell us and we will look into it.</p>
      </header>

      <form onSubmit={submit} className="glass space-y-5 rounded-3xl p-5" aria-label="New complaint">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">What is it about?</legend>
          <div className="flex flex-wrap gap-2">
            {rules.categories.map((c) => (
              <button type="button" key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
                className={`rounded-full px-4 py-2 text-sm ${category === c.id ? "bg-brand font-semibold text-white" : "bg-white/60 text-slate-600"}`}>{c.label}</button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-medium">What happened?
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={rules.messageMax} placeholder="Tell us what happened, when, and what you would like us to do."
            className="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-normal outline-none ring-1 ring-black/5 placeholder:text-slate-400 focus:ring-brand" />
          <span className="mt-1 block text-right text-xs font-normal text-slate-400">{message.length} / {rules.messageMax}</span>
        </label>

        <label className="block text-sm font-medium">Booking code <span className="font-normal text-slate-400">(optional)</span>
          <input value={bookingCode} onChange={(e) => setBookingCode(e.target.value.toUpperCase())} maxLength={20} placeholder="e.g. UF-7K3QX9"
            className="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 font-mono text-sm outline-none ring-1 ring-black/5 placeholder:font-sans placeholder:text-slate-400 focus:ring-brand" />
        </label>

        <div>
          <p className="mb-2 text-sm font-medium">Photos <span className="font-normal text-slate-400">(optional, up to {rules.maxPhotos})</span></p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-2xl bg-white/60">
                {/* a local data URL preview, so next/image is not needed */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"><X size={14} /></button>
              </div>
            ))}
            {photos.length < rules.maxPhotos && (
              <button type="button" disabled={photoBusy} onClick={() => picker.current?.click()}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-xs text-slate-500 disabled:opacity-60">
                {photoBusy ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={24} />}
                {photoBusy ? "Adding…" : "Add photo"}
              </button>
            )}
          </div>
          <input ref={picker} type="file" accept="image/*" multiple className="sr-only" aria-label="Choose photos" onChange={(e) => addPhotos(e.target.files)} />
          <p className="mt-2 text-xs text-slate-400">Photos only for now. They are shrunk before sending and the venue staff can see them.</p>
        </div>

        {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <button type="submit" disabled={busy || photoBusy} className="glass-btn flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : "Send complaint"}
        </button>
        <p className="text-center text-xs text-slate-400">You can send up to {rules.perDay} a day. For something urgent, call the venue.</p>
      </form>

      <section aria-label="My complaints" className="space-y-3">
        <h2 className="text-lg font-medium">My complaints</h2>
        {mine === null && <div className="h-24 animate-pulse rounded-3xl bg-white/40" aria-label="Loading" />}
        {mine?.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl px-4 py-8 text-center text-sm text-slate-500">
            <MessageSquareWarning size={28} className="text-slate-400" />
            You have not sent any complaints.
          </div>
        )}
        <ul className="space-y-3">
          {mine?.map((c) => {
            const st = STATUS_TEXT[c.status];
            return (
              <li key={c.id} className="glass space-y-2 rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{c.categoryLabel}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>
                </div>
                <p className="text-xs text-slate-400"><span className="font-mono">{c.code}</span> · {when(c.createdAt)}{c.bookingCode ? ` · booking ${c.bookingCode}` : ""}</p>
                <p className="whitespace-pre-line text-sm text-slate-600">{c.message}</p>
                {c.photos.length > 0 && (
                  <div className="flex gap-2">
                    {c.photos.map((p, i) => (
                      <a key={p} href={photoUrl(p)} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${i + 1}`} className="block h-16 w-16 overflow-hidden rounded-xl bg-white/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl(p)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {c.staffReply && (
                  <div className="rounded-2xl bg-brand/10 px-4 py-3 text-sm">
                    <p className="text-xs font-semibold text-brand">Reply from the venue</p>
                    <p className="mt-1 whitespace-pre-line text-slate-700">{c.staffReply}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
