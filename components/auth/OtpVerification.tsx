"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";
import { BRAND } from "@/constants";
import { verifyOTP, resendOTP } from "@/lib/api/auth";
import { toast } from "sonner";

interface OtpVerificationProps {
  phoneNumber: string;
  onSuccess: () => void;
  onBack: () => void;
  light?: boolean;
}

export default function OtpVerification({
  phoneNumber,
  onSuccess,
  onBack,
  light = false,
}: OtpVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take the last character
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);
    
    // Focus last or next empty
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join("");
    
    if (fullOtp.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await verifyOTP(phoneNumber, fullOtp);
      toast.success("Phone number verified successfully!");
      onSuccess();
    } catch (err) {
      console.error("Verification error:", err);
      const msg = err instanceof Error ? err.message : "Invalid code. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || isResending) return;

    setIsResending(true);
    try {
      await resendOTP(phoneNumber);
      toast.success("A new verification code has been sent!");
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error("Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // Auto-submit when all digits are entered
  useEffect(() => {
    if (otp.every(digit => digit !== "") && !isLoading) {
      handleSubmit();
    }
  }, [otp]);

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col gap-3">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-[#0c0b5d] transition-colors w-fit mb-2 cursor-pointer group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Back to Signup</span>
        </button>
        
        <h1
          className="text-3xl font-black leading-tight tracking-tight text-center md:text-left md:text-4xl"
          style={{ color: light ? "#0f172a" : BRAND.textPrimary }}
        >
          Verify Phone
        </h1>
        <p
          className="text-base font-medium leading-relaxed text-center md:text-left"
          style={{ color: light ? "#475569" : BRAND.primaryMuted }}
        >
          We've sent a 6-digit code to <span className="text-[#0c0b5d] font-bold">+{phoneNumber}</span>
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* OTP Inputs */}
      <div className="flex flex-col gap-8">
        <div className="flex justify-between gap-2 md:gap-4">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              className={`w-full h-14 md:h-16 text-center text-2xl font-black rounded-2xl border-2 transition-all outline-none ${
                digit 
                  ? "border-[#0c0b5d] bg-blue-50/50 text-[#0c0b5d]" 
                  : "border-slate-100 bg-slate-50 text-slate-400 focus:border-[#0c0b5d] focus:bg-white"
              } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-6">
          <button
            onClick={() => handleSubmit()}
            disabled={isLoading || otp.some(d => !d)}
            className={`w-full h-[64px] text-lg rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-[0_8px_30px_rgb(12,11,93,0.12)] hover:shadow-[0_20px_40px_rgba(12,11,93,0.25)] hover:scale-[1.02] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 ${
              light
                ? "bg-[#0c0b5d] text-white border-none hover:bg-[#FA6400]"
                : "bg-white text-[#0c0b5d] border-2 border-[#0c0b5d] hover:bg-[#0c0b5d] hover:text-white"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </button>

          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-medium text-slate-400">Didn't receive the code?</span>
            <button
              onClick={handleResend}
              disabled={timer > 0 || isResending}
              className={`text-sm font-bold flex items-center gap-2 transition-colors ${
                timer > 0 || isResending 
                  ? "text-slate-300 cursor-not-allowed" 
                  : "text-[#0c0b5d] hover:text-[#FA6400] cursor-pointer"
              }`}
            >
              {isResending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
