"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

// The booking flow stays focused: no company details, just room above the nav bar.
export default function FooterGate() {
  const pathname = usePathname();
  if (pathname.startsWith("/book")) return <div className="h-36" aria-hidden />;
  return <Footer />;
}
