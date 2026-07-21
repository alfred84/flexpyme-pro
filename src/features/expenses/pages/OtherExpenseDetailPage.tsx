import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteOtherExpense, fetchOtherExpenseById } from "@/db/queries/other-expenses";
import { parseDenominationBreakdown, sumDenominationCounts } from "@/lib/cash-counts";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { popFlashMessage, pushFlashMessage, type FlashMessage } from "@/lib/flash-message";

/**
 * Detalle de un gasto operativo: datos, desglose de billetes y acciones.
 *
 * @returns Página de detalle del gasto.
 */
export function OtherExpenseDetailPage() {
  const params = useParams({ strict: false }) as { expenseId?: string };
  const expenseId = Number(params.expenseId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());

  const expenseQuery = useQuery({
    queryKey: ["other-expenses", "detail", expenseId],
    queryFn: () => fetchOtherExpenseById(expenseId),
    enabled: Number.isFinite(expenseId) && expenseId > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOtherExpense(expenseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["other-expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["cashflow"] });
      pushFlashMessage({ kind: "success", text: "Gasto eliminado." });
      await navigate({ to: "/otros-gastos" });
    },
  });

  if (!Number.isFinite(expenseId) || expenseId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de gasto no válido.</span>
      </div>
    );
  }

  const expense = expenseQuery.data;
  const breakdown = expense
    ? parseDenominationBreakdown(expense.denominationBreakdown)
    : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Receipt className="h-6 w-6" /> Detalle del gasto
          </h1>
          {expense && <p className="mt-1 text-lg font-medium">{expense.concept}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/otros-gastos" className="btn btn-ghost btn-sm gap-1">
            <ArrowLeft className="h-4 w-4" />
            Volver al listado
          </Link>
          {expense && (
            <>
              <Link
                to="/otros-gastos/$expenseId/editar"
                params={{ expenseId: String(expense.id) }}
                className="btn btn-outline btn-sm gap-1"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
              <button
                type="button"
                className="btn btn-error btn-outline btn-sm gap-1"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {flash && (
        <div className={flash.kind === "success" ? "alert alert-success" : "alert alert-info"}>
          <span>{flash.text}</span>
        </div>
      )}

      {expenseQuery.isLoading && <p className="text-sm text-base-content/60">Cargando…</p>}
      {expenseQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el gasto.</span>
        </div>
      )}

      {expense && (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-base-content/60">Fecha</dt>
                <dd>{formatDate(expense.date)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Tipo</dt>
                <dd>{expense.expenseType}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Empleado</dt>
                <dd>{expense.employeeName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Forma de pago</dt>
                <dd className="capitalize">{expense.paymentMethod}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-base-content/60">Importe CUP</dt>
                <dd className="font-mono font-semibold text-error">
                  {formatMoney(expense.amountCup)}
                </dd>
              </div>
              {expense.amountUsd > 0.001 && (
                <div>
                  <dt className="text-xs uppercase text-base-content/60">Importe USD</dt>
                  <dd className="font-mono">${expense.amountUsd.toFixed(2)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase text-base-content/60">Registrado</dt>
                <dd className="text-sm">{formatDateTime(expense.createdAt)}</dd>
              </div>
              {expense.cashTransactionId != null && (
                <div>
                  <dt className="text-xs uppercase text-base-content/60">Movimiento de caja</dt>
                  <dd className="font-mono text-sm">#{expense.cashTransactionId}</dd>
                </div>
              )}
            </dl>

            {expense.notes && (
              <div>
                <p className="text-xs uppercase text-base-content/60">Notas</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{expense.notes}</p>
              </div>
            )}

            {breakdown && (
              <div>
                <p className="mb-2 text-xs uppercase text-base-content/60">
                  Desglose de billetes ({breakdown.currency})
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(breakdown.counts)
                    .filter(([, n]) => n > 0)
                    .map(([denom, n]) => (
                      <span key={denom} className="badge badge-outline badge-sm font-mono">
                        {breakdown.currency === "USD" ? `$${denom}` : formatMoney(Number(denom))} ×{" "}
                        {n}
                      </span>
                    ))}
                </div>
                <p className="mt-2 text-right text-sm">
                  Total desglose:{" "}
                  <span className="font-semibold">
                    {breakdown.currency === "USD"
                      ? `$ ${sumDenominationCounts(breakdown.counts, "USD").toFixed(2)}`
                      : formatMoney(sumDenominationCounts(breakdown.counts, "CUP"))}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showDelete && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold">Eliminar gasto</h3>
            <p className="py-4">
              Se eliminará el gasto y su egreso en caja. Esta acción no se puede deshacer.
            </p>
            {deleteMutation.isError && (
              <p className="text-sm text-error">
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : "No se pudo eliminar."}
              </p>
            )}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setShowDelete(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutateAsync()}
              >
                {deleteMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Eliminar"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="submit" onClick={() => setShowDelete(false)}>
              cerrar
            </button>
          </form>
        </dialog>
      )}
    </section>
  );
}
