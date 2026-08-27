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

/**
 * Formato a usar en un selector de ítem: el actual si es válido; si no, «Sin formato».
 * Nunca cae al primer formato de impresión (p. ej. 10x12).
 *
 * @param formats - Formatos del catálogo.
 * @param currentId - Id ya elegido (puede ser null).
 * @returns Id a mostrar, o `null` si «Sin formato» aún no está en la lista.
 */
export function resolveFormatSelection(
  formats: ReadonlyArray<{ id: number; label: string }>,
  currentId: number | null | undefined,
): number | null {
  const sinFormato = formats.find((formato) => isSinFormatoLabel(formato.label));
  if (
    currentId != null &&
    currentId > 0 &&
    formats.some((formato) => formato.id === currentId)
  ) {
    return currentId;
  }
  return sinFormato?.id ?? null;
}

/**
 * Opciones del selector de formato en inventario: activos + «Sin formato», con esa opción primero.
 *
 * @param formats - Catálogo (puede incluir inactivos).
 * @returns Lista para el `<select>`.
 */
export function formatsForItemSelect<
  T extends { id: number; label: string; isActive?: boolean },
>(formats: readonly T[]): T[] {
  const included = formats.filter(
    (formato) => formato.isActive !== false || isSinFormatoLabel(formato.label),
  );
  return [...included].sort((a, b) => {
    const aSin = isSinFormatoLabel(a.label);
    const bSin = isSinFormatoLabel(b.label);
    if (aSin !== bSin) {
      return aSin ? -1 : 1;
    }
    return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
  });
}
