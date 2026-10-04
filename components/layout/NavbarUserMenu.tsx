"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  History,
  LogOut,
  User,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn, isLightPage } from "@/lib/utils";

interface NavbarUserMenuProps {
  userProfile: { name: string; avatar: string | null };
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onLogout: () => void;
}

const menuItems = [
  {
    id: 1,
    icon: <User size={18} />,
    title: "Account Overview",
    description: "Manage your profile & activity",
    href: "/booking-history",
  },
];

export default function NavbarUserMenu({
  userProfile,
  isDropdownOpen,
  setIsDropdownOpen,
  dropdownRef,
  onLogout,
}: NavbarUserMenuProps) {
  const pathname = usePathname();
  const isLightMode = isLightPage(pathname);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <div
        className="flex items-center gap-3 cursor-pointer group transition-all"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div
          className={cn(
            "h-10 w-10 rounded-full border flex items-center justify-center overflow-hidden transition-all group-hover:scale-105 bg-[#0c0b5d] text-white",
            isLightMode
              ? "border-slate-200 bg-white shadow-sm"
              : "border-[#0c0b5d]/20 bg-[#050426] group-hover:border-[#0c0b5d]/50 group-hover:shadow-[0_0_15px_rgba(12,11,93,0.2)]",
          )}
        >
          {userProfile.avatar ? (
            <div className="relative h-full w-full">
              <Image
                src={userProfile.avatar}
                alt="Profile"
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <span
              className={cn(
                "text-lg font-bold uppercase",
                isLightMode ? "text-[#0c0b5d]" : "text-white",
              )}
            >
              {userProfile.name?.charAt(0) || "U"}
            </span>
          )}
        </div>
        <div className="hidden md:flex flex-col items-start leading-tight">
          <span
            className={cn(
              "text-[10px] font-black tracking-[0.2em] uppercase",
              isLightMode ? "text-[#FA6400]" : "text-[#FA6400]",
            )}
          >
            Player
          </span>
          <span className="text-sm font-black text-[#FA6400]">
            {userProfile.name}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "transition-all duration-500",
            isLightMode ? "text-[#0c0b5d]/40" : "text-white/50",
            isDropdownOpen
              ? "rotate-180 text-[#FA6400]"
              : "group-hover:text-current",
          )}
        />
      </div>

      {/* Dropdown Panel - Redesigned based on theme */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              "absolute right-0 mt-4 w-80 rounded-[28px] border backdrop-blur-2xl z-50 overflow-hidden",
              isLightMode
                ? "border-gray-100 bg-white/95 shadow-[0_32px_64px_-16px_rgba(12,11,93,0.12)]"
                : "border-white/10 bg-[#050426] shadow-[0_20px_50px_rgba(0,0,0,0.8)]",
            )}
          >
            {/* Header */}
            <div
              className={cn(
                "flex items-center gap-4 p-6 border-b",
                isLightMode
                  ? "bg-slate-50/50 border-gray-50"
                  : "bg-white/[0.03] border-white/5",
              )}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-full border-2 p-0.5 flex items-center justify-center bg-[#0c0b5d] text-white",
                  isLightMode
                    ? "border-[#0c0b5d]/20"
                    : "border-[#0c0b5d] shadow-[0_0_15px_rgba(12,11,93,0.2)]",
                )}
              >
                {userProfile.avatar ? (
                  <img
                    src={userProfile.avatar}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span
                    className={cn(
                      "text-xl font-bold uppercase",
                      isLightMode ? "text-[#0c0b5d]" : "text-white",
                    )}
                  >
                    {userProfile.name?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <h3
                  className={cn(
                    "text-base font-black uppercase tracking-tight leading-tight",
                    isLightMode ? "text-[#0c0b5d]" : "text-white",
                  )}
                >
                  {userProfile.name}
                </h3>
              </div>
            </div>

            {/* List - Staggered Slide In */}
            <div className="p-3">
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: index * 0.08,
                    duration: 0.4,
                    ease: "easeOut",
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsDropdownOpen(false)}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl p-3 transition-all duration-300",
                      isLightMode
                        ? "hover:bg-slate-50 text-slate-600 hover:text-[#0c0b5d]"
                        : "hover:bg-white/5 text-white/70 hover:text-white",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        isLightMode
                          ? "bg-slate-100 text-slate-400"
                          : "bg-white/5 text-white/50",
                      )}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black uppercase tracking-tight">
                        {item.title}
                      </h4>
                      <p
                        className={cn(
                          "text-[11px] font-medium opacity-60 truncate leading-tight mt-1",
                          isLightMode ? "text-slate-500" : "text-white/50",
                        )}
                      >
                        {item.description}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className={cn(
                "p-4 border-t",
                isLightMode
                  ? "bg-slate-50/50 border-gray-50"
                  : "bg-white/[0.02] border-white/5",
              )}
            >
              <button
                onClick={onLogout}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all border",
                  isLightMode
                    ? "text-red-500 border-red-100 hover:bg-red-50"
                    : "text-red-400 border-transparent hover:bg-red-500/10 hover:border-red-500/10",
                )}
              >
                <LogOut size={16} />
                Logout Account
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
