import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import FooterGate from "@/components/FooterGate";
import CompanyHeader from "@/components/CompanyHeader";
import SwRegister from "@/components/SwRegister";
import InstallPrompt from "@/components/InstallPrompt";
import ArrivalPrompt from "@/components/ArrivalPrompt";
import WinPrompt from "@/components/captain/WinPrompt";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Unique Futsal",
  description: "Book courts, find opponents and earn rewards at Unique Futsal.",
  appleWebApp: { capable: true, title: "Unique Futsal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0c0b5d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">
        <CompanyHeader />
        <main className="mx-auto w-full max-w-md px-5 pt-5 min-h-[60vh]">{children}</main>
        <FooterGate />
        <BottomNav />
        <SwRegister />
        <InstallPrompt />
        <ArrivalPrompt />
        <WinPrompt />
      </body>
    </html>
  );
}
