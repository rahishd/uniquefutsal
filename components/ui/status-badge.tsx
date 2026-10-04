"use client";

interface StatusBadgeProps {
  label: string;
  dotClassName?: string;
  className?: string;
}

export default function StatusBadge({ label, dotClassName, className }: StatusBadgeProps) {
  return (
    <div 
      className={`flex flex-row items-center gap-3 rounded-full border px-5 py-2 backdrop-blur-md transition-all hover:scale-105 group ${className}`}
      style={{ 
        background: "rgba(250, 100, 0, 0.05)", 
        borderColor: "rgba(250, 100, 0, 0.2)" 
      }}
    >
      <div className="relative flex h-2.5 w-2.5 items-center justify-center">
        <div className={`absolute h-full w-full animate-ping rounded-full bg-[#FA6400] opacity-40 ${dotClassName}`} />
        <div className={`relative h-2 w-2 rounded-full bg-[#FA6400] shadow-[0_0_10px_rgba(250,100,0,0.5)] ${dotClassName}`} />
      </div>
      <span className="text-[11px] md:text-xs font-black uppercase tracking-[0.2em] text-[#FA6400] drop-shadow-sm group-hover:tracking-[0.25em] transition-all duration-300">
        {label}
      </span>
    </div>
  );
}
