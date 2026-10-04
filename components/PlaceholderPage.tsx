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
      <span className="glass flex h-20 w-20 items-center justify-center rounded-3xl text-brand">
        <Icon size={34} />
      </span>
      <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">{note}</p>
    </div>
  );
}
