import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/db/queries/invoices";
import { fetchInventoryItems } from "@/db/queries/inventory";
import type { NavBadgeKey } from "@/config/navigation";

/**
 * Conteos para los badges del sidebar.
 */
export type SidebarBadges = Record<NavBadgeKey, number>;

/**
 * Calcula los contadores de los badges del sidebar (pedidos pendientes de cobro,
 * ítems en stock bajo). Tolerante a fallos: si una fuente no está disponible
 * devuelve 0 para ese badge.
 *
 * @returns Mapa de contadores por clave de badge.
 */
export function useSidebarBadges(): SidebarBadges {
  const invoicesQuery = useQuery({
    queryKey: ["invoices", "list"],
    queryFn: fetchInvoices,
    staleTime: 30_000,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
    staleTime: 30_000,
  });

  const pedidosPendientes = (invoicesQuery.data ?? []).filter(
    (invoice) => invoice.productionStatus === "en_produccion",
  ).length;
  const stockListo = (invoicesQuery.data ?? []).filter(
    (invoice) => invoice.productionStatus === "listo" && invoice.paymentStatus === "pendiente",
  ).length;
  const facturasPendientes = (invoicesQuery.data ?? []).filter(
    (invoice) => invoice.balance > 1e-6 && invoice.status !== "anulada",
  ).length;
  const stockBajo = (inventoryQuery.data ?? []).filter((item) => item.lowStock).length;

  return {
    pedidosPendientes,
    stockListo,
    facturasPendientes,
    stockBajo,
  };
}
