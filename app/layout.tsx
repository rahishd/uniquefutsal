import type { Metadata } from "next";
// import { Lexend, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import QueryProvider from "@/components/providers/QueryProvider";
import { Toaster } from "sonner";
import PageTracker from "@/components/PageTracker";

// Font loading moved to globals.css to bypass build-time network issues
// const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
// 
// const lexend = Lexend({
//   variable: "--font-lexend",
//   subsets: ["latin"],
//   weight: ["300", "400", "500", "600", "700", "800"],
// });

export const metadata: Metadata = {
  title: "Unique Futsal",
  description: "Join the Unique Futsal community. Create your account today.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="font-sans"
      suppressHydrationWarning
    >
      <body
        className="antialiased font-lexend"
        style={{
          background: "linear-gradient(180deg, #F0F4FA 0%, #E2E8F0 100%)",
        }}
        suppressHydrationWarning
      >
        {/* Global background image - fixed so it shows consistently on all pages */}
        <div
          className="fixed inset-0 z-0 bg-cover bg-[center_top] pointer-events-none"
          style={{
            backgroundImage: "url('/bg.jpg')",
            opacity: 0.45,
          }}
        />
        {/* Gradient overlay */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(240,244,250,0.1) 0%, rgba(240,244,250,0.8) 50%, #F0F4FA 100%)",
          }}
        />
        {/* Blur orbs */}
        <div className="fixed top-0 right-0 -mr-20 -mt-20 h-[500px] w-[500px] rounded-full bg-blue-200/20 opacity-40 blur-[100px] z-0 pointer-events-none" />
        <div className="fixed top-1/2 left-0 -ml-20 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-orange-100/20 opacity-30 blur-[120px] z-0 pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 -mb-20 h-[500px] w-[500px] rounded-full bg-blue-100/20 opacity-30 blur-[100px] z-0 pointer-events-none" />
        
        <PageTracker />
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" richColors closeButton expand={true} />
      </body>
    </html>
  );
}
