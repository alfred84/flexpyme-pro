import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Banknote, Undo2, UserCog, UserPlus } from "lucide-react";
import {
  deactivateEmployee,
  fetchDestajoPendingForDate,
  fetchEmployees,
  fetchPayrollDaily,
  fetchUnpaidBatchesForDate,
  payWorkBatchesMany,
  reactivateEmployee,
  reverseEmployeePayment,
  setDestajoDailySalary,
  type UnpaidBatchDto,
} from "@/db/queries/employees";
import { DestajoDefineModal } from "@/features/employees/components/DestajoDefineModal";
import { EmployeePayCashierModal } from "@/features/employees/components/EmployeePayCashierModal";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
import type { EmployeePayMode } from "@/types/employee";

/** Empleado seleccionado para pagar en el modal de caja. */
interface PayEmployeeTarget {
  employeeId: number;
  employeeName: string;
}

/** Empleado seleccionado para definir destajo del día. */
interface DestajoTarget {
  employeeId: number;
  employeeName: string;
  currentAmountCup: number | null;
}

/**
 * Listado de empleados con alta y baja (soft delete).
 *
 * @returns Página de empleados.
 */
export function EmployeesListPage() {
  const queryClient = useQueryClient();
  const [payTarget, setPayTarget] = useState<PayEmployeeTarget | null>(null);
  const [destajoTarget, setDestajoTarget] = useState<DestajoTarget | null>(null);
  const today = todayIso();
  const [payrollDate, setPayrollDate] = useState(today);

  const employeesQuery = useQuery({
    queryKey: ["employees", "list"],
    queryFn: () => fetchEmployees(false),
  });

  const unpaidPayrollQuery = useQuery({
    queryKey: ["employees", "unpaid", payrollDate],
    queryFn: () => fetchUnpaidBatchesForDate(payrollDate),
  });

  const destajoTodayQuery = useQuery({
    queryKey: ["employees", "destajo-today", today],
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

  const reversePayMutation = useMutation({
    mutationFn: reverseEmployeePayment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
    },
  });

  const isPayrollToday = payrollDate === today;

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

  const unpaidPayroll = unpaidPayrollQuery.data ?? [];
  const destajoTodayByEmployee = useMemo(() => {
    const map = new Map<number, { amount: number; isPaid: boolean }>();
    for (const row of destajoTodayQuery.data ?? []) {
      if (row.currentAmountCup != null && row.currentAmountCup > 1e-9) {
        map.set(row.employeeId, {
          amount: row.currentAmountCup,
          isPaid: row.isPaid,
        });
      }
    }
    return map;
  }, [destajoTodayQuery.data]);

  const payItems = useMemo(() => {
    if (!payTarget) {
      return [] as UnpaidBatchDto[];
    }
    return unpaidPayroll.filter((b) => b.employeeId === payTarget.employeeId);
  }, [payTarget, unpaidPayroll]);

  const payAmount = useMemo(
    () => payItems.reduce((s, b) => s + b.pending, 0),
    [payItems],
  );

  const handleDeactivate = (id: number, name: string) => {
    if (window.confirm(`¿Dar de baja a ${name}? Su historial se conserva.`)) {
      deactivateMutation.mutate(id);
    }
  };

  /**
   * Invalida listados relacionados tras un pago.
   */
  const invalidateAfterPay = async () => {
    await queryClient.invalidateQueries({ queryKey: ["employees"] });
    await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
  };

  /**
   * Celda de salario según modo y destajo del día.
   *
   * @param payMode - Modo de pago.
   * @param fixedCup - Importe fijo o de referencia.
   * @param employeeId - Id del empleado.
   * @param employeeName - Nombre del empleado.
   * @param isActive - Si el empleado está activo.
   */
  const renderSalaryCell = (
    payMode: EmployeePayMode | undefined,
    fixedCup: number,
    employeeId: number,
    employeeName: string,
    isActive: boolean,
  ) => {
    if (payMode === "fixed") {
      return (
        <span className="badge badge-info badge-sm">
          Fijo {formatMoney(fixedCup)}/día
        </span>
      );
    }
    if (payMode === "destajo") {
      const todayDestajo = destajoTodayByEmployee.get(employeeId);
      return (
        <div className="flex flex-wrap items-center gap-1">
          <span className="badge badge-warning badge-sm">Destajo diario</span>
          {todayDestajo != null ? (
            <button
              type="button"
              className={`badge badge-sm cursor-pointer ${
                todayDestajo.isPaid ? "badge-success" : "badge-info"
              }`}
              title={
                todayDestajo.isPaid
                  ? "Destajo pagado (clic para ver)"
                  : "Editar destajo del día"
              }
              disabled={!isActive || todayDestajo.isPaid}
              onClick={() =>
                setDestajoTarget({
                  employeeId,
                  employeeName,
                  currentAmountCup: todayDestajo.amount,
                })
              }
            >
              {formatMoney(todayDestajo.amount)}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              disabled={!isActive}
              onClick={() =>
                setDestajoTarget({
                  employeeId,
                  employeeName,
                  currentAmountCup: fixedCup > 0 ? fixedCup : null,
                })
              }
            >
              Definir
            </button>
          )}
        </div>
      );
    }
    return <span className="text-base-content/50">Por producción</span>;
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <UserCog className="h-6 w-6" /> Empleados
        </h1>
        <div className="flex flex-wrap gap-2">
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
                    {renderSalaryCell(
                      emp.payMode,
                      emp.fixedDailySalaryCup,
                      emp.id,
                      emp.name,
                      emp.isActive,
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
                    const canReverse = isPayrollToday && r.paid > 1e-9;
                    return (
                      <tr key={`${r.employeeId}-${r.date}`}>
                        <td>{r.employeeName}</td>
                        <td className="text-right">{formatMoney(r.totalCost)}</td>
                        <td className="text-right text-success">{formatMoney(r.paid)}</td>
                        <td className="text-right text-warning">{formatMoney(r.pending)}</td>
                        <td className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {canPay && (
                              <button
                                type="button"
                                className="btn btn-xs btn-secondary gap-1"
                                onClick={() =>
                                  setPayTarget({
                                    employeeId: r.employeeId,
                                    employeeName: r.employeeName,
                                  })
                                }
                              >
                                <Banknote className="h-3.5 w-3.5" /> Pagar
                              </button>
                            )}
                            {canReverse && (
                              <button
                                type="button"
                                className="btn btn-xs btn-outline btn-error gap-1"
                                disabled={reversePayMutation.isPending}
                                title="Revertir el pago de hoy (solo mismo día)"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `¿Revertir el pago de ${r.employeeName} del ${formatDate(payrollDate)}?\n\nSe registrará un ingreso compensatorio en caja y el salario quedará pendiente de nuevo.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  void reversePayMutation
                                    .mutateAsync({
                                      employeeId: r.employeeId,
                                      date: payrollDate,
                                    })
                                    .then(() => {
                                      pushFlashMessage({
                                        kind: "success",
                                        text: `Pago a ${r.employeeName} revertido.`,
                                      });
                                    })
                                    .catch((e: unknown) => {
                                      pushFlashMessage({
                                        kind: "error",
                                        text:
                                          e instanceof Error
                                            ? e.message
                                            : "No se pudo revertir el pago.",
                                      });
                                    });
                                }}
                              >
                                <Undo2 className="h-3.5 w-3.5" /> Deshacer
                              </button>
                            )}
                            {!canPay && !canReverse && (
                              <span className="text-xs text-base-content/40">—</span>
                            )}
                          </div>
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

      <DestajoDefineModal
        open={destajoTarget !== null}
        employeeName={destajoTarget?.employeeName ?? ""}
        currentAmountCup={destajoTarget?.currentAmountCup ?? null}
        isSubmitting={setDestajoMutation.isPending}
        onClose={() => setDestajoTarget(null)}
        onConfirm={async (amountCup) => {
          if (!destajoTarget) {
            return;
          }
          await setDestajoMutation.mutateAsync({
            employeeId: destajoTarget.employeeId,
            date: today,
            amountCup,
          });
        }}
      />

      <EmployeePayCashierModal
        open={payTarget !== null}
        title={payTarget ? `Pago a ${payTarget.employeeName}` : "Pago a empleado"}
        description={
          payTarget
            ? payItems.length === 0
              ? "No hay pagos pendientes."
              : `${payItems.length} ítem(s) pendientes de ${payTarget.employeeName} el ${formatDate(payrollDate)}.`
            : undefined
        }
        amountCup={payAmount}
        onClose={() => setPayTarget(null)}
        onConfirm={async (data) => {
          if (!payTarget || payItems.length === 0) {
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
            text: `Pago a ${payTarget.employeeName} registrado.`,
          });
          setPayTarget(null);
        }}
      />
    </section>
  );
}
