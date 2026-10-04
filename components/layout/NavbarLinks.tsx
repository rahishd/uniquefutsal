"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, Variants, type Transition } from "framer-motion";
import { isLightPage } from "@/lib/utils";

interface NavbarLinksProps {
  links: { label: string; href: string }[];
  variants: {
    item: Variants;
    back: Variants;
    glow: Variants;
  };
  transition: Transition;
  glowGradient: string;
}

export default function NavbarLinks({
  links,
  variants,
  transition,
  glowGradient,
}: NavbarLinksProps) {
  const pathname = usePathname();
  const isLightMode = isLightPage(pathname);

  return (
    <nav className="hidden lg:flex items-center gap-4">
      {links.map((link) => (
        <motion.div
          key={link.label}
          className="relative group"
          style={{ perspective: "600px" }}
          whileHover="hover"
          initial="initial"
        >
          <Link 
            href={link.href} 
            className={`relative z-10 px-4 py-2 text-sm font-black uppercase tracking-widest transition-all duration-300 cursor-pointer ${
              pathname === link.href
                ? "text-[#FA6400]"
                : isLightMode 
                  ? "text-[#0c0b5d]/60 hover:text-[#0c0b5d]" 
                  : "text-white/60 hover:text-white"
            }`}
          >
            {link.label}
            {pathname === link.href && (
              <motion.div 
                layoutId="nav-underline"
                className="absolute -bottom-1 left-4 right-4 h-0.5 bg-[#FA6400] rounded-full"
              />
            )}
          </Link>
        </motion.div>
      ))}
    </nav>
  );
}
