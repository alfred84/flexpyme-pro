import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTopDebtors } from "@/db/queries/reports";
import { DualPhysicalAmounts, ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { ReportTableSection } from "@/lib/report-export";

/**
 * Cuentas por cobrar actuales (saldo físico USD y CUP de clientes; no filtra por periodo).
 *
 * @param props - Callback de exporte (`enabled` controla la carga).
 * @returns Vista del informe.
 */
export function ReceivablesReport(props: OperationalReportViewProps) {
  const { enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "top-debtors", 25],
    queryFn: () => fetchTopDebtors(25),
    enabled,
  });

  const rows = query.data ?? [];
  const totals = useMemo(() => {
    let usd = 0;
    let cup = 0;
    for (const row of rows) {
      usd += row.balanceUsd;
      cup += row.balanceCup;
    }
    return { usd, cup };
  }, [rows]);

  useEffect(() => {
    if (!enabled || !query.data) {
      onSectionsChange(null);
      return;
    }
    const sections: ReportTableSection[] = [
      {
        name: "CUENTAS_POR_COBRAR",
        aoa: [
          ["Nota", "Saldos actuales (no dependen del periodo de fechas)"],
          ["Periodo UI", periodLabel],
          ["Código", "Cliente", "Balance USD", "Balance CUP", "Equiv. CUP"],
          ...query.data.map((row) => [
            row.clientCode,
            row.clientName,
            row.balanceUsd,
            row.balanceCup,
            row.balance,
          ]),
        ],
      },
    ];
    onSectionsChange(sections);
  }, [enabled, onSectionsChange, periodLabel, query.data]);

  if (query.isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-base-200" />;
  }
  if (query.isError) {
    return (
      <div className="alert alert-error">
        <span>No se pudieron cargar las cuentas por cobrar.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-base-content/60">
        Saldo abierto actual por moneda de cobro (USD y CUP), independiente del periodo seleccionado.
      </p>
      <ReportKpiCard label="Saldo listado">
        <DualPhysicalAmounts
          amountCup={totals.cup}
          amountUsd={totals.usd}
          valueClassName="text-warning"
        />
      </ReportKpiCard>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-base-content/60">No hay balances pendientes.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th className="text-right">{moneyHeading("Balance", "USD")}</th>
                <th className="text-right">{moneyHeading("Balance", "CUP")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.clientId}>
                  <td className="font-mono text-xs">{row.clientCode}</td>
                  <td>{row.clientName}</td>
                  <td className="text-right tabular-nums">{formatAmount(row.balanceUsd)}</td>
                  <td className="text-right tabular-nums">{formatAmount(row.balanceCup)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
