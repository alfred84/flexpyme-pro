import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  fetchEmployeeById,
  fetchWorkBatches,
  payWorkBatch,
} from "@/db/queries/employees";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { WORK_TYPE_LABELS, type WorkType } from "@/types/employee";

/**
 * Etiqueta legible para un tipo de trabajo.
 */
function workTypeLabel(value: string): string {
  return WORK_TYPE_LABELS[value as WorkType] ?? value;
}

/**
 * Ficha de empleado con historial de lotes y pago de salarios.
 *
 * @returns Página de detalle de empleado.
 */
export function EmployeeDetailPage() {
  const params = useParams({ strict: false }) as { employeeId?: string };
  const employeeId = Number(params.employeeId);
  const queryClient = useQueryClient();

  const employeeQuery = useQuery({
    queryKey: ["employees", "detail", employeeId],
    queryFn: () => fetchEmployeeById(employeeId),
    enabled: Number.isFinite(employeeId),
  });

  const batchesQuery = useQuery({
    queryKey: ["employees", "batches", employeeId],
    queryFn: () => fetchWorkBatches(employeeId),
    enabled: Number.isFinite(employeeId),
  });

  const payMutation = useMutation({
    mutationFn: payWorkBatch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["employees", "batches", employeeId] });
      void queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    },
  });

  const emp = employeeQuery.data;
  const extraRoles = emp?.extraRoles ?? [];
  const batches = batchesQuery.data ?? [];
  const totalPending = batches.reduce((acc, b) => acc + Math.max(b.totalCost - b.paid, 0), 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{emp?.name ?? "Empleado"}</h1>
          {emp && (
            <p className="text-sm capitalize text-base-content/60">
              {emp.role ?? "Sin rol"} · {emp.phone ?? "Sin teléfono"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/empleados/$employeeId/lote"
            params={{ employeeId: String(employeeId) }}
            className="btn btn-primary btn-sm"
          >
            Registrar lote
          </Link>
          <Link
            to="/empleados/$employeeId/editar"
            params={{ employeeId: String(employeeId) }}
            className="btn btn-outline btn-sm"
          >
            Editar
          </Link>
          <Link to="/empleados" className="btn btn-ghost btn-sm">
            Volver
          </Link>
        </div>
      </div>

      <div className="stats bg-base-200">
        <div className="stat">
          <div className="stat-title">Salario pendiente</div>
          <div className="stat-value text-2xl text-warning">{formatMoney(totalPending)}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Lotes registrados</div>
          <div className="stat-value text-2xl">{batches.length}</div>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="card-title text-base">Roles</h2>
              <p className="text-xs text-base-content/60">
                Rol principal: <span className="font-semibold capitalize">{emp?.role ?? "Sin rol"}</span>
              </p>
            </div>
            <Link
              to="/empleados/$employeeId/editar"
              params={{ employeeId: String(employeeId) }}
              className="btn btn-ghost btn-xs"
            >
              Cambiar roles
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {extraRoles.length > 0 ? (
              extraRoles.map((role) => (
                <span key={role} className="badge badge-outline capitalize">
                  {role}
                </span>
              ))
            ) : (
              <span className="text-xs text-base-content/50">Sin roles adicionales.</span>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Historial de lotes</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Pagado</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="text-xs">{formatDate(b.date)}</td>
                    <td>{workTypeLabel(b.workType)}</td>
                    <td className="text-right">{formatMoney(b.totalCost)}</td>
                    <td className="text-right">{formatMoney(b.paid)}</td>
                    <td>
                      <span
                        className={`badge badge-sm ${b.status === "pagado" ? "badge-success" : "badge-warning"}`}
                      >
                        {b.status === "pagado" ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="text-right">
                      {b.status !== "pagado" && (
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          disabled={payMutation.isPending}
                          onClick={() => payMutation.mutate(b.id)}
                        >
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-base-content/60">
                      Sin lotes registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
