import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  fetchEmployeeById,
  fetchWorkBatches,
  payWorkBatch,
} from "@/db/queries/employees";
import { EmployeePayCashierModal } from "@/features/employees/components/EmployeePayCashierModal";
import { formatDate } from "@/lib/format-date";
import { formatAmount, formatMoney, moneyHeading } from "@/lib/format-money";
import { pushFlashMessage } from "@/lib/flash-message";
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
  const [payBatchId, setPayBatchId] = useState<number | null>(null);

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

  const emp = employeeQuery.data;
  const extraRoles = emp?.extraRoles ?? [];
  const batches = batchesQuery.data ?? [];
  const payBatch = batches.find((b) => b.id === payBatchId) ?? null;
  const payAmount = payBatch ? Math.max(payBatch.totalCost - payBatch.paid, 0) : 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{emp?.name ?? "Empleado"}</h1>
          {emp && (
            <p className="text-sm capitalize text-base-content/60">
              {emp.role ?? "Sin rol"} · {emp.phone ?? "Sin teléfono"}
              {emp.payMode === "fixed"
                ? ` · Salario fijo ${formatMoney(emp.fixedDailySalaryCup)}/día`
                : emp.payMode === "destajo"
                  ? ` · Destajo ${formatMoney(emp.fixedDailySalaryCup)}/día`
                  : emp.payMode === "monthly"
                    ? ` · Salario fijo ${formatMoney(emp.fixedMonthlySalaryCup)}/mes`
                    : " · Pago por producción"}
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

      <div className="card bg-base-200">
        <div className="card-body">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="card-title text-base">Roles</h2>
              <p className="text-xs text-base-content/60">
                Rol principal:{" "}
                <span className="font-semibold capitalize">{emp?.role ?? "Sin rol"}</span>
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
                  <th className="text-right">{moneyHeading("Total")}</th>
                  <th className="text-right">{moneyHeading("Pagado")}</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="text-xs">{formatDate(b.date)}</td>
                    <td>{workTypeLabel(b.workType)}</td>
                    <td className="text-right">{formatAmount(b.totalCost)}</td>
                    <td className="text-right">{formatAmount(b.paid)}</td>
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
                          onClick={() => setPayBatchId(b.id)}
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

      <EmployeePayCashierModal
        open={payBatchId !== null}
        title={`Pagar lote #${payBatchId ?? ""}`}
        description={
          payBatch
            ? `${workTypeLabel(payBatch.workType)} · ${formatDate(payBatch.date)}`
            : undefined
        }
        amountCup={payAmount}
        onClose={() => setPayBatchId(null)}
        onConfirm={async (data) => {
          if (payBatchId === null) {
            return;
          }
          await payWorkBatch({
            batchId: payBatchId,
            paymentMethod: data.paymentMethod,
            currency: data.currency,
            denominationBreakdown: data.denominationBreakdown,
            amountCup: data.amountCup,
            amountUsd: data.amountUsd,
          });
          await queryClient.invalidateQueries({ queryKey: ["employees", "batches", employeeId] });
          await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
          pushFlashMessage({ kind: "success", text: "Pago registrado." });
        }}
      />
    </section>
  );
}
