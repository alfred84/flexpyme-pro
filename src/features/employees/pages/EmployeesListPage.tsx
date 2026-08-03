import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Banknote, ClipboardList, UserCog, UserPlus } from "lucide-react";
import {
  deactivateEmployee,
  fetchDestajoPendingForDate,
  fetchEmployees,
  fetchPayrollDaily,
  fetchUnpaidBatchesForDate,
  payWorkBatchesMany,
  reactivateEmployee,
  setDestajoDailySalary,
  type UnpaidBatchDto,
} from "@/db/queries/employees";
import { EmployeePayCashierModal } from "@/features/employees/components/EmployeePayCashierModal";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import type { EmployeePayMode } from "@/types/employee";

/**
 * Etiqueta corta del modo de pago en el listado.
 *
 * @param payMode - Modo de pago del empleado.
 * @param fixedCup - Importe fijo diario si aplica.
 */
function salaryBadge(payMode: EmployeePayMode | undefined, fixedCup: number) {
  if (payMode === "fixed") {
    return (
      <span className="badge badge-info badge-sm">
        Fijo {formatMoney(fixedCup)}/día
      </span>
    );
  }
  if (payMode === "destajo") {
    return <span className="badge badge-warning badge-sm">Destajo diario</span>;
  }
  return <span className="text-base-content/50">Por producción</span>;
}

/** Objetivo del modal de pago (todos del día o un empleado). */
type PayTarget =
  | { kind: "all" }
  | { kind: "employee"; employeeId: number; employeeName: string };

/**
 * Filtra ítems pendientes según el objetivo de pago.
 *
 * @param unpaid - Ítems pendientes del día.
 * @param target - Todos o un empleado concreto.
 */
function unpaidForTarget(unpaid: UnpaidBatchDto[], target: PayTarget): UnpaidBatchDto[] {
  if (target.kind === "all") {
    return unpaid;
  }
  return unpaid.filter((b) => b.employeeId === target.employeeId);
}

/**
 * Listado de empleados con alta y baja (soft delete).
 *
 * @returns Página de empleados.
 */
