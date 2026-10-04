interface CheckboxProps {
  id: string;
  label: React.ReactNode;
  light?: boolean;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export default function Checkbox({
  id,
  label,
  light = false,
  checked = false,
  onChange,
  disabled = false,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex flex-row items-start gap-3 cursor-pointer px-1 pt-2 ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className={`h-5 w-5 accent-[#0c0b5d] ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          style={{
            background: light ? "#FFFFFF" : "rgba(255,255,255,0.05)",
            border: light
              ? "1px solid #D1D5DB"
              : "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
          }}
        />
      </div>
      <div className="text-sm font-normal leading-[18px]">{label}</div>
    </label>
  );
}
