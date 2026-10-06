"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import AdStrip from "@/components/ads/AdStrip";

// Company details appear on the home screen only. Every other page just keeps
// clear space above the floating nav bar.
export default function FooterGate() {
  const pathname = usePathname();
  return (
    <>
      <div className="mx-auto w-full max-w-md px-5"><AdStrip placement="footer" /></div>
      {pathname === "/" ? <Footer /> : <div className="h-36" aria-hidden />}
    </>
  );
}
