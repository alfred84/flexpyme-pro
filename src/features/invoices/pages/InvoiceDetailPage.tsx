import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { fetchInvoiceDetail, fetchInvoicePaymentHistory } from "@/db/queries/invoices";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { pedidosListSearch } from "@/lib/pedidos-search";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";
import { InvoiceWorkPanel } from "@/features/invoices/components/InvoiceWorkPanel";

function statusLabel(status: string): string {
  if (status === "paid") {
    return "Pagado";
  }
  if (status === "partial") {
    return "Parcial";
  }
  return "Pendiente";
}

/**
 * Shows invoice header, totals, and line items.
 *
 * @returns Invoice detail page.
 */
export function InvoiceDetailPage() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const invoiceId = Number(params.invoiceId);
  const [flash] = useState<FlashMessage | null>(() => popFlashMessage());

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

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de factura no válido.</span>
      </div>
    );
  }

  const inv = detailQuery.data?.invoice;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Pedido</h1>
          {inv && <p className="text-lg font-mono">{inv.invoiceNumber}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {inv && (
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
                    <dd>
                      {inv.productionStatus === "listo" ? "Listo" : "En producción"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">Cobro</dt>
                    <dd>{inv.paymentStatus === "cobrado" ? "Cobrado" : "Pendiente"}</dd>
                  </div>
                  <div>
                    <dt className="text-base-content/60">Estado (legacy)</dt>
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
                {inv.paymentMethod && (
                  <div className="divider my-1" />
                )}
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
                            $ {inv.amountUsd.toFixed(2)} USD (tasa: {inv.exchangeRateSnapshot} CUP/USD)
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
                </tr>
              </thead>
              <tbody>
                {detailQuery.data?.items.map((line) => {
                  const pending = Math.max(0, line.quantity - line.completedQuantity);
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <InvoiceWorkPanel
            invoiceId={inv.id}
            clientId={inv.clientId}
            items={detailQuery.data?.items ?? []}
          />

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Historial de cobros</h2>
              {paymentsQuery.isLoading && <p className="text-sm">Cargando cobros...</p>}
              {(paymentsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-base-content/60">No hay cobros registrados en caja para este pedido.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Método</th>
                        <th className="text-right">CUP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsQuery.data?.map((payment) => (
                        <tr key={payment.id}>
                          <td className="text-xs">{payment.date.slice(0, 16).replace("T", " ")}</td>
                          <td>{payment.concept}</td>
                          <td className="capitalize">{payment.paymentMethod}</td>
                          <td className="text-right">{formatMoney(payment.amountCup)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
