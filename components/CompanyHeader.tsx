import Link from "next/link";
import { site } from "@/lib/site";

// Company bar at the very top of every page: a navy rectangle with the white logo and name. It stays
// pinned while the page scrolls, so the customer always sees whose app this is. The greeting sits just
// below it on Home.
export default function CompanyHeader() {
  return (
    <div className="sticky top-0 z-30 bg-[#eceaf8]/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-md px-3 pb-2 pt-2">
        <Link
          href="/"
          aria-label={`${site.name} home`}
          className="flex h-16 items-center gap-3 rounded-2xl bg-[#0c0b5d] px-4 shadow-[0_8px_20px_rgba(12,11,93,0.3)]"
        >
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
          <span className="text-lg font-bold uppercase tracking-wide text-white">{site.name}</span>
        </Link>
      </div>
    </div>
  );
}
