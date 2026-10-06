"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { mediaUrl, useContent, type GalleryPhoto } from "@/lib/content";

// Photos the venue uploaded. Landscape and portrait pictures sit side by side in a tidy two-column layout; tapping one opens it full screen.
const FIRST = 6;
const SHAPE: Record<GalleryPhoto["orientation"], string> = { landscape: "aspect-[4/3]", portrait: "aspect-[3/4]", square: "aspect-square" };

export default function GallerySection() {
  const photos = useContent().gallery;
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const touch = useRef<number | null>(null);

  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (photos.length === 0) return null;
  const shown = all ? photos : photos.slice(0, FIRST);
  const current = open !== null ? photos[open] ?? null : null;

  return (
    <section className="mt-6" aria-label="Gallery">
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-medium">Gallery</h2>
        {photos.length > FIRST && (
          <button type="button" onClick={() => setAll((a) => !a)} className="text-sm font-medium text-brand">{all ? "Show less" : `See all ${photos.length}`}</button>
        )}
      </div>
      <div className="mt-3 columns-2 gap-3">
        {shown.map((p) => {
          const i = photos.indexOf(p);
          return (
            <button type="button" key={p.id} onClick={() => setOpen(i)} aria-label={`Open photo: ${p.title}`} className={`glass mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl ${SHAPE[p.orientation]}`}>
              {/* photos come from the venue's own API, so next/image is not used */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(p.imageUrl)} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/90"
          role="dialog" aria-modal="true" aria-label={current.title}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm text-white/70">{(open ?? 0) + 1} / {photos.length}</span>
            <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><X size={22} /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(current.imageUrl)} alt={current.title} className="max-h-full max-w-full object-contain" />
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"><ChevronLeft size={24} /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"><ChevronRight size={24} /></button>
              </>
            )}
          </div>
          <div className="p-5 text-center text-white" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>
            <p className="font-medium">{current.title}</p>
            {current.caption && <p className="mt-1 text-sm text-white/70">{current.caption}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
