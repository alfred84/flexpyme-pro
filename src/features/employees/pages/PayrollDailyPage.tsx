import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Banknote, CalendarDays, ClipboardList, Undo2 } from "lucide-react";
import {
  fetchPayrollDaily,
  fetchUnpaidBatchesForDate,
  payWorkBatchesMany,
  reverseEmployeePayment,
  type UnpaidBatchDto,
} from "@/db/queries/employees";
import { EmployeePayCashierModal } from "@/features/employees/components/EmployeePayCashierModal";
import { formatDate, todayIso } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";

/** Empleado seleccionado para pagar en el modal de caja. */
interface PayEmployeeTarget {
  employeeId: number;
  employeeName: string;
}

/**
 * Nómina diaria: selector de fecha, totales CUP y pago/deshacer por empleado.
 *
 * @returns Página de nómina diaria.
 */
export function PayrollDailyPage() {
  const queryClient = useQueryClient();
  const today = todayIso();
  const [payrollDate, setPayrollDate] = useState(today);
  const [payTarget, setPayTarget] = useState<PayEmployeeTarget | null>(null);

  const isPayrollToday = payrollDate === today;

  const unpaidPayrollQuery = useQuery({
    queryKey: ["employees", "unpaid", payrollDate],
    queryFn: () => fetchUnpaidBatchesForDate(payrollDate),
  });

  const payrollQuery = useQuery({
    queryKey: ["payroll-daily", payrollDate],
    queryFn: () => fetchPayrollDaily(payrollDate),
  });

  const reversePayMutation = useMutation({
    mutationFn: reverseEmployeePayment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      await queryClient.invalidateQueries({ queryKey: ["payroll-daily"] });
    },
  });

  const payrollRows = payrollQuery.data ?? [];
  const payrollTotals = payrollRows.reduce(
    (acc, row) => ({
      total: acc.total + row.totalCost,
      paid: acc.paid + row.paid,
      pending: acc.pending + row.pending,
    }),
    { total: 0, paid: 0, pending: 0 },
  );

  const unpaidPayroll = unpaidPayrollQuery.data ?? [];

  const payItems = useMemo(() => {
    if (!payTarget) {
      return [] as UnpaidBatchDto[];
    }
    return unpaidPayroll.filter((batch) => batch.employeeId === payTarget.employeeId);
  }, [payTarget, unpaidPayroll]);

  const payAmount = useMemo(
    () => payItems.reduce((sum, batch) => sum + batch.pending, 0),
    [payItems],
  );

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Link to="/empleados" className="btn btn-ghost btn-sm gap-2 px-0">
            <ArrowLeft className="h-4 w-4" />
            Empleados
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarDays className="h-6 w-6" /> Nómina diaria
          </h1>
          <p className="max-w-2xl text-sm text-base-content/70">
            Salarios del día en CUP. El fijo diario y el mensual no aparecen solos: habilítalos en
            Empleados y luego págalos aquí.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-base-content/70">Fecha</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={payrollDate}
              onChange={(event) => setPayrollDate(event.target.value || today)}
            />
          </label>
          <Link to="/empleados/historial-nomina" className="btn btn-outline btn-sm gap-1">
            <ClipboardList className="h-4 w-4" /> Historial de nómina
          </Link>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title text-base">
            {formatDate(payrollDate)}
            <span className="font-normal text-sm text-base-content/60">
              {payrollRows.length} trabajador{payrollRows.length === 1 ? "" : "es"}
            </span>
          </h2>
          {payrollQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-base-content/60">Cargando nómina...</p>
          ) : payrollQuery.isError ? (
            <div className="alert alert-error">
              <span>No se pudo cargar la nómina diaria.</span>
            </div>
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
                    <th className="text-right">{moneyHeading("Total")}</th>
                    <th className="text-right">{moneyHeading("Pagado")}</th>
                    <th className="text-right">{moneyHeading("Pendiente")}</th>
                    <th className="text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.map((row) => {
                    const canPay = row.pending > 1e-9;
                    const canReverse = isPayrollToday && row.paid > 1e-9;
                    return (
                      <tr key={`${row.employeeId}-${row.date}`}>
                        <td>{row.employeeName}</td>
                        <td className="text-right">{formatAmount(row.totalCost)}</td>
                        <td className="text-right text-success">{formatAmount(row.paid)}</td>
                        <td className="text-right text-warning">{formatAmount(row.pending)}</td>
                        <td className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {canPay && (
                              <button
                                type="button"
                                className="btn btn-xs btn-secondary gap-1"
                                onClick={() =>
                                  setPayTarget({
                                    employeeId: row.employeeId,
                                    employeeName: row.employeeName,
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
                                      `¿Revertir el pago de ${row.employeeName} del ${formatDate(payrollDate)}?\n\nSe registrará un ingreso compensatorio en caja y el salario quedará pendiente de nuevo.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  void reversePayMutation
                                    .mutateAsync({
                                      employeeId: row.employeeId,
                                      date: payrollDate,
                                    })
                                    .then(() => {
                                      pushFlashMessage({
                                        kind: "success",
                                        text: `Pago a ${row.employeeName} revertido.`,
                                      });
                                    })
                                    .catch((error: unknown) => {
                                      pushFlashMessage({
                                        kind: "error",
                                        text:
                                          error instanceof Error
                                            ? error.message
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
                    <td className="text-right">{formatAmount(payrollTotals.total)}</td>
                    <td className="text-right text-success">{formatAmount(payrollTotals.paid)}</td>
                    <td className="text-right text-warning">{formatAmount(payrollTotals.pending)}</td>
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
            batchIds: payItems.filter((batch) => !batch.isFixedSalary).map((batch) => batch.id),
            dailySalaryIds: payItems.filter((batch) => batch.isFixedSalary).map((batch) => batch.id),
            paymentMethod: data.paymentMethod,
            currency: data.currency,
            denominationBreakdown: data.denominationBreakdown,
            amountCup: data.amountCup,
            amountUsd: data.amountUsd,
            date: payrollDate,
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
