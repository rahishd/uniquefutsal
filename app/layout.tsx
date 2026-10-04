import type { Metadata, Viewport } from "next";
import { DM_Sans, Rajdhani } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SwRegister from "@/components/SwRegister";

const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const heading = Rajdhani({ variable: "--font-heading", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Unique Futsal",
  description: "Book courts, find opponents and earn rewards at Unique Futsal.",
  appleWebApp: { capable: true, title: "Unique Futsal", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0b0b10] font-body text-white">
        <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">{children}</main>
        <BottomNav />
        <SwRegister />
      </body>
    </html>
  );
}
