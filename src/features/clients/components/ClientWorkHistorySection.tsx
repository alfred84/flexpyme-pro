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
  /** Total histórico USD precargado (evita parpadeo). */
  totalHistoricalUsdHint?: number;
  /** Total histórico CUP precargado (evita parpadeo). */
  totalHistoricalCupHint?: number;
}

/**
 * Tabla de pedidos de un cliente con totales históricos duales (por moneda de cobro).
 *
 * @param props - Identificador del cliente y totales opcionales precargados.
 * @returns Sección con estadística y tabla (vacía si no hay pedidos).
 */
export function ClientWorkHistorySection(props: ClientWorkHistorySectionProps) {
  const { clientId, totalHistoricalUsdHint, totalHistoricalCupHint } = props;

  const historyQuery = useQuery({
    queryKey: ["clients", "work-history", clientId],
    queryFn: () => fetchClientWorkHistory(clientId),
    enabled: Number.isFinite(clientId) && clientId > 0,
  });

  const totalHistoricalUsd =
    historyQuery.data?.totalHistoricalUsd ?? totalHistoricalUsdHint ?? 0;
  const totalHistoricalCup =
    historyQuery.data?.totalHistoricalCup ?? totalHistoricalCupHint ?? 0;
  const rows = historyQuery.data?.invoices ?? [];

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="card-title text-base">Historial de trabajos</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="rounded-lg border border-base-300 bg-base-200 px-4 py-2">
              <span className="text-base-content/60">
                {moneyHeading("Total histórico", "USD")}:{" "}
              </span>
              <span className="font-semibold tabular-nums">{formatAmount(totalHistoricalUsd)}</span>
            </div>
            <div className="rounded-lg border border-base-300 bg-base-200 px-4 py-2">
              <span className="text-base-content/60">
                {moneyHeading("Total histórico", "CUP")}:{" "}
              </span>
              <span className="font-semibold tabular-nums">{formatAmount(totalHistoricalCup)}</span>
            </div>
          </div>
        </div>

        {historyQuery.isLoading && (
          <p className="text-sm text-base-content/70">Cargando historial...</p>
        )}
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
                  <th className="text-right">{moneyHeading("Total", "USD")}</th>
                  <th className="text-right">{moneyHeading("Total", "CUP")}</th>
                  <th>Producción</th>
                  <th>Cobro</th>
                  <th className="w-0" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-base-content/60">
                      Este cliente no tiene pedidos registrados.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const cur = (row.paymentCurrency ?? "").toLowerCase();
                    const showUsd = cur === "usd" || cur === "mixto";
                    const showCup = cur === "cup" || cur === "mixto" || cur === "";
                    const amountUsd = row.dueUsd > 0 ? row.dueUsd : row.totalUsd;
                    const amountCup = row.dueCup > 0 ? row.dueCup : showCup ? row.total : 0;
                    return (
                      <tr key={row.id}>
                        <td className="font-mono text-xs">{row.invoiceNumber}</td>
                        <td>{formatDate(row.date)}</td>
                        <td className="text-right tabular-nums">
                          {showUsd && amountUsd > 0 ? formatAmount(amountUsd) : "—"}
                        </td>
                        <td className="text-right tabular-nums">
                          {showCup && amountCup > 0 ? formatAmount(amountCup) : "—"}
                        </td>
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
