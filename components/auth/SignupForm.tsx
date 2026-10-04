"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InputField from "@/components/ui/input-field";
import Checkbox from "@/components/ui/checkbox";
import {
  User,
  Phone,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { BRAND, APP } from "@/constants";
import { signup, checkPhone } from "@/lib/api/auth";
import { toast } from "sonner";
import OtpVerification from "./OtpVerification";

interface SignupFormProps {
  light?: boolean;
}

export default function SignupForm({ light = false }: SignupFormProps) {
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [userPhone, setUserPhone] = useState("");
  const [isPreFilled, setIsPreFilled] = useState(false);

  const handleCheckPhone = async (phone: string) => {
    if (phone.length < 10) return;
    
    try {
      const data = await checkPhone(phone);
      if (data.exists) {
        if (data.isVerified) {
          setError("This phone number is already registered. Please login instead.");
          toast.error("Already registered! Please login.");
          return;
        }
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        setIsPreFilled(true);
        toast.info("Welcome back! We've found your details from your previous visit.");
      } else {
        // Reset if it was pre-filled before but now checking a new number that doesn't exist
        if (isPreFilled) {
          setIsPreFilled(false);
          // setName(""); // Maybe don't reset name/email to avoid annoying the user if they were typing
          // setEmail("");
        }
      }
    } catch (err) {
      console.error("Phone check error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!phoneNumber.trim()) {
      setError("Please enter your phone number");
      return;
    }

    if (email.trim() && !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the Terms & Conditions");
      return;
    }

    setIsLoading(true);

    try {
      const response = await signup({
        email: email.trim() || undefined,
        password,
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      setUserPhone(phoneNumber.trim());
      setSuccess(true);
      toast.success("Account created! Please verify your phone number.");

      // Switch to OTP view
      setTimeout(() => {
        setShowOtp(true);
      }, 800);
    } catch (err) {
      console.error("Signup error:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const termsLabel = (
    <span className={`text-sm ${light ? "text-gray-500" : "text-[#94A3B8]"}`}>
      I agree to the{" "}
      <a
        href="#"
        className="font-semibold underline underline-offset-4 hover:text-[#FA6400] transition-colors"
        style={{ color: light ? BRAND.primary : BRAND.secondary }}
      >
        Terms &amp; Conditions
      </a>{" "}
      and{" "}
      <a
        href="#"
        className="font-semibold underline underline-offset-4 hover:text-[#FA6400] transition-colors"
        style={{ color: light ? BRAND.primary : BRAND.secondary }}
      >
        Privacy Policy
      </a>
    </span>
  );

  if (showOtp) {
    return (
      <OtpVerification 
        phoneNumber={userPhone}
        light={light}
        onBack={() => setShowOtp(false)}
        onSuccess={() => {
          toast.success("Verification complete! Welcome to Unique Futsal.");
          router.push("/booking");
        }}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-6 md:gap-8"
    >
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1
          className="text-3xl font-black leading-tight tracking-tight text-center md:text-left md:text-4xl"
          style={{ color: light ? "#0f172a" : BRAND.textPrimary }}
        >
          Create Your Account
        </h1>
        <p
          className="text-base font-medium leading-relaxed text-center md:text-left"
          style={{ color: light ? "#475569" : BRAND.primaryMuted }}
        >
          {APP.tagline}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-600 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
          <p className="text-green-600 font-medium text-sm">
            Account created successfully! Redirecting...
          </p>
        </div>
      )}

      {/* Form Fields Container */}
      <div className="flex flex-col gap-5">
        {/* Row 1: Name and Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <InputField
            id="fullname"
            label="Full Name"
            type="text"
            placeholder="John Doe"
            icon={<User size={18} />}
            light={light}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading || (isPreFilled && !!name)}
          />

          <InputField
            id="phone"
            label="Phone Number"
            type="tel"
            placeholder="98XXXXXXXX"
            icon={<Phone size={18} />}
            light={light}
            value={phoneNumber}
            onChange={(e) => {
              const val = e.target.value;
              setPhoneNumber(val);
              // Auto-check when 10 digits are entered
              if (val.length === 10) {
                handleCheckPhone(val);
              }
            }}
            onBlur={() => {
              if (phoneNumber.length >= 10) {
                handleCheckPhone(phoneNumber);
              }
            }}
            required
          />
        </div>

        {/* Row 2: Email */}
        <InputField
          id="email"
          label="Email Address (Optional)"
          type="email"
          placeholder="example@domain.com (Optional)"
          icon={<Mail size={18} />}
          light={light}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading || (isPreFilled && !!email)}
        />

        {/* Row 3: Password */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <InputField
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            icon={<Lock size={18} />}
            light={light}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />

          <InputField
            id="confirm-password"
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            icon={<Lock size={18} />}
            light={light}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="py-1">
          <Checkbox
            id="terms"
            label={termsLabel}
            light={light}
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            disabled={isLoading}
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || success}
            className={`w-full h-[64px] text-lg rounded-[20px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-[0_8px_30px_rgb(12,11,93,0.12)] hover:shadow-[0_20px_40px_rgba(12,11,93,0.25)] hover:scale-[1.02] active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 ${
              light
                ? "bg-[#0c0b5d] text-white border-none hover:bg-[#FA6400]"
                : "bg-white text-[#0c0b5d] border-2 border-[#0c0b5d] hover:bg-[#0c0b5d] hover:text-white"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Creating Account...
              </>
            ) : success ? (
              <>
                <CheckCircle2 size={20} />
                Success!
              </>
            ) : (
              "Get Started Now"
            )}
          </button>
        </div>
      </div>

      {/* Footer redirection link */}
      <div className="flex flex-col items-center justify-center gap-2 lg:flex-row lg:gap-2 pt-4 border-t border-gray-100">
        <span
          className={`text-sm font-medium ${light ? "text-gray-400" : "text-[#94A3B8]"}`}
        >
          Existing player?
        </span>
        <Link
          href="/login"
          className="group flex items-center gap-1 text-sm font-bold transition-all"
          style={{ color: light ? BRAND.primary : BRAND.secondary }}
        >
          Login to dashboard
          <span className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </form>
  );
}
