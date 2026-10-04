"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Variants } from "framer-motion";
import NavbarLogo from "./NavbarLogo";
import NavbarLinks from "./NavbarLinks";
import NavbarUserMenu from "./NavbarUserMenu";
import NavbarAuth from "./NavbarAuth";
import { isLightPage as checkIsLightPage } from "@/lib/utils";
import {
  Menu,
  X,
  ChevronRight,
  LogOut,
  User,
  Home,
  Calendar,
  Trophy,
  Tag,
  Crown,
  Image,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { getStoredUser, isAuthenticated, logout } from "@/lib/api/auth";
import { useMe } from "@/lib/hooks";

const itemVariants: Variants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
};

const backVariants: Variants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
};

const glowVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  hover: {
    opacity: 1,
    scale: 2,
    transition: {
      opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.5, type: "spring", stiffness: 300, damping: 25 },
    },
  },
};

const sharedTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
  duration: 0.5,
};

const brandGlow =
  "radial-gradient(circle, rgba(12,11,93,0.1) 0%, rgba(12,11,93,0.04) 50%, rgba(12,11,93,0) 100%)";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    avatar: string | null;
  }>({
    name: "Player",
    avatar: null,
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isLightPage = checkIsLightPage(pathname);
  const showFullNav = true;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    // Initialize auth state on mount
    setIsLoggedIn(isAuthenticated());
    const storedUser = getStoredUser();
    if (storedUser) {
      setUserProfile({
        name: storedUser.name || storedUser.email || "Player",
        avatar: storedUser.avatar || null,
      });
    }

    window.addEventListener("scroll", handleScroll);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const meQuery = useMe({ enabled: isLoggedIn });
  const displayedUserProfile = {
    name:
      meQuery.data?.name ||
      meQuery.data?.email ||
      userProfile.name ||
      "Player",
    avatar: meQuery.data?.avatar || userProfile.avatar,
  };

  useEffect(() => {
    const handleProfileUpdate = (e: Event) => {
      const updated = (e as CustomEvent).detail as { name?: string; email?: string; avatar?: string | null } | undefined;
      if (!updated) return;
      setUserProfile((prev) => ({
        ...prev,
        name: updated.name || updated.email || prev.name,
        avatar: updated.avatar ?? prev.avatar,
      }));
    };
    window.addEventListener("userProfileUpdated", handleProfileUpdate);
    return () => window.removeEventListener("userProfileUpdated", handleProfileUpdate);
  }, []);

  useEffect(() => {
    const onAuthSignal = () => setIsLoggedIn(isAuthenticated());
    window.addEventListener("storage", onAuthSignal);
    window.addEventListener("focus", onAuthSignal);
    return () => {
      window.removeEventListener("storage", onAuthSignal);
      window.removeEventListener("focus", onAuthSignal);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    router.push("/login");
  };

  const navLinks = [
    { label: "Home", href: "/", icon: Home },
    { label: "Booking", href: "/booking", icon: Calendar },
    // { label: "Tournaments", href: "/tournaments", icon: Trophy },
    { label: "Promo code", href: "/promocode", icon: Tag },
    { label: "Membership", href: "/membership", icon: Crown },
    { label: "Gallery", href: "/gallery", icon: Image },
  ];

  const animationVariants = {
    item: itemVariants,
    back: backVariants,
    glow: glowVariants,
  };

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-50 flex h-[65px] flex-row items-center justify-between border-b transition-all duration-300 px-4 md:px-20 ${
          isScrolled
            ? isLightPage
              ? "border-gray-200 bg-white/80 backdrop-blur-md h-[75px]"
              : "border-white/10 bg-[#0d1117]/80 backdrop-blur-md h-[75px]"
            : "border-transparent bg-transparent h-[85px]"
        }`}
      >
        <NavbarLogo />

        {showFullNav && (
          <NavbarLinks
            links={navLinks}
            variants={animationVariants}
            transition={sharedTransition}
            glowGradient={brandGlow}
          />
        )}

        <div className="flex items-center gap-4">
          {showFullNav && (
            <>
              <div className="flex items-center gap-2 md:gap-4">
                {isLoggedIn ? (
                  <NavbarUserMenu
                    userProfile={displayedUserProfile}
                    isDropdownOpen={isDropdownOpen}
                    setIsDropdownOpen={setIsDropdownOpen}
                    dropdownRef={dropdownRef}
                    onLogout={handleLogout}
                  />
                ) : (
                  <NavbarAuth
                    variants={animationVariants}
                    transition={sharedTransition}
                    glowGradient={brandGlow}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Bottom Tab Navigation - Outside header for proper fixed positioning */}
      <nav
        className={`lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-50 rounded-full border shadow-xl flex items-center justify-between px-6 py-3 transition-all duration-300 ${
          isLightPage
            ? "bg-white/90 border-gray-200 backdrop-blur-md"
            : "bg-[#161b22]/90 border-white/10 backdrop-blur-md"
        }`}
      >
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.label}
              href={link.href}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                isActive
                  ? "text-[#FA6400] scale-110"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium text-center leading-tight">
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
