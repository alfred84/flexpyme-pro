import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCostList, updateCost } from "@/db/queries/prices";
import { WORK_TYPE_LABELS, type WorkType } from "@/types/employee";

/**
 * Página de edición de precios de costo (pago a empleados).
 *
 * @returns Tabla editable de costos por tipo de trabajo y formato.
 */
export function CostsListPage() {
  const queryClient = useQueryClient();
  const costsQuery = useQuery({ queryKey: ["costs", "all"], queryFn: fetchCostList });
  const mutation = useMutation({
    mutationFn: updateCost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["costs"] }),
  });

  const rows = costsQuery.data ?? [];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Costos</h1>
      <p className="text-sm text-base-content/70">Precios de costo para el cálculo de salarios de empleados.</p>
      <div className="card bg-base-200">
        <div className="card-body">
          {costsQuery.isLoading && <p>Cargando...</p>}
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Tipo de trabajo</th>
                  <th>Formato</th>
                  <th className="text-right">Costo unitario (CUP)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{WORK_TYPE_LABELS[row.workType as WorkType] ?? row.workType}</td>
                    <td>{row.formatLabel ?? "—"}</td>
                    <td className="text-right">
                      <input
                        type="number"
                        className="input input-bordered input-sm w-28 text-right"
                        defaultValue={row.unitCost}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value !== row.unitCost && value >= 0) {
                            mutation.mutate({ id: row.id, unitCost: value, isActive: row.isActive });
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
