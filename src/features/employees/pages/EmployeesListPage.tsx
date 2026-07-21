import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, UserCog, UserPlus } from "lucide-react";
import {
  deactivateEmployee,
  fetchEmployees,
  fetchPayrollDaily,
  reactivateEmployee,
} from "@/db/queries/employees";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";

/**
 * Listado de empleados con alta y baja (soft delete).
 *
 * @returns Página de empleados.
 */
export function EmployeesListPage() {
  const queryClient = useQueryClient();
  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const [payrollMonth, setPayrollMonth] = useState(() => todayIso().slice(0, 7));
  const payrollQuery = useQuery({
    queryKey: ["payroll-daily", payrollMonth],
    queryFn: () => fetchPayrollDaily(payrollMonth),
  });
  const payrollRows = payrollQuery.data ?? [];
  const payrollTotals = payrollRows.reduce(
    (acc, r) => ({
      total: acc.total + r.totalCost,
      paid: acc.paid + r.paid,
      pending: acc.pending + r.pending,
    }),
    { total: 0, paid: 0, pending: 0 },
  );

  const handleDeactivate = (id: number, name: string) => {
    if (window.confirm(`¿Dar de baja a ${name}? Su historial se conserva.`)) {
      deactivateMutation.mutate(id);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserCog className="h-6 w-6" /> Empleados
        </h1>
        <Link to="/empleados/nuevo" className="btn btn-primary btn-sm gap-1">
          <UserPlus className="h-4 w-4" /> Nuevo empleado
        </Link>
      </div>

      {employeesQuery.isLoading && <p>Cargando empleados...</p>}
      {employeesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los empleados.</span>
        </div>
      )}

      {employeesQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Roles adicionales</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.data.map((emp) => (
                <tr key={emp.id} className={emp.isActive ? "" : "opacity-50"}>
                  <td className="font-medium">{emp.name}</td>
                  <td className="capitalize">{emp.role ?? "—"}</td>
                  <td>
                    {(emp.extraRoles ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {emp.extraRoles.map((role) => (
                          <span key={role} className="badge badge-ghost badge-sm capitalize">
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )}
                  </td>
                  <td>{emp.phone ?? "—"}</td>
                  <td>
                    <span className={`badge badge-sm ${emp.isActive ? "badge-success" : "badge-ghost"}`}>
                      {emp.isActive ? "Activo" : "Baja"}
                    </span>
                  </td>
                  <td className="flex flex-wrap justify-end gap-1">
                    <Link
                      className="btn btn-xs btn-outline"
                      to="/empleados/$employeeId"
                      params={{ employeeId: String(emp.id) }}
                    >
                      Ver
                    </Link>
                    <Link
                      className="btn btn-xs btn-ghost"
                      to="/empleados/$employeeId/editar"
                      params={{ employeeId: String(emp.id) }}
                    >
                      Editar
                    </Link>
                    {!emp.isActive && (
                      <button
                        type="button"
                        className="btn btn-xs btn-success btn-outline"
                        disabled={reactivateMutation.isPending}
                        onClick={() => void reactivateMutation.mutateAsync(emp.id)}
                      >
                        Reactivar
                      </button>
                    )}
                    {emp.isActive && (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => handleDeactivate(emp.id, emp.name)}
                      >
                        Dar de baja
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employeesQuery.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-base-content/60">
                    No hay empleados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5" /> Nómina diaria
            </h2>
            <input
              type="month"
              className="input input-bordered input-sm"
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value || todayIso().slice(0, 7))}
            />
          </div>
          {payrollRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-content/60">
              Sin salarios registrados en el mes seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Empleado</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Pagado</th>
                    <th className="text-right">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.map((r) => (
                    <tr key={`${r.employeeId}-${r.date}`}>
                      <td className="text-xs">{formatDate(r.date)}</td>
                      <td>{r.employeeName}</td>
                      <td className="text-right">{formatMoney(r.totalCost)}</td>
                      <td className="text-right text-success">{formatMoney(r.paid)}</td>
                      <td className="text-right text-warning">{formatMoney(r.pending)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={2}>Total mes</td>
                    <td className="text-right">{formatMoney(payrollTotals.total)}</td>
                    <td className="text-right text-success">{formatMoney(payrollTotals.paid)}</td>
                    <td className="text-right text-warning">{formatMoney(payrollTotals.pending)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
