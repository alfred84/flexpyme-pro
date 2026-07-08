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
 * Indica si el servicio de una línea corresponde al código de tipo de trabajo.
 *
 * @param service - Servicio de la línea del pedido.
 * @param workTypeCode - Código del tipo de trabajo (`laminado`, `impresion`, etc.).
 * @returns Verdadero si el servicio encaja con el tipo de trabajo.
 */
export function serviceMatchesWorkType(service: string | null, workTypeCode: string): boolean {
  if (!service?.trim()) {
    return false;
  }
  const normalizedService = normalizeServiceToken(service);
  const normalizedCode = normalizeServiceToken(workTypeCode);
  return (
    normalizedService === normalizedCode ||
    normalizedService.includes(normalizedCode) ||
    normalizedCode.includes(normalizedService)
  );
}
