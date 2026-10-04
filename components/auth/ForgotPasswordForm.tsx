"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InputField from "@/components/ui/input-field";
import { Lock, Loader2, AlertCircle, Phone, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import { BRAND } from "@/constants";
import { forgotPassword, resetPassword } from "@/lib/api/auth";
import { toast } from "sonner";

interface ForgotPasswordFormProps {
  light?: boolean;
}

type Step = "phone" | "otp" | "reset";

export default function ForgotPasswordForm({ light = false }: ForgotPasswordFormProps) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phoneNumber.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    setIsLoading(true);

    try {
      await forgotPassword(phoneNumber.trim());
      toast.success("Verification code sent to your phone.");
      setStep("otp");
    } catch (err) {
      console.error("Forgot password error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send reset code.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp.trim() || otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    // In this implementation, we move to reset step
    // The backend verify-forgot-password logic can be implicit in resetPassword 
    // or we can add an explicit verify step. Since we already have resetPassword 
    // taking OTP, we can just move to the next UI step.
    setStep("reset");
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword({
        phoneNumber: phoneNumber.trim(),
        otp: otp.trim(),
        newPassword,
      });

      toast.success("Password reset successfully! You can now login.");
      router.push("/login");
    } catch (err) {
      console.error("Reset password error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to reset password.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1
          className="text-[32px] md:text-[40px] font-black leading-tight tracking-tight text-center md:text-left"
          style={{ color: light ? "#0f172a" : "#ffffff" }}
        >
          Forgot Password?
        </h1>
        <p
          className="text-lg font-medium leading-relaxed text-center md:text-left"
          style={{ color: light ? "#475569" : "#94A3B8" }}
        >
          No worries! Enter your phone number and we&apos;ll send you a reset code.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      )}

      <InputField
        id="phoneNumber"
        label="Phone Number"
        type="text"
        placeholder="98XXXXXXXX"
        icon={<Phone size={20} />}
        light={light}
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        disabled={isLoading}
      />

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full h-[64px] text-lg rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 shadow-[0_8px_30px_rgb(12,11,93,0.12)] hover:shadow-[0_20px_40px_rgba(12,11,93,0.25)] hover:scale-[1.02] active:scale-98 disabled:opacity-50 flex items-center justify-center gap-3 ${
            light ? "bg-[#0c0b5d] text-white" : "bg-white text-[#0c0b5d]"
          }`}
        >
          {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Send Code"}
        </button>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm font-bold text-gray-500 hover:text-[#0c0b5d] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </div>
    </form>
  );

  const renderOtpStep = () => (
    <form onSubmit={handleOtpSubmit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1
          className="text-[32px] md:text-[40px] font-black leading-tight tracking-tight text-center md:text-left"
          style={{ color: light ? "#0f172a" : "#ffffff" }}
        >
          Verify OTP
        </h1>
        <p
          className="text-lg font-medium leading-relaxed text-center md:text-left"
          style={{ color: light ? "#475569" : "#94A3B8" }}
        >
          Enter the 6-digit code sent to <span className="font-bold text-[#0c0b5d]">{phoneNumber}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      )}

      <InputField
        id="otp"
        label="Verification Code"
        type="text"
        placeholder="123456"
        icon={<KeyRound size={20} />}
        light={light}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        disabled={isLoading}
      />

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          className={`w-full h-[64px] text-lg rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 shadow-[0_8px_30px_rgb(12,11,93,0.12)] hover:shadow-[0_20px_40px_rgba(12,11,93,0.25)] hover:scale-[1.02] active:scale-98 flex items-center justify-center gap-3 ${
            light ? "bg-[#0c0b5d] text-white" : "bg-white text-[#0c0b5d]"
          }`}
        >
          Verify Code
        </button>

        <button
          type="button"
          onClick={() => setStep("phone")}
          className="text-sm font-bold text-gray-500 hover:text-[#0c0b5d] transition-colors"
        >
          Change Phone Number
        </button>
      </div>
    </form>
  );

  const renderResetStep = () => (
    <form onSubmit={handleResetSubmit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1
          className="text-[32px] md:text-[40px] font-black leading-tight tracking-tight text-center md:text-left"
          style={{ color: light ? "#0f172a" : "#ffffff" }}
        >
          New Password
        </h1>
        <p
          className="text-lg font-medium leading-relaxed text-center md:text-left"
          style={{ color: light ? "#475569" : "#94A3B8" }}
        >
          Create a strong password to secure your account.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <InputField
          id="newPassword"
          label="New Password"
          type="password"
          placeholder="••••••••"
          icon={<Lock size={20} />}
          light={light}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isLoading}
        />

        <InputField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          icon={<CheckCircle2 size={20} />}
          light={light}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`w-full h-[64px] text-lg rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 shadow-[0_8px_30px_rgb(12,11,93,0.12)] hover:shadow-[0_20px_40px_rgba(12,11,93,0.25)] hover:scale-[1.02] active:scale-98 disabled:opacity-50 flex items-center justify-center gap-3 ${
          light ? "bg-[#0c0b5d] text-white" : "bg-white text-[#0c0b5d]"
        }`}
      >
        {isLoading ? <Loader2 size={20} className="animate-spin" /> : "Reset Password"}
      </button>
    </form>
  );

  return (
    <div className="w-full">
      {step === "phone" && renderPhoneStep()}
      {step === "otp" && renderOtpStep()}
      {step === "reset" && renderResetStep()}
    </div>
  );
}
