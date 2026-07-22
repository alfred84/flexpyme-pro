import {
  Album,
  Book,
  BookOpen,
  Box,
  Image,
  Key,
  Layers,
  RectangleHorizontal,
  Tag,
  Type,
  type LucideIcon,
} from "lucide-react";

/**
 * Iconos Lucide admitidos para categorías de producto.
 */
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Image,
  Layers,
  BookOpen,
  Album,
  Box,
  Type,
  Book,
  RectangleHorizontal,
  Key,
  Tag,
};

/**
 * Resuelve el componente de icono de una categoría.
 *
 * @param iconName - Nombre guardado en `product_categories.icon`.
 * @returns Icono Lucide (Tag por defecto).
 */
export function resolveCategoryIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) {
    return Tag;
  }
  return CATEGORY_ICON_MAP[iconName] ?? Tag;
}

/**
 * Fondos suaves rotativos para el mosaico de categorías.
 */
export const CATEGORY_MOSAIC_TONES = [
  "bg-primary/15 hover:bg-primary/25 border-primary/30",
  "bg-secondary/15 hover:bg-secondary/25 border-secondary/30",
  "bg-accent/15 hover:bg-accent/25 border-accent/30",
  "bg-info/15 hover:bg-info/25 border-info/30",
  "bg-success/15 hover:bg-success/25 border-success/30",
  "bg-warning/15 hover:bg-warning/25 border-warning/30",
] as const;

/**
 * Devuelve una clase de tono para el mosaico según el índice.
 *
 * @param index - Índice de la tarjeta.
 * @returns Clases Tailwind/DaisyUI.
 */
export function categoryMosaicTone(index: number): string {
  return CATEGORY_MOSAIC_TONES[index % CATEGORY_MOSAIC_TONES.length] ?? CATEGORY_MOSAIC_TONES[0];
}
