import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface ModalPortalProps {
  children: ReactNode;
}

/**
 * Renderiza el modal en `document.body` para que el backdrop cubra toda la
 * ventana de la app (fuera de sidebar, header y el scroll de `<main>`).
 *
 * @param props - Contenido del modal (normalmente un `<dialog className="modal">`).
 * @returns Portal a `document.body`, o `null` en SSR.
 */
export function ModalPortal(props: ModalPortalProps) {
  const { children } = props;
  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(children, document.body);
}
