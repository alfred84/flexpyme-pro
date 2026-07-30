import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  cancelInvoice,
  fetchInvoiceDetail,
  fetchInvoicePaymentHistory,
} from "@/db/queries/invoices";
import { ConfirmCompleteWorkModal } from "@/features/invoices/components/ConfirmCompleteWorkModal";
import {
  OrderWorkTypeSummary,
  aggregateWorkTypeSummary,
} from "@/features/invoices/components/OrderWorkTypeSummary";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { pedidosListSearch } from "@/lib/pedidos-search";
import { popFlashMessage, pushFlashMessage, type FlashMessage } from "@/lib/flash-message";
import type { InvoiceItemDto } from "@/types/invoice";

function statusLabel(status: string): string {
  if (status === "paid") {
    return "Pagado";
  }
  if (status === "partial") {
    return "Parcial";
  }
  if (status === "anulada") {
    return "Anulado";
  }
  return "Pendiente";
}

/**
 * Etiqueta de status productivo de una línea.
 *
 * @param status - `en_produccion` | `listo`.
 */
function lineStatusLabel(status: string): string {
  return status === "listo" ? "Listo" : "En producción";
}

/**
 * Detalle de pedido con líneas, trabajo, anulación y acceso a edición.
 *
 * @returns Página de detalle de pedido.
 */
