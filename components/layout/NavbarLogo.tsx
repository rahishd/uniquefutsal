"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { isLightPage } from "@/lib/utils";

export default function NavbarLogo() {
  const pathname = usePathname();
  const isLightMode = isLightPage(pathname);

  return (
    <Link href="/" className="flex flex-row items-center gap-3 shrink-0">
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all hover:scale-110 overflow-hidden ${
          isLightMode ? "shadow-blue-900/10 border border-gray-100" : "shadow-[#0c0b5d]/30 border border-white/10"
        }`}
      >
        <img 
          src="/logo.jpg" 
          alt="Unique Futsal Logo" 
          className="h-full w-full object-cover"
        />
      </div>
      <span className={`text-xl font-bold tracking-tight ${isLightMode ? "text-[#0c0b5d]" : "text-[#F1F5F9]"}`}>
        Unique Futsal
      </span>
    </Link>
  );
}
