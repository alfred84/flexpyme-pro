import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Banknote, UserCog, UserPlus } from "lucide-react";
import {
  deactivateEmployee,
  fetchEmployees,
  fetchPayrollDaily,
  fetchUnpaidBatchesForDate,
  payWorkBatchesMany,
  reactivateEmployee,
} from "@/db/queries/employees";
import { EmployeePayCashierModal } from "@/features/employees/components/EmployeePayCashierModal";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Listado de empleados con alta y baja (soft delete).
 *
 * @returns Página de empleados.
 */
export function EmployeesListPage() {
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const unpaidTodayQuery = useQuery({
    queryKey: ["employees", "unpaid-today", todayIso()],
    queryFn: () => fetchUnpaidBatchesForDate(todayIso()),
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

  const unpaidToday = unpaidTodayQuery.data ?? [];
  const unpaidTotal = useMemo(
    () => unpaidToday.reduce((s, b) => s + b.pending, 0),
    [unpaidToday],
  );

  const handleDeactivate = (id: number, name: string) => {
    if (window.confirm(`¿Dar de baja a ${name}? Su historial se conserva.`)) {
      deactivateMutation.mutate(id);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserCog className="h-6 w-6" /> Empleados
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm gap-1"
            disabled={unpaidToday.length === 0}
            onClick={() => setPayOpen(true)}
          >
            <Banknote className="h-4 w-4" /> Pago de empleados
            {unpaidToday.length > 0 && (
              <span className="badge badge-sm">{formatMoney(unpaidTotal)}</span>
            )}
          </button>
          <Link to="/empleados/nuevo" className="btn btn-primary btn-sm gap-1">
            <UserPlus className="h-4 w-4" /> Nuevo empleado
          </Link>
        </div>
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

      <EmployeePayCashierModal
        open={payOpen}
        title="Pago de empleados"
        description={
          unpaidToday.length === 0
            ? "No hay lotes pendientes hoy."
            : `${unpaidToday.length} lote(s) del día pendientes de pago.`
        }
        amountCup={unpaidTotal}
        onClose={() => setPayOpen(false)}
        onConfirm={async (data) => {
          await payWorkBatchesMany({
            batchIds: unpaidToday.map((b) => b.id),
            paymentMethod: data.paymentMethod,
            currency: data.currency,
            denominationBreakdown: data.denominationBreakdown,
            amountCup: data.amountCup,
            amountUsd: data.amountUsd,
          });
          await queryClient.invalidateQueries({ queryKey: ["employees"] });
          await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
          await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
          pushFlashMessage({ kind: "success", text: "Pagos de empleados registrados." });
        }}
      />
    </section>
  );
}
