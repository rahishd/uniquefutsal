import type { LucideIcon } from "lucide-react";

export default function PlaceholderPage({
  icon: Icon,
  title,
  note,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Icon size={30} />
      </span>
      <h1 className="font-heading mt-5 text-3xl font-bold">{title}</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-400">{note}</p>
    </div>
  );
}
