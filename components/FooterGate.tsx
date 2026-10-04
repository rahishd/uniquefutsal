"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

// Company details appear on the home screen only. Every other page just keeps
// clear space above the floating nav bar.
export default function FooterGate() {
  const pathname = usePathname();
  if (pathname === "/") return <Footer />;
  return <div className="h-36" aria-hidden />;
}
