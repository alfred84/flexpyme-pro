import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchProductionBatches } from "@/db/queries/production";
import { formatMoney } from "@/lib/format-money";

export function ProductionListPage() {
  const batchesQuery = useQuery({
    queryKey: ["production", "list"],
    queryFn: fetchProductionBatches,
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Producción</h1>
        <Link to="/produccion/nueva" className="btn btn-primary btn-sm sm:btn-md">
          Nuevo lote
        </Link>
      </div>

      {batchesQuery.isLoading && <p>Cargando lotes...</p>}
      {batchesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los lotes de producción.</span>
        </div>
      )}

      {batchesQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Operario</th>
                <th className="text-right">Costo total</th>
                <th className="text-right">Pagado</th>
                <th className="text-right">Pendiente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {batchesQuery.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-base-content/60">
                    No hay lotes registrados.
                  </td>
                </tr>
              ) : (
                batchesQuery.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.type}</td>
                    <td>{row.workerName ?? "—"}</td>
                    <td className="text-right">{formatMoney(row.totalCost)}</td>
                    <td className="text-right">{formatMoney(row.paid)}</td>
                    <td className="text-right">{formatMoney(row.pending)}</td>
                    <td>
                      <Link
                        className="btn btn-xs btn-outline"
                        to="/produccion/$batchId"
                        params={{ batchId: String(row.id) }}
                        preload="intent"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
