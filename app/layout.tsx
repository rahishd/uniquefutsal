import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import FooterGate from "@/components/FooterGate";
import SwRegister from "@/components/SwRegister";
import InstallPrompt from "@/components/InstallPrompt";
import ReminderScheduler from "@/components/ReminderScheduler";
import ArrivalPrompt from "@/components/ArrivalPrompt";
import ExpiryPrompt from "@/components/ExpiryPrompt";

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
        <main className="mx-auto w-full max-w-md px-5 pt-6 min-h-[60vh]">{children}</main>
        <FooterGate />
        <BottomNav />
        <SwRegister />
        <InstallPrompt />
        <ReminderScheduler />
        <ArrivalPrompt />
        <ExpiryPrompt />
      </body>
    </html>
  );
}
