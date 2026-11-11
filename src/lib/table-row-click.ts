const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, [role='button'], [data-no-row-click]";

/**
 * Indica si el origen del evento es un control que debe conservar su clic.
 *
 * @param target - Nodo que recibió el evento.
 * @returns `true` si es enlace, botón u otro control interactivo.
 */
export function isInteractiveEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest(INTERACTIVE_SELECTOR) !== null;
}

/**
 * Evita abrir el detalle de una fila cuando el usuario usa un control interno
 * o está seleccionando texto.
 *
 * @param event - Evento de clic con `target`.
 * @returns `true` si la fila no debe navegar.
 */
export function shouldIgnoreRowActivation(event: { target: EventTarget | null }): boolean {
  if (isInteractiveEventTarget(event.target)) {
    return true;
  }
  const selected = typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
  return Boolean(selected);
}
