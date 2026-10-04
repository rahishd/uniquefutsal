import { BRAND } from "@/constants";
import Link from "next/link";
import StatusBadge from "@/components/ui/status-badge";

export default function HeroSection() {
  return (
    <section className="relative min-h-[720px] w-full overflow-hidden flex items-center">
      {/* Hero Glows (Light Mode) */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-200/10 blur-[120px] rounded-full z-[5] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-orange-100/20 blur-[100px] rounded-full z-[5] pointer-events-none" />

      {/* Content Container */}
      <div className="relative z-20 flex h-full w-full flex-col items-center justify-center gap-12 md:gap-16 px-6 pt-32 pb-20">
        {/* Status Badge */}
        <StatusBadge label="Live Pitch Status: Available" />

        {/* Heading Section */}
        <div className="flex max-w-[1000px] flex-col items-center gap-8 text-center">
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-[#0c0b5d] md:text-8xl lg:text-[100px] drop-shadow-sm">
            The Future of{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0c0b5d] to-[#FA6400]">
              Futsal
            </span>{" "}
            is Here.
          </h1>

          <p className="max-w-[720px] text-lg font-bold leading-relaxed md:text-2xl px-4 md:px-0 text-[#0c0b5d]/80 uppercase tracking-tight">
            Experience the ultimate futsal arena. Fast games. Pure energy.
            <br className="hidden md:block" /> Built for players who live for
            the goal.
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex flex-col items-center gap-6 sm:flex-row w-full max-w-[500px] md:max-w-none px-4 md:px-0">
          <div className="w-full md:w-[320px]">
            <Link href="/booking">
              <button
                className="w-full h-18 text-lg font-black uppercase tracking-widest bg-[#0c0b5d] text-white border-2 border-[#0c0b5d] rounded-2xl shadow-[0_20px_40px_-10px_rgba(12,11,93,0.15)] hover:shadow-[0_25px_50px_-12px_rgba(12,11,93,0.25)] transition-all duration-300 transform hover:scale-[1.02] active:scale-98 cursor-pointer hover:bg-[#FA6400] hover:border-[#FA6400]"
              >
                BOOK LIVE SLOT NOW
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
