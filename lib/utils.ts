import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isLightPage(pathname: string) {
  const lightPages = [
    "/",
    "/signup",
    "/membership",
    "/login",
    "/booking",
    "/booking-history",
    "/dashboard",
    "/promocode",
    "/checkout"
  ];
  return lightPages.includes(pathname);
}