export function InvoiceDetailPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [listoItem, setListoItem] = useState<InvoiceItemDto | null>(null);

  const detailQuery = useQuery({
    queryKey: ["invoices", "detail", invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });
  const workTypesQuery = useQuery({
    queryKey: ["work-types", "active"],
    queryFn: () =>
      invoke<{ id: number; name: string; code: string }[]>("get_work_types", {
        activeOnly: true,
      }),
  });
  const paymentsQuery = useQuery({
    queryKey: ["invoices", "payments", invoiceId],
    queryFn: () => fetchInvoicePaymentHistory(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelInvoice(invoiceId, cancelReason),
    onSuccess: async () => {
      setShowCancel(false);
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      pushFlashMessage({ kind: "success", text: "Pedido anulado." });
      await navigate({ to: "/pedidos", search: pedidosListSearch });
    },
  });

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de factura no válido.</span>
      </div>
    );
  }

  const inv = detailQuery.data?.invoice;
  const canEdit = detailQuery.data?.canEdit ?? false;
  const canCancel = detailQuery.data?.canCancel ?? false;
  const isCancelled = Boolean(inv?.cancelledAt) || inv?.status === "anulada";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Pedido</h1>
          {inv && <p className="text-lg font-mono">{inv.invoiceNumber}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {inv && canEdit && (
            <Link
              to="/pedidos/$invoiceId/editar"
              params={{ invoiceId: String(inv.id) }}
              className="btn btn-outline btn-sm"
            >
              Editar
            </Link>
          )}
          {inv && canCancel && (
            <button
              type="button"
              className="btn btn-error btn-outline btn-sm"
              onClick={() => setShowCancel(true)}
            >
              Anular
            </button>
          )}
          {inv && !isCancelled && (
            <>
              <Link
                to="/pedidos/$invoiceId/imprimir"
                params={{ invoiceId: String(inv.id) }}
                className="btn btn-outline btn-sm"
              >
                Imprimir
              </Link>
              <Link
                to="/pedidos/$invoiceId/caja"
                params={{ invoiceId: String(inv.id) }}
                className={inv.balance > 1e-6 ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
              >
                Caja
              </Link>
            </>
          )}
          <Link to="/pedidos" search={pedidosListSearch} className="btn btn-ghost btn-sm">
            Volver al listado
          </Link>
        </div>
      </div>

      {detailQuery.isLoading && <p>Cargando...</p>}
      {detailQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el pedido.</span>
        </div>
      )}
      {flash && (
        <div className={flash.kind === "success" ? "alert alert-success" : "alert alert-info"}>
          <span>{flash.text}</span>
        </div>
      )}

      {inv && isCancelled && (
        <div className="alert alert-error">
          <span>
            Pedido anulado
            {inv.cancelledReason ? `: ${inv.cancelledReason}` : "."}
          </span>
        </div>
      )}

      {inv && !canEdit && !isCancelled && detailQuery.data?.editBlockReason && (
        <p className="text-xs text-base-content/60">
          Edición no disponible: {detailQuery.data.editBlockReason}
        </p>
      )}

      {inv && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title text-base">Cliente y fechas</h2>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-base-content/60">Cliente</dt>
                    <dd>{inv.clientName}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">Fecha</dt>
                    <dd>{formatDate(inv.date)}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">Producción</dt>
                    <dd>{inv.productionStatus === "listo" ? "Listo" : "En producción"}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">Cobro</dt>
                    <dd>{inv.paymentStatus === "cobrado" ? "Cobrado" : "Pendiente"}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">Estado</dt>
                    <dd>{statusLabel(inv.status)}</dd>
                  </div>
                  {inv.notes && (
                    <div>
                      <dt className="text-base-content/60">Notas</dt>
                      <dd className="whitespace-pre-wrap">{inv.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body">
                <h2 className="card-title text-base">Totales</h2>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt>Subtotal líneas</dt>
                    <dd>{formatMoney(inv.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Deuda anterior</dt>
                    <dd>{formatMoney(inv.previousDebt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Anticipado</dt>
                    <dd>{formatMoney(inv.advancePayment)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Total</dt>
                    <dd>{formatMoney(inv.total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Pagado</dt>
                    <dd>{formatMoney(inv.paid)}</dd>
                  </div>
                  <div className="flex justify-between text-primary">
                    <dt>Pendiente (sin saldo)</dt>
                    <dd>{formatMoney(inv.balance)}</dd>
                  </div>
                </dl>
                {inv.paymentMethod && <div className="divider my-1" />}
                {inv.paymentMethod && (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt>Pagado con</dt>
                      <dd className="capitalize">
                        {inv.paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}
                        {inv.paymentCurrency ? ` ${inv.paymentCurrency}` : ""}
                      </dd>
                    </div>
                    {inv.paymentCurrency === "USD" && inv.exchangeRateSnapshot && (
                      <>
                        <div className="flex justify-between">
                          <dt>Monto recibido</dt>
                          <dd>
                            $ {inv.amountUsd.toFixed(2)} USD (tasa: {inv.exchangeRateSnapshot}{" "}
                            CUP/USD)
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Equivalente</dt>
                          <dd>{formatMoney(inv.amountCup || inv.total)}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                )}
              </div>
            </div>
          </div>

          {inv.resourceMissing && (
            <div role="alert" className="alert alert-warning">
              <AlertTriangle className="h-5 w-5" />
              <span>
                Este pedido tiene líneas con recursos de inventario insuficientes. Revisa las líneas
                marcadas y repón el material faltante.
              </span>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Formato</th>
                  <th>Tipo de trabajo</th>
                  <th>Acabado</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Realizado</th>
                  <th className="text-right">P. unit.</th>
                  <th className="text-right">Subtotal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {detailQuery.data?.items.map((line) => {
                  const pending = Math.max(0, line.quantity - line.completedQuantity);
                  const isListo = (line.productionLineStatus ?? "en_produccion") === "listo";
                  return (
                    <tr key={line.id} className={line.resourceMissing ? "bg-error/10" : undefined}>
                      <td>{line.categoryName}</td>
                      <td>{line.formatLabel ?? "—"}</td>
                      <td>
                        {line.service ?? "—"}
                        {line.resourceMissing && (
                          <span
                            className="badge badge-error badge-sm ml-2 gap-1"
                            title={line.resourceNote ?? "Recurso insuficiente"}
                          >
                            <AlertTriangle className="h-3 w-3" /> Falta recurso
                          </span>
                        )}
                        {(line.assignments?.length ?? 0) > 0 && (
                          <div className="text-xs text-base-content/50">
                            {line.assignments.map((a) => a.employeeName).join(", ")}
                          </div>
                        )}
                      </td>
                      <td>{line.finish ?? "—"}</td>
                      <td className="text-right">{line.quantity}</td>
                      <td className="text-right">
                        <span className={pending === 0 ? "text-success" : "text-warning"}>
                          {line.completedQuantity}
                        </span>
                        {pending > 0 && (
                          <span className="text-xs text-base-content/50"> (faltan {pending})</span>
                        )}
                      </td>
                      <td className="text-right">{formatMoney(line.unitPrice)}</td>
                      <td className="text-right">{formatMoney(line.subtotal)}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`badge badge-sm ${isListo ? "badge-success" : "badge-warning"}`}
                          >
                            {lineStatusLabel(line.productionLineStatus ?? "en_produccion")}
                          </span>
                          {!isCancelled && !isListo && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              title="Cambiar a Listo"
                              onClick={() => setListoItem(line)}
                            >
                              → Listo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <OrderWorkTypeSummary
            rows={aggregateWorkTypeSummary(detailQuery.data?.items ?? [])}
          />

          <ConfirmCompleteWorkModal
            open={Boolean(listoItem)}
            item={listoItem}
            workTypes={workTypesQuery.data ?? []}
            onClose={() => setListoItem(null)}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: ["invoices"] });
              pushFlashMessage({ kind: "success", text: "Línea marcada como listo." });
            }}
          />

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Historial de cobros</h2>
              {(paymentsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-base-content/60">Sin cobros registrados.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {paymentsQuery.data?.map((p) => (
                    <li key={p.id} className="rounded border border-base-300 px-3 py-2">
                      {formatDate(p.date)} · {p.concept} · {formatMoney(p.amountCup)}
                      {p.amountUsd > 0 ? ` (+ ${p.amountUsd} USD)` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {showCancel && (
        <ModalPortal>
          <dialog className="modal modal-open">
            <div className="modal-box">
              <h3 className="text-lg font-bold">Anular pedido</h3>
              <p className="py-2 text-sm text-base-content/70">
                Se revertirán los cobros en caja y las salidas de inventario asociadas a este pedido.
                Los lotes de trabajo ya registrados se conservan como historial (la nómina pagada no
                se deshace). El motivo es obligatorio.
              </p>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo de anulación"
              />
              {cancelMutation.isError && (
                <p className="mt-2 text-sm text-error">
                  {(cancelMutation.error as Error).message}
                </p>
              )}
              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setShowCancel(false)}>
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn btn-error"
                  disabled={cancelMutation.isPending || !cancelReason.trim()}
                  onClick={() => void cancelMutation.mutateAsync()}
                >
                  {cancelMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Confirmar anulación"
                  )}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-backdrop bg-transparent"
              aria-label="Cerrar"
              onClick={() => setShowCancel(false)}
            />
          </dialog>
        </ModalPortal>
      )}
    </section>
  );
}
