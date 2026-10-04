"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InputField from "@/components/ui/input-field";
import { User, Lock, Loader2, AlertCircle, Phone } from "lucide-react";
import { BRAND, APP } from "@/constants";
import { login } from "@/lib/api/auth";
import { toast } from "sonner";

interface LoginFormProps {
  light?: boolean;
}

export default function LoginForm({ light = false }: LoginFormProps) {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!identifier.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      await login({
        identifier: identifier.trim(),
        password,
      });

      toast.success("Welcome back! Logging you in...");
      router.push("/booking");
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to login. Please check your credentials.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-8 md:gap-10"
    >
      {/* Header Section */}
      <div className="flex flex-col gap-3">
        <h1
          className="text-[32px] md:text-[40px] font-black leading-tight tracking-tight text-center md:text-left"
          style={{ color: light ? "#0f172a" : "#ffffff" }}
        >
          Welcome Back
        </h1>
        <p
          className="text-lg font-medium leading-relaxed text-center md:text-left"
          style={{ color: light ? "#475569" : "#94A3B8" }}
        >
          Enter your phone number to step onto the court.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Form Fields Container */}
      <div className="flex flex-col gap-6">
        {/* Identifier Input */}
        <InputField
          id="identifier"
          label="Phone Number"
          type="text"
          placeholder="98XXXXXXXX"
          icon={<Phone size={20} />}
          light={light}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={isLoading}
        />

        {/* Password Input */}
        <div>
          <InputField
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            icon={<Lock size={20} />}
            light={light}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          <div className="flex justify-end mt-2">
            <Link
              href="/forgot-password"
              className={`text-sm font-medium hover:underline transition-all ${
                light
                  ? "text-[#0c0b5d]/70 hover:text-[#0c0b5d]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full h-[64px] text-lg rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-[0_8px_30px_rgb(12,11,93,0.12)] hover:shadow-[0_20px_40px_rgba(12,11,93,0.25)] hover:scale-[1.02] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 ${
              light
                ? "bg-[#0c0b5d] text-white border-none hover:bg-[#FA6400]"
                : "bg-white text-[#0c0b5d] border-2 border-[#0c0b5d] hover:bg-[#0c0b5d] hover:text-white"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </div>
      </div>

      {/* Sign up Link */}
      <div className="flex flex-col items-center justify-center gap-4 lg:flex-row lg:gap-2 pt-2 border-t border-gray-100">
        <span
          className={`text-base font-medium ${light ? "text-gray-400" : "text-[#94A3B8]"}`}
        >
          Don&apos;t have an account?
        </span>
        <Link
          href="/signup"
          className="group flex items-center gap-1 text-base font-bold transition-all hover:opacity-80"
          style={{ color: light ? BRAND.primary : BRAND.secondary }}
        >
          Create account
          <span className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </form>
  );
}
