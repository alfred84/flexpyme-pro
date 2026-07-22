import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import {
  cancelInvoice,
  fetchInvoiceDetail,
  fetchInvoicePaymentHistory,
} from "@/db/queries/invoices";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import {
  invoiceFinancialBadgeClass,
  invoiceFinancialLabel,
  invoiceFinancialStatus,
} from "@/lib/invoice-financial-status";

/**
 * Detalle contable de una factura con historial de pagos y anulación.
 *
 * @returns Página de detalle financiero de factura.
 */
export function FacturaDetailPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const queryClient = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const detailQuery = useQuery({
    queryKey: ["invoices", "detail", invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
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
    },
  });

  const inv = detailQuery.data?.invoice;
  const fin = inv
    ? invoiceFinancialStatus(inv.balance, inv.paid, inv.status === "anulada" || Boolean(inv.cancelledAt))
    : "pendiente";

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return <div className="alert alert-warning">Identificador de factura no válido.</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Factura</h1>
          {inv && <p className="font-mono text-lg">{inv.invoiceNumber}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {inv && fin !== "anulada" && fin !== "cobrada" && (
            <button type="button" className="btn btn-error btn-outline btn-sm" onClick={() => setShowCancel(true)}>
              Anular
            </button>
          )}
          {inv && inv.balance > 1e-6 && fin !== "anulada" && (
            <Link className="btn btn-primary btn-sm" to="/facturas/$invoiceId/pago" params={{ invoiceId: String(inv.id) }}>
              Registrar pago
            </Link>
          )}
          {inv && (
            <Link className="btn btn-outline btn-sm" to="/facturas/$invoiceId/imprimir" params={{ invoiceId: String(inv.id) }}>
              Imprimir
            </Link>
          )}
          <Link to="/facturas" className="btn btn-ghost btn-sm">
            Volver
          </Link>
        </div>
      </div>

      {detailQuery.isLoading && <p>Cargando...</p>}
      {inv && (
        <>
          <div className="card bg-base-100 shadow">
            <div className="card-body space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-base-content/60">Estado:</span>
                <span className={`badge ${invoiceFinancialBadgeClass(fin)}`}>{invoiceFinancialLabel(fin)}</span>
              </div>
              <p>
                <span className="text-base-content/60">Cliente:</span> {inv.clientName}
              </p>
              <p>
                <span className="text-base-content/60">Fecha:</span> {formatDate(inv.date)}
              </p>
              {inv.cancelledReason && (
                <p className="text-error text-sm">Motivo anulación: {inv.cancelledReason}</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-base-content/60">Subtotal</p>
                  <p className="font-medium">{formatMoney(inv.subtotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-base-content/60">Total</p>
                  <p className="font-medium">{formatMoney(inv.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-base-content/60">Pagado</p>
                  <p className="font-medium">{formatMoney(inv.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-base-content/60">Saldo</p>
                  <p className="font-semibold">{formatMoney(inv.balance)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Detalle</h2>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailQuery.data?.items.map((line) => (
                      <tr key={line.id}>
                        <td>
                          {line.categoryName}
                          {line.formatLabel ? ` · ${line.formatLabel}` : ""}
                          {line.service ? ` · ${line.service}` : ""}
                        </td>
                        <td>{line.quantity}</td>
                        <td>{formatMoney(line.unitPrice)}</td>
                        <td>{formatMoney(line.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Historial de pagos</h2>
              {(paymentsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-base-content/60">Sin pagos registrados.</p>
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
            <h3 className="font-bold text-lg">Anular factura</h3>
            <p className="py-2 text-sm">Se revertirán los pagos parciales en caja. Indica el motivo.</p>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo de anulación"
            />
            {cancelMutation.isError && (
              <p className="mt-2 text-sm text-error">{(cancelMutation.error as Error).message}</p>
            )}
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setShowCancel(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                onClick={() => void cancelMutation.mutateAsync()}
              >
                Confirmar anulación
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={() => setShowCancel(false)} />
          </dialog>
        </ModalPortal>
      )}
    </section>
  );
}
