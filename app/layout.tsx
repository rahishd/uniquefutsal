import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SwRegister from "@/components/SwRegister";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Unique Futsal",
  description: "Book courts, find opponents and earn rewards at Unique Futsal.",
  appleWebApp: { capable: true, title: "Unique Futsal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#eef4fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">
        <main className="mx-auto min-h-screen w-full max-w-md px-5 pb-32 pt-6">{children}</main>
        <BottomNav />
        <SwRegister />
      </body>
    </html>
  );
}
