import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import LiveAvailability from "@/components/home/LiveAvailability";
import Promotions from "@/components/home/Promotions";
import MembershipPackages from "@/components/home/MembershipPackages";
import AdPopup from "@/components/AdPopup";
import MobileHome from "@/components/app/MobileHome";


export default function HomePage() {
  return (
    <>
      <AdPopup />

      {/* Mobile: app-style home */}
      <div className="relative z-10 md:hidden">
        <MobileHome />
      </div>

      {/* Tablet/desktop: existing marketing home */}
      <div className="relative isolate hidden min-h-screen w-full flex-col overflow-hidden md:flex">
        <Navbar />

        <main className="relative z-10">
          <HeroSection />
          <LiveAvailability />
          <Promotions light={false} />
          <MembershipPackages light={true} />
        </main>

        <Footer />
      </div>
    </>
  );
}
