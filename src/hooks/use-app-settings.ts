import { useQuery } from "@tanstack/react-query";
import { fetchAllSettings } from "@/db/queries/settings";

/**
 * Valores de configuración usados de forma transversal en la app.
 */
export interface AppSettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessLogoPath: string | null;
  businessLogoVersion: string | null;
  usdExchangeRate: number;
}

/**
 * Lee la configuración global (settings key-value) y expone los campos más usados
 * con valores por defecto seguros.
 *
 * @returns Configuración de la aplicación.
 */
export function useAppSettings(): AppSettings {
  const query = useQuery({
    queryKey: ["settings", "all"],
    queryFn: fetchAllSettings,
    staleTime: 60_000,
  });

  const data = query.data ?? {};
  return {
    businessName: data.business_name || data.company_name || "Taller Gráfico",
    businessAddress: data.business_address || data.company_address || "",
    businessPhone: data.business_phone || data.company_phone || "",
    businessLogoPath: data.business_logo_path?.trim() || null,
    businessLogoVersion: data.business_logo_version?.trim() || null,
    usdExchangeRate: Number(data.usd_exchange_rate ?? "0") || 0,
  };
}