export function EmployeesListPage() {
  const queryClient = useQueryClient();
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [destajoDrafts, setDestajoDrafts] = useState<Record<number, string>>({});
  const today = todayIso();
  const [payrollDate, setPayrollDate] = useState(today);

  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const unpaidTodayQuery = useQuery({
    queryKey: ["employees", "unpaid", today],
    queryFn: () => fetchUnpaidBatchesForDate(today),
  });

  const unpaidPayrollQuery = useQuery({
    queryKey: ["employees", "unpaid", payrollDate],
    queryFn: () => fetchUnpaidBatchesForDate(payrollDate),
  });

  const destajoPendingQuery = useQuery({
    queryKey: ["employees", "destajo-pending", today],
    queryFn: () => fetchDestajoPendingForDate(today),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const setDestajoMutation = useMutation({
    mutationFn: setDestajoDailySalary,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
      pushFlashMessage({ kind: "success", text: "Destajo del día registrado." });
    },
  });

  const payrollQuery = useQuery({
    queryKey: ["payroll-daily", payrollDate],
    queryFn: () => fetchPayrollDaily(payrollDate),
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
  const unpaidPayroll = unpaidPayrollQuery.data ?? [];
  const destajoPending = destajoPendingQuery.data ?? [];
  const unpaidTodayTotal = useMemo(
    () => unpaidToday.reduce((s, b) => s + b.pending, 0),
    [unpaidToday],
  );

  const payItems = payTarget ? unpaidForTarget(
    payTarget.kind === "all" ? unpaidToday : unpaidPayroll,
    payTarget,
  ) : [];
  const payAmount = useMemo(
    () => payItems.reduce((s, b) => s + b.pending, 0),
    [payItems],
  );

  const handleDeactivate = (id: number, name: string) => {
    if (window.confirm(`¿Dar de baja a ${name}? Su historial se conserva.`)) {
      deactivateMutation.mutate(id);
    }
  };

  const handleSaveDestajo = (employeeId: number) => {
    const raw = destajoDrafts[employeeId]?.trim() ?? "";
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      pushFlashMessage({
        kind: "error",
        text: "Indica un importe de destajo mayor que cero.",
      });
      return;
    }
    setDestajoMutation.mutate({
      employeeId,
      date: today,
      amountCup: amount,
    });
  };

  /**
   * Invalida listados relacionados tras un pago.
   */
  const invalidateAfterPay = async () => {
    await queryClient.invalidateQueries({ queryKey: ["employees"] });
    await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
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
            disabled={unpaidToday.length === 0 || destajoPending.length > 0}
            title={
              destajoPending.length > 0
                ? "Define primero los destajos del día"
                : undefined
            }
            onClick={() => setPayTarget({ kind: "all" })}
          >
            <Banknote className="h-4 w-4" /> Pago de empleados
            {unpaidToday.length > 0 && (
              <span className="badge badge-sm">{formatMoney(unpaidTodayTotal)}</span>
            )}
          </button>
          <Link to="/empleados/nuevo" className="btn btn-primary btn-sm gap-1">
            <UserPlus className="h-4 w-4" /> Nuevo empleado
          </Link>
        </div>
      </div>

      {destajoPending.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="mb-3 flex items-start gap-2">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <h2 className="font-semibold">Destajos del día (obligatorio)</h2>
              <p className="text-sm text-base-content/70">
                Define el importe CUP de cada empleado a destajo antes de registrar el pago
                del día ({formatDate(today)}).
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {destajoPending.map((row) => (
              <li
                key={row.employeeId}
                className="flex flex-wrap items-end gap-2 rounded-md bg-base-100 p-2"
              >
                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium">{row.employeeName}</p>
                  <p className="text-xs text-base-content/50">Pendiente de definir</p>
                </div>
                <label className="form-control w-36">
                  <span className="label-text text-xs">Importe (CUP)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    className="input input-bordered input-sm"
                    placeholder="0.00"
                    value={destajoDrafts[row.employeeId] ?? ""}
                    onChange={(e) =>
                      setDestajoDrafts((prev) => ({
                        ...prev,
                        [row.employeeId]: e.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-warning btn-sm"
                  disabled={setDestajoMutation.isPending}
                  onClick={() => handleSaveDestajo(row.employeeId)}
                >
                  Guardar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                <th>Salario</th>
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
                  <td className="text-xs">
                    {salaryBadge(emp.payMode, emp.fixedDailySalaryCup)}
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
                  <td colSpan={7} className="py-6 text-center text-base-content/60">
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
              type="date"
              className="input input-bordered input-sm"
              value={payrollDate}
              onChange={(e) => setPayrollDate(e.target.value || today)}
            />
          </div>
          {payrollQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-base-content/60">Cargando nómina...</p>
          ) : payrollRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-content/60">
              Sin salarios registrados el {formatDate(payrollDate)}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Pagado</th>
                    <th className="text-right">Pendiente</th>
                    <th className="text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.map((r) => {
                    const canPay = r.pending > 1e-9;
                    return (
                      <tr key={`${r.employeeId}-${r.date}`}>
                        <td>{r.employeeName}</td>
                        <td className="text-right">{formatMoney(r.totalCost)}</td>
                        <td className="text-right text-success">{formatMoney(r.paid)}</td>
                        <td className="text-right text-warning">{formatMoney(r.pending)}</td>
                        <td className="text-right">
                          {canPay ? (
                            <button
                              type="button"
                              className="btn btn-xs btn-secondary gap-1"
                              onClick={() =>
                                setPayTarget({
                                  kind: "employee",
                                  employeeId: r.employeeId,
                                  employeeName: r.employeeName,
                                })
                              }
                            >
                              <Banknote className="h-3.5 w-3.5" /> Pagar
                            </button>
                          ) : (
                            <span className="text-xs text-base-content/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td>Total día</td>
                    <td className="text-right">{formatMoney(payrollTotals.total)}</td>
                    <td className="text-right text-success">{formatMoney(payrollTotals.paid)}</td>
                    <td className="text-right text-warning">{formatMoney(payrollTotals.pending)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <EmployeePayCashierModal
        open={payTarget !== null}
        title={
          payTarget?.kind === "employee"
            ? `Pago a ${payTarget.employeeName}`
            : "Pago de empleados"
        }
        description={
          payItems.length === 0
            ? "No hay pagos pendientes."
            : payTarget?.kind === "employee"
              ? `${payItems.length} ítem(s) pendientes de ${payTarget.employeeName} el ${formatDate(payrollDate)}.`
              : `${payItems.length} ítem(s) del día pendientes de pago (lotes y/o salarios diarios).`
        }
        amountCup={payAmount}
        onClose={() => setPayTarget(null)}
        onConfirm={async (data) => {
          if (payItems.length === 0) {
            throw new Error("No hay pagos pendientes.");
          }
          await payWorkBatchesMany({
            batchIds: payItems.filter((b) => !b.isFixedSalary).map((b) => b.id),
            dailySalaryIds: payItems.filter((b) => b.isFixedSalary).map((b) => b.id),
            paymentMethod: data.paymentMethod,
            currency: data.currency,
            denominationBreakdown: data.denominationBreakdown,
            amountCup: data.amountCup,
            amountUsd: data.amountUsd,
          });
          await invalidateAfterPay();
          pushFlashMessage({
            kind: "success",
            text:
              payTarget?.kind === "employee"
                ? `Pago a ${payTarget.employeeName} registrado.`
                : "Pagos de empleados registrados.",
          });
          setPayTarget(null);
        }}
      />
    </section>
  );
}
