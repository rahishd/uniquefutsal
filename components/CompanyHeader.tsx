import Link from "next/link";
import { site } from "@/lib/site";

// Company bar at the very top of every page. It stays pinned while the page scrolls, so the
// customer always sees whose app this is. The greeting sits just below it on Home.
export default function CompanyHeader() {
  return (
    <div className="sticky top-0 z-30 border-b border-white/60 bg-[#eceaf8]/80 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <Link href="/" aria-label={`${site.name} home`} className="mx-auto flex h-14 w-full max-w-md items-center gap-3 px-5">
        {/* The logo is a square picture; show the player (upper part) inside a small rounded tile. */}
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-xl bg-[#0c0b5d] bg-no-repeat shadow-md"
          style={{ backgroundImage: "url(/logo.jpg)", backgroundSize: "175%", backgroundPosition: "47% 22%" }}
        />
        <span className="text-lg font-bold uppercase tracking-wide text-[#0c0b5d]">{site.name}</span>
      </Link>
    </div>
  );
}
