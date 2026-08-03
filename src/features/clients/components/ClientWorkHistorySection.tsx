import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import { ProductionStatusBadge, PaymentStatusBadge } from "@/components/invoices/InvoiceStatusBadges";
import { fetchClientWorkHistory } from "@/db/queries/clients";
import { formatDate } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";

interface ClientWorkHistorySectionProps {
  /** Id del cliente cuyo historial se muestra. */
  clientId: number;
  /** Total histórico ya cargado en la ficha (opcional, evita parpadeo). */
  totalHistoricalHint?: number;
}

/**
 * Tabla de pedidos realizados a un cliente y resumen del total histórico.
 *
 * @param props - Identificador del cliente y total opcional precargado.
 * @returns Sección con estadística y tabla (vacía si no hay pedidos).
 */
export function ClientWorkHistorySection(props: ClientWorkHistorySectionProps) {
  const { clientId, totalHistoricalHint } = props;

  const historyQuery = useQuery({
    queryKey: ["clients", "work-history", clientId],
    queryFn: () => fetchClientWorkHistory(clientId),
    enabled: Number.isFinite(clientId) && clientId > 0,
  });

  const totalHistorical = historyQuery.data?.totalHistorical ?? totalHistoricalHint ?? 0;
  const rows = historyQuery.data?.invoices ?? [];

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="card-title text-base">Historial de trabajos</h2>
          </div>
          <div className="rounded-lg border border-base-300 bg-base-200 px-4 py-2 text-sm">
            <span className="text-base-content/60">{moneyHeading("Total histórico")}: </span>
            <span className="font-semibold tabular-nums">{formatAmount(totalHistorical)}</span>
          </div>
        </div>

        {historyQuery.isLoading && <p className="text-sm text-base-content/70">Cargando historial...</p>}
        {historyQuery.isError && (
          <div className="alert alert-error py-2 text-sm">
            <span>No se pudo cargar el historial de pedidos.</span>
          </div>
        )}

        {historyQuery.isSuccess && (
          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Nº pedido</th>
                  <th>Fecha</th>
                  <th>{moneyHeading("Total")}</th>
                  <th>Producción</th>
                  <th>Cobro</th>
                  <th className="w-0" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-base-content/60">
                      Este cliente no tiene pedidos registrados.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.invoiceNumber}</td>
                      <td>{formatDate(row.date)}</td>
                      <td className="tabular-nums">{formatAmount(row.total)}</td>
                      <td>
                        <ProductionStatusBadge status={row.productionStatus} />
                      </td>
                      <td>
                        <PaymentStatusBadge status={row.paymentStatus} />
                      </td>
                      <td>
                        <Link
                          className="btn btn-xs btn-ghost"
                          to="/pedidos/$invoiceId"
                          params={{ invoiceId: String(row.id) }}
                        >
                          Ver pedido
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
