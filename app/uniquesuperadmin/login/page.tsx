import GlowyWavesCanvas from "@/components/ui/glowy-waves-canvas";
import AdminLoginForm from "@/components/auth/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden flex flex-col bg-white">

      {/* Background Waves */}
      <GlowyWavesCanvas light={true} />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[500px]">
          <div className="relative">
            {/* Subtle Outer Glow for the Card */}
            <div className="absolute -inset-1.5 rounded-[32px] bg-gradient-to-tr from-[#0c0b5d]/5 via-transparent to-[#FA6400]/5 blur-2xl opacity-40" />

            <div className="relative rounded-[28px] border border-slate-200 bg-white/95 p-8 md:p-10 shadow-[0_32px_64px_-16px_rgba(12,11,93,0.06)] backdrop-blur-2xl">
              <div className="flex justify-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0c0b5d] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                    <span className="font-black text-sm italic">U</span>
                  </div>
                  <span className="font-black italic text-[#0c0b5d] uppercase tracking-tighter text-2xl leading-none">
                    Unique<span className="text-[#FA6400]">Futsal</span>
                  </span>
                </div>
              </div>
              <AdminLoginForm />
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
