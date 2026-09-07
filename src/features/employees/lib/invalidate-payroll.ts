import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalida listados de nómina tras crear o pagar lotes de producción.
 *
 * La app usa `staleTime` de 1 minuto: sin esto, Empleados muestra la nómina
 * diaria cacheada al entrar justo después de marcar una línea como Listo.
 *
 * @param queryClient - Cliente de TanStack Query.
 */
export async function invalidatePayrollQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["payroll-daily"] }),
    queryClient.invalidateQueries({ queryKey: ["employees", "unpaid"] }),
    queryClient.invalidateQueries({ queryKey: ["employees", "payroll-history"] }),
    queryClient.invalidateQueries({ queryKey: ["employees", "batches"] }),
    queryClient.invalidateQueries({ queryKey: ["reports", "payroll"] }),
  ]);
}
