import { ChevronLeft, ChevronRight } from "lucide-react";
import { DEFAULT_PAGE_SIZE } from "@/hooks/use-client-pagination";

interface TablePaginationProps {
  /** Índice de página actual (0-based). */
  pageIndex: number;
  /** Elementos por página. */
  pageSize?: number;
  /** Total de elementos del listado filtrado. */
  totalItems: number;
  /** Cambia la página (0-based). */
  onPageChange: (pageIndex: number) => void;
  /** Si se indica, muestra selector de tamaño de página. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Opciones del selector de tamaño (solo si hay `onPageSizeChange`). */
  pageSizeOptions?: number[];
  /** Clase CSS adicional del contenedor. */
  className?: string;
  /** Etiqueta accesible del bloque. */
  label?: string;
}

/**
 * Controles de paginación reutilizables (DaisyUI) para tablas y listados.
 * Por defecto pagina de 10 en 10; el tamaño es configurable.
 *
 * @param props - Estado y callbacks de paginación.
 */
export function TablePagination(props: TablePaginationProps) {
  const {
    pageIndex,
    pageSize = DEFAULT_PAGE_SIZE,
    totalItems,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50],
    className = "",
    label = "Paginación",
  } = props;

  if (totalItems <= 0) {
    return null;
  }

  const safeSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(totalItems / safeSize));
  const safeIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const from = safeIndex * safeSize + 1;
  const to = Math.min(totalItems, (safeIndex + 1) * safeSize);
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < pageCount - 1;

  return (
    <nav
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
      aria-label={label}
    >
      <p className="text-sm text-base-content/70">
        Mostrando{" "}
        <span className="font-medium text-base-content">
          {from}–{to}
        </span>{" "}
        de <span className="font-medium text-base-content">{totalItems}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-sm text-base-content/70">
            <span className="whitespace-nowrap">Por página</span>
            <select
              className="select select-bordered select-sm w-20"
              value={safeSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Elementos por página"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="join">
          <button
            type="button"
            className="btn btn-sm join-item"
            disabled={!canPrev}
            onClick={() => onPageChange(safeIndex - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="btn btn-sm join-item pointer-events-none no-animation font-normal">
            {safeIndex + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-sm join-item"
            disabled={!canNext}
            onClick={() => onPageChange(safeIndex + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
