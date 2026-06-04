import { useEffect, useState } from "react";

/**
 * Temas DaisyUI soportados. `business` es el dark profesional por defecto.
 */
export type ThemeName = "business" | "light";

export const THEME_STORAGE_KEY = "flexpyme.theme";
export const DEFAULT_THEME: ThemeName = "business";

/**
 * Lee el tema persistido (o el dark por defecto) y lo sincroniza con
 * `document.documentElement[data-theme]` y `localStorage`.
 *
 * @returns Tema actual y setter para cambiarlo.
 */
export function useTheme(): { theme: ThemeName; setTheme: (theme: ThemeName) => void } {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_THEME;
    }
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" ? "light" : DEFAULT_THEME;
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }, [theme]);

  return { theme, setTheme };
}
