import SimpleAuthHeader from "@/components/layout/SimpleAuthHeader";
import Footer from "@/components/layout/Footer";
import LoginForm from "@/components/auth/LoginForm";
import GlowyWavesCanvas from "@/components/ui/glowy-waves-canvas";

export default function LoginPage() {
  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col">
      {/* Simple Auth Header */}
      <SimpleAuthHeader />

      {/* Background Waves */}
      <GlowyWavesCanvas light={true} />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pt-[110px] pb-10">
        <div className="w-full max-w-[500px]">
          <div className="relative">
            {/* Subtle Outer Glow for the Card */}
            <div className="absolute -inset-1.5 rounded-[32px] bg-gradient-to-tr from-[#0c0b5d]/5 via-transparent to-[#FA6400]/5 blur-2xl opacity-40" />

            <div className="relative rounded-[28px] border border-white/60 bg-white/95 p-8 md:p-10 shadow-[0_32px_64px_-16px_rgba(12,11,93,0.06)] backdrop-blur-2xl">
              <LoginForm light={true} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
