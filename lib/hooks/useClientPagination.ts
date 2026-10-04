import { useEffect, useMemo, useState } from "react";

interface UseClientPaginationOptions {
  /** Rows per page. Defaults to 10. */
  defaultLimit?: number;
  /**
   * Values that reset the page back to 1 when they change
   * (e.g. search text, active filter). Pass primitives.
   */
  resetKeys?: unknown[];
}

/**
 * Generic client-side pagination for already-fetched arrays.
 * Use for bounded admin lists (expenses, memberships, inventory logs…)
 * where the backend returns the full list.
 *
 * Server-side pagination (bookings ledger, players, audit logs)
 * is preferred for high-volume data.
 */
export function useClientPagination<T>(
  items: T[],
  options?: UseClientPaginationOptions,
) {
  const defaultLimit = options?.defaultLimit ?? 10;
  const resetKeys = options?.resetKeys ?? [];

  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(defaultLimit);

  // Reset to first page whenever filters/search change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetKeys);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * limit;
    return items.slice(start, start + limit);
  }, [items, safePage, limit]);

  const setLimit = (next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setLimitState(next);
    setPage(1);
  };

  return {
    page: safePage,
    setPage,
    limit,
    setLimit,
    total,
    totalPages,
    pageItems,
  };
}
