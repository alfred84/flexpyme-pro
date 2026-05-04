import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { fetchInvoiceDetail } from "@/db/queries/invoices";
import { popFlashMessage, type FlashMessage } from "@/lib/flash-message";

const money = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" });

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
          <h1 className="text-2xl font-bold">Factura</h1>
          {inv && <p className="text-lg font-mono">{inv.invoiceNumber}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {inv && (
            <>
              <Link
                to="/facturas/$invoiceId/imprimir"
                params={{ invoiceId: String(inv.id) }}
                className="btn btn-outline btn-sm"
              >
                Imprimir
              </Link>
              <Link
                to="/facturas/$invoiceId/caja"
                params={{ invoiceId: String(inv.id) }}
                className={inv.balance > 1e-6 ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
              >
                Caja
              </Link>
            </>
          )}
          <Link to="/facturas" className="btn btn-ghost btn-sm">
            Volver al listado
          </Link>
        </div>
      </div>

      {detailQuery.isLoading && <p>Cargando...</p>}
      {detailQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar la factura.</span>
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
                    <dd>{inv.date}</dd>
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
                    <dd>{money.format(inv.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Deuda anterior</dt>
                    <dd>{money.format(inv.previousDebt)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Anticipado</dt>
                    <dd>{money.format(inv.advancePayment)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Total</dt>
                    <dd>{money.format(inv.total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Pagado</dt>
                    <dd>{money.format(inv.paid)}</dd>
                  </div>
                  <div className="flex justify-between text-primary">
                    <dt>Pendiente (sin saldo)</dt>
                    <dd>{money.format(inv.balance)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Formato</th>
                  <th>Servicio</th>
                  <th>Acabado</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">P. unit.</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detailQuery.data?.items.map((line) => (
                  <tr key={line.id}>
                    <td>{line.categoryName}</td>
                    <td>{line.formatLabel ?? "—"}</td>
                    <td>{line.service ?? "—"}</td>
                    <td>{line.finish ?? "—"}</td>
                    <td className="text-right">{line.quantity}</td>
                    <td className="text-right">{money.format(line.unitPrice)}</td>
                    <td className="text-right">{money.format(line.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
