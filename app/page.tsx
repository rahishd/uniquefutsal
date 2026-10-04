import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import LiveAvailability from "@/components/home/LiveAvailability";
import Promotions from "@/components/home/Promotions";
import MembershipPackages from "@/components/home/MembershipPackages";
import AdPopup from "@/components/AdPopup";


export default function HomePage() {
  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
      <AdPopup />
      <Navbar />


      <main className="relative z-10">
        <HeroSection />
        <LiveAvailability />
        <Promotions light={false} />
        <MembershipPackages light={true} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
