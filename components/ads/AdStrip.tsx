"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { mediaUrl, trackAd, useContent, type AdItem } from "@/lib/content";

// A banner that loops through the live ads of one place (header, footer or inside the Home page).
// Each ad stays for its own number of seconds, then the next one fades in. Nothing shows when no ad is live.
type Place = "header" | "footer" | "inline";

const SHAPE: Record<Place, string> = {
  header: "h-14 rounded-xl",
  footer: "h-16 rounded-2xl",
  inline: "aspect-[16/7] rounded-3xl",
};

function Tag({ ad, children, className, onClick }: { ad: AdItem; children: React.ReactNode; className: string; onClick: () => void }) {
  if (!ad.linkUrl) return <div className={className}>{children}</div>;
  if (ad.linkUrl.startsWith("/")) return <Link href={ad.linkUrl} onClick={onClick} className={className}>{children}</Link>;
  return <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={onClick} className={className}>{children}</a>;
}

export default function AdStrip({ placement }: { placement: Place }) {
  const ads = useContent().ads[placement];
  const [index, setIndex] = useState(0);
  const seen = useRef(new Set<string>());
  const ids = ads.map((a) => a.id).join(",");

  // keep the position valid when the list changes (an ad's time window ended)
  const pos = ads.length ? index % ads.length : 0;
  const ad = ads[pos];

  useEffect(() => {
    if (!ad) return;
    if (!seen.current.has(ad.id)) {
      seen.current.add(ad.id);
      trackAd(ad.id, "view");
    }
    if (ads.length < 2) return;
    const t = setTimeout(() => setIndex((i) => i + 1), Math.max(3, ad.displaySeconds) * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id, ids, index]);

  if (!ad) return null;
  return (
    <div className="relative" role="region" aria-label="Advertisement">
      <Tag ad={ad} onClick={() => trackAd(ad.id, "click")} className={`relative block w-full overflow-hidden bg-white/60 shadow-sm ${SHAPE[placement]}`}>
        {/* ads come from the venue's own API, so next/image is not used */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={ad.id} src={mediaUrl(ad.imageUrl)} alt={ad.title} className="h-full w-full animate-[adfade_.5s_ease] object-cover" />
        <span className="absolute left-2 top-1.5 rounded bg-black/40 px-1.5 text-[9px] font-medium uppercase tracking-wide text-white">Ad</span>
      </Tag>
      {ads.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1" aria-hidden>
          {ads.map((a, i) => <span key={a.id} className={`h-1 rounded-full ${i === pos ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />)}
        </div>
      )}
    </div>
  );
}
