import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { businessLogoUrl } from "@/lib/business-logo-url";

type BusinessLogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<BusinessLogoSize, string> = {
  sm: "h-9 w-9",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

interface BusinessLogoProps {
  path: string | null;
  /** Valor de `business_logo_version` para invalidar caché del webview. */
  version?: string | null;
  size?: BusinessLogoSize;
  alt?: string;
  fallbackIcon: LucideIcon;
  className?: string;
}

/**
 * Muestra el icono del negocio con fondo neutro y recorte uniforme.
 *
 * @param props - Ruta del archivo, tamaño y icono de respaldo si falla la carga.
 * @returns Contenedor cuadrado con imagen o icono placeholder.
 */
export function BusinessLogo(props: BusinessLogoProps) {
  const { path, version, size = "md", alt = "Logo del negocio", fallbackIcon: FallbackIcon, className = "" } =
    props;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [path, version]);

  const src = businessLogoUrl(path, version);
  const sizeClass = SIZE_CLASSES[size];

  if (!src || failed) {
    return (
      <span
        className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-base-300 bg-base-100 ${sizeClass} ${className}`}
      >
        <FallbackIcon className={size === "sm" ? "h-5 w-5 text-base-content/50" : "h-8 w-8 text-base-content/40"} />
      </span>
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-base-300 bg-base-100 p-1 ${sizeClass} ${className}`}
    >
      <img
        key={`${path ?? ""}-${version ?? ""}`}
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
