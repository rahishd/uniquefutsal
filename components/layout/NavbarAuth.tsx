"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, Variants, type Transition } from "framer-motion";
import { isLightPage } from "@/lib/utils";

interface NavbarAuthProps {
  variants: {
    item: Variants;
    back: Variants;
    glow: Variants;
  };
  transition: Transition;
  glowGradient: string;
}

export default function NavbarAuth({ variants, transition, glowGradient }: NavbarAuthProps) {
  const pathname = usePathname();
  const isLightMode = isLightPage(pathname);

  return (
    <motion.div
      className="relative group"
      style={{ perspective: "600px" }}
      whileHover="hover"
      initial="initial"
    >
      <Link href="/login" className={`relative z-10 px-6 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-md transform hover:scale-105 active:scale-95 ${
        isLightMode 
          ? "bg-[#0c0b5d] text-white" 
          : "bg-white text-[#0c0b5d]"
      }`}>
        Login
      </Link>
    </motion.div>
  );
}
