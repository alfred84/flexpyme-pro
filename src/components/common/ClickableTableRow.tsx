import { type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { shouldIgnoreRowActivation } from "@/lib/table-row-click";

interface ClickableTableRowProps {
  /** Celdas de la fila. */
  children: ReactNode;
  /** Abre el detalle que antes mostraba el botón Ver. */
  onOpen: () => void;
  /** Nombre accesible, p. ej. «Ver pedido FAC-001». */
  ariaLabel: string;
  /** Clases extra (estados de alerta, inactivo, etc.). */
  className?: string;
}

const ROW_CLASS_NAME =
  "hover cursor-pointer transition-colors duration-150 focus-visible:bg-base-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

/**
 * Fila de tabla que abre el detalle al hacer clic o al pulsar Enter/Espacio.
 *
 * Los botones, enlaces y campos internos conservan su clic (no navegan al detalle).
 *
 * @param props - Contenido, navegación y etiqueta accesible.
 * @returns Fila `<tr>` con hover y foco de teclado.
 */
export function ClickableTableRow(props: ClickableTableRowProps) {
  const { children, onOpen, ariaLabel, className = "" } = props;

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (shouldIgnoreRowActivation(event)) {
      return;
    }
    onOpen();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onOpen();
  };

  return (
    <tr
      tabIndex={0}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`${ROW_CLASS_NAME} ${className}`.trim()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </tr>
  );
}
