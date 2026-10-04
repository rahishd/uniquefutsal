"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InputField from "@/components/ui/input-field";
import { Mail, Lock, LogIn, Loader2, AlertCircle } from "lucide-react";
import { adminLogin } from "@/lib/api/admin";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await adminLogin(email, password);
      router.push("/uniquesuperadmin/viewslots");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-8 md:gap-10">

      {/* Header Section */}
      <div className="flex flex-col gap-3">
        <h1 className="text-[32px] md:text-[40px] font-black leading-tight tracking-tight text-center md:text-left text-[#0f172a]">
          Admin Access
        </h1>
        <p className="text-lg font-medium leading-relaxed text-center md:text-left text-[#475569]">
          Enter your credentials to access the control panel.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Form Fields Container */}
      <div className="flex flex-col gap-6">
        
        {/* Email Input */}
        <InputField
          id="email"
          label="Email Address"
          type="email"
          placeholder="admin@uniquefutsal.com"
          icon={<Mail size={20} />}
          light={true}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password Input */}
        <InputField
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          icon={<Lock size={20} />}
          light={true}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="pt-4">
          <button 
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full h-[64px] text-lg rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-[0_8px_30px_rgb(12,11,93,0.12)] hover:shadow-[0_20px_40px_rgba(12,11,93,0.25)] hover:scale-[1.02] active:scale-98 bg-[#0c0b5d] text-white border-none hover:bg-[#FA6400] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" /> Signing in...
              </>
            ) : (
              <>
                Secure Login <LogIn size={20} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 py-1">
        <div className="flex-1 h-[1px] bg-gray-200"></div>
        <span className="text-[10px] font-bold tracking-[2px] uppercase text-gray-400">
          Restricted Area
        </span>
        <div className="flex-1 h-[1px] bg-gray-200"></div>
      </div>

      <div className="flex flex-col items-center justify-center pt-2">
         <p className="text-xs font-medium text-slate-400 text-center">
            This area is restricted to authorized personnel only. All access attempts are logged.
         </p>
      </div>

    </form>
  );
}
