/**
 * Genera un slug interno a partir de un nombre visible.
 *
 * @param value - Texto de entrada.
 * @returns Código en minúsculas con guiones.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
