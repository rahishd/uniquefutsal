import { ReactNode, InputHTMLAttributes, useState } from "react";
import { BRAND } from "@/constants";
import { Eye, EyeOff } from "lucide-react";

interface InputFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type"
> {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  icon: ReactNode;
  labelSuffix?: ReactNode;
  light?: boolean;
}

export default function InputField({
  id,
  label,
  type = "text",
  placeholder,
  icon,
  labelSuffix,
  light = false,
  value,
  onChange,
  required,
  disabled,
  ...rest
}: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === "password";
  const inputType = isPasswordType && showPassword ? "text" : type;

  return (
    <div className="flex flex-col gap-2.5">
      <label
        className={`pl-1 text-sm font-black uppercase tracking-widest ${light ? "text-[#0c0b5d]/60" : "text-[#94A3B8]"}`}
        htmlFor={id}
      >
        {label}
        {labelSuffix && (
          <span className="font-medium ml-1 normal-case tracking-normal opacity-50">
            {labelSuffix}
          </span>
        )}
      </label>

      <div className="relative group">
        {/* Leading icon */}
        <span
          className={`pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 transition-all duration-300 ${
            light
              ? "text-slate-400 group-focus-within:text-[#FA6400] group-focus-within:scale-110"
              : "text-gray-500 group-focus-within:text-[#FA6400]"
          }`}
        >
          {icon}
        </span>

        <input
          id={id}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className={`w-full rounded-2xl border py-5 pl-14 ${isPasswordType ? "pr-12" : "pr-5"} text-base font-medium outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
            light
              ? "bg-white border-slate-100 placeholder:text-slate-300 text-[#0c0b5d] focus:border-[#0c0b5d]/30 focus:shadow-[0_10px_30px_-10px_rgba(12,11,93,0.1)]"
              : "bg-white/5 border-white/5 placeholder:text-gray-600 text-white focus:border-[#0c0b5d]/50 focus:bg-white/10"
          }`}
          {...rest}
        />

        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute right-5 top-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-110 ${
              light
                ? "text-slate-400 hover:text-[#0c0b5d]"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {/* Focus indicator bar (optional/premium touch) */}
        <div
          className={`absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-[#FA6400] transition-all duration-500 group-focus-within:w-[40%] opacity-50`}
        />
      </div>
    </div>
  );
}
