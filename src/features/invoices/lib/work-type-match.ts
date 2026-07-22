/**
 * Normaliza texto de servicio para comparar con códigos de tipo de trabajo.
 */
function normalizeServiceToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Indica si el servicio/tipo de una línea corresponde a un tipo de trabajo.
 *
 * @param service - Valor de `invoice_items.service` (nombre del tipo).
 * @param workTypeCode - Código del tipo (`laminado`, `impresion`, etc.).
 * @param workTypeName - Nombre visible del tipo (opcional, mejora el match).
 * @returns Verdadero si el servicio encaja con el tipo de trabajo.
 */
export function serviceMatchesWorkType(
  service: string | null,
  workTypeCode: string,
  workTypeName?: string,
): boolean {
  if (!service?.trim()) {
    return false;
  }
  const normalizedService = normalizeServiceToken(service);
  const candidates = [workTypeCode, workTypeName]
    .filter((v): v is string => Boolean(v?.trim()))
    .map(normalizeServiceToken);
  return candidates.some(
    (token) =>
      normalizedService === token ||
      normalizedService.includes(token) ||
      token.includes(normalizedService),
  );
}
