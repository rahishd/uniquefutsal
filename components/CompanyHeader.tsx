import Link from "next/link";
import { site } from "@/lib/site";
import AdStrip from "@/components/ads/AdStrip";
import DeskNav from "@/components/DeskNav";

// Company bar at the very top of every page: a navy rectangle with the white logo and name. It stays
// pinned while the page scrolls, so the customer always sees whose app this is. The greeting sits just
// below it on Home. In desktop mode (see `desk:` in globals.css) the bar spans the page and carries the
// main navigation, because the bottom bar is hidden there.
export default function CompanyHeader() {
  return (
    <div className="sticky top-0 z-30 bg-[#eceaf8]/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-md px-3 pb-2 pt-2 desk:max-w-none desk:px-10 desk:pb-3 desk:pt-3">
        <div className="flex min-h-16 items-center gap-3 rounded-2xl bg-[#0c0b5d] px-4 py-2 shadow-[0_8px_20px_rgba(12,11,93,0.3)] desk:gap-6 desk:px-6">
          <Link href="/" aria-label={`${site.name} home`} className="flex items-center gap-3 desk:shrink-0 desk:max-xl:gap-2">
            {/* The logo picture is white on navy; blending with "lighten" keeps only the white player on the bar. */}
            <span
              aria-hidden
              className="h-11 w-11 shrink-0 bg-[#0c0b5d] bg-no-repeat"
              style={{
                backgroundImage: "url(/logo.jpg)",
                backgroundSize: "75px 75px",
                backgroundPosition: "-13px -5px",
                backgroundBlendMode: "lighten",
              }}
            />
            <span className="min-w-0">
              <span className="block text-lg desk:whitespace-nowrap font-bold uppercase leading-tight tracking-wide text-white">{site.name}</span>
              <span className="block text-[10px] leading-snug text-white/75 desk:max-xl:hidden">1st Advanced tech Driven futsal In nepal</span>
              <span className="block text-[10px] leading-snug text-white/75 desk:max-xl:hidden">Designed and Developed by: Rahish Dumre</span>
            </span>
          </Link>
          <DeskNav />
        </div>
        <div className="empty:hidden mt-2"><AdStrip placement="header" /></div>
      </div>
    </div>
  );
}
