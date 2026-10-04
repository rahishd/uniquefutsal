"use client";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  /** Noun for the count label, e.g. "records", "entries". Defaults to "records". */
  noun?: string;
  limitOptions?: number[];
}

/**
 * Shared Prev/Next pagination controls, styled to match the bookings ledger.
 * For client-side paginated lists; the bookings ledger keeps its own
 * server-driven controls.
 */
export function PaginationControls({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  noun = "records",
  limitOptions = [10, 20, 50, 100],
}: PaginationControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {total > 0 ? `${total} ${noun}` : `0 ${noun}`}
      </div>

      {onLimitChange && (
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
          aria-label="Rows per page"
        >
          {limitOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt} / page
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
        >
          Prev
        </button>
        <div className="text-xs font-black text-[#0c0b5d] min-w-[88px] text-center">
          {page} / {totalPages}
        </div>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}
