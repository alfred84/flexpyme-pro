/** Etiqueta del formato base para categorías sin medidas. */
export const SIN_FORMATO_LABEL = "Sin formato";

/**
 * Indica si una etiqueta corresponde al formato base «Sin formato».
 *
 * @param label - Etiqueta del formato.
 * @returns `true` si es el formato base.
 */
export function isSinFormatoLabel(label: string | null | undefined): boolean {
  return (label ?? "").trim().toLowerCase() === SIN_FORMATO_LABEL.toLowerCase();
}
