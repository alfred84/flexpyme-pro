import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Convierte la ruta absoluta del logo en una URL cargable por el webview de Tauri.
 * Opcionalmente añade un parámetro de versión para evitar caché tras reemplazar el archivo.
 *
 * @param path - Ruta absoluta almacenada en settings (`business_logo_path`).
 * @param cacheKey - Marca de versión (p. ej. `business_logo_version`).
 * @returns URL del protocolo asset o null si no hay ruta.
 */
export function businessLogoUrl(path: string | null | undefined, cacheKey?: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }
  const base = convertFileSrc(trimmed.replace(/\\/g, "/"));
  if (!cacheKey?.trim()) {
    return base;
  }
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}v=${encodeURIComponent(cacheKey.trim())}`;
}
