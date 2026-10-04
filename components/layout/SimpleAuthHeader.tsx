import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NavbarLogo from "./NavbarLogo";

export default function SimpleAuthHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 md:px-12">
      <NavbarLogo />
      <Link
        href="/"
        className="group flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-gray-700 backdrop-blur-md transition-all hover:bg-white hover:text-[#0c0b5d] hover:shadow-md"
      >
        <ArrowLeft
          size={16}
          className="transition-transform group-hover:-translate-x-1"
        />
        Return to Home
      </Link>
    </header>
  );
}
