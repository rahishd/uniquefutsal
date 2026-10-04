import { Star } from "lucide-react";
import { MIN_GAMES_FOR_RATING } from "@/lib/teams";

// 5-star rating with partial fill, or "Unrated" for new teams.
export default function Stars({ rating, size = 16, showNumber = true }: { rating: number | null; size?: number; showNumber?: boolean }) {
  if (rating === null) {
    return <span className="text-xs text-slate-400">Unrated · needs {MIN_GAMES_FOR_RATING} games</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`${rating} out of 5 stars`}>
      <span className="relative inline-flex" aria-hidden>
        <span className="flex text-slate-300">
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} />)}
        </span>
        <span className="absolute inset-y-0 left-0 flex overflow-hidden text-amber-400" style={{ width: `${(rating / 5) * 100}%` }}>
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={size} className="shrink-0 fill-current" />)}
        </span>
      </span>
      {showNumber && <span className="text-sm font-semibold">{rating.toFixed(1)}</span>}
    </span>
  );
}
