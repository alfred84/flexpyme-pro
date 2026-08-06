import { useCallback, useEffect, useMemo, useState } from "react";
import type { OnChangeFn, PaginationState } from "@tanstack/react-table";

/** Tamaño de página por defecto para listados client-side. */
export const DEFAULT_PAGE_SIZE = 10;

interface UseClientPaginationOptions {
  /** Elementos por página (default 10). */
  pageSize?: number;
  /**
   * Clave que, al cambiar, vuelve a la primera página
   * (p. ej. filtro + búsqueda).
   */
  resetKey?: string | number;
  /** Total de ítems; si el índice queda fuera de rango, se ajusta. */
  itemCount?: number;
}

interface UseClientPaginationResult {
  /** Estado de paginación compatible con TanStack Table. */
  pagination: PaginationState;
  /** Setter compatible con `onPaginationChange` de TanStack Table. */
  onPaginationChange: OnChangeFn<PaginationState>;
  /** Vuelve a la página 0. */
  resetPage: () => void;
}

/**
 * Estado de paginación client-side (0-based) para tablas TanStack.
 *
 * @param options - Tamaño de página, clave de reset y conteo opcional.
 * @returns Estado y handlers de paginación.
 */
export function useClientPagination(
  options: UseClientPaginationOptions = {},
): UseClientPaginationResult {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  useEffect(() => {
    setPagination((prev) =>
      prev.pageSize === pageSize ? prev : { ...prev, pageSize, pageIndex: 0 },
    );
  }, [pageSize]);

  useEffect(() => {
    if (options.resetKey === undefined) {
      return;
    }
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [options.resetKey]);

  useEffect(() => {
    if (options.itemCount === undefined) {
      return;
    }
    const maxIndex = Math.max(0, Math.ceil(options.itemCount / pagination.pageSize) - 1);
    setPagination((prev) =>
      prev.pageIndex > maxIndex ? { ...prev, pageIndex: maxIndex } : prev,
    );
  }, [options.itemCount, pagination.pageSize]);

  const resetPage = useCallback(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, []);

  return useMemo(
    () => ({
      pagination,
      onPaginationChange: setPagination,
      resetPage,
    }),
    [pagination, resetPage],
  );
}
