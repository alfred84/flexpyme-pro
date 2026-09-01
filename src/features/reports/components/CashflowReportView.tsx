import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCashTransactions } from "@/db/queries/cashflow";
import { DualPhysicalAmounts, ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import { formatDate } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { ReportTableSection } from "@/lib/report-export";

const EPS = 1e-6;

/**
 * Flujo de caja del periodo: ingresos, egresos y neto por moneda física.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function CashflowReportView(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "cashflow", dateFrom, dateTo],
    queryFn: () =>
      fetchCashTransactions(dateFrom || dateTo ? { dateFrom, dateTo } : undefined),
    enabled,
  });

  const totals = useMemo(() => {
    let incomeCup = 0;
    let incomeUsd = 0;
    let expenseCup = 0;
    let expenseUsd = 0;
    for (const tx of query.data ?? []) {
      const type = tx.transactionType.toLowerCase();
      if (type === "ingreso") {
        incomeCup += tx.amountCup;
        incomeUsd += tx.amountUsd;
      } else if (type === "egreso") {
        expenseCup += tx.amountCup;
        expenseUsd += tx.amountUsd;
      }
    }
    return {
      incomeCup,
      incomeUsd,
      expenseCup,
      expenseUsd,
      netCup: incomeCup - expenseCup,
      netUsd: incomeUsd - expenseUsd,
    };
  }, [query.data]);

  useEffect(() => {
    if (!enabled || !query.data) {
      onSectionsChange(null);
      return;
    }
    const sections: ReportTableSection[] = [
      {
        name: "CAJA_RESUMEN",
        aoa: [
          ["Métrica", "CUP", "USD"],
          ["Periodo", periodLabel, ""],
          ["Ingresos", totals.incomeCup, totals.incomeUsd],
          ["Egresos", totals.expenseCup, totals.expenseUsd],
          ["Neto", totals.netCup, totals.netUsd],
        ],
      },
      {
        name: "CAJA_MOVIMIENTOS",
        aoa: [
          ["Fecha", "Tipo", "Concepto", "CUP", "USD", "Método"],
          ...query.data.map((tx) => [
            tx.date,
            tx.transactionType,
            tx.concept,
            tx.amountCup,
            tx.amountUsd,
            tx.paymentMethod,
          ]),
        ],
      },
    ];
    onSectionsChange(sections);
  }, [enabled, onSectionsChange, periodLabel, query.data, totals]);

  if (!enabled) {
    return (
      <p className="py-10 text-center text-sm text-base-content/60">
        Complete el rango de fechas para ver el informe.
      </p>
    );
  }
  if (query.isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-base-200" />;
  }
  if (query.isError) {
    return (
      <div className="alert alert-error">
        <span>No se pudo cargar el flujo de caja.</span>
      </div>
    );
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ReportKpiCard label="Ingresos">
          <DualPhysicalAmounts
            amountCup={totals.incomeCup}
            amountUsd={totals.incomeUsd}
            valueClassName="text-success"
          />
        </ReportKpiCard>
        <ReportKpiCard label="Egresos">
          <DualPhysicalAmounts
            amountCup={totals.expenseCup}
            amountUsd={totals.expenseUsd}
            valueClassName="text-error"
          />
        </ReportKpiCard>
        <ReportKpiCard label="Neto">
          <DualPhysicalAmounts
            amountCup={totals.netCup}
            amountUsd={totals.netUsd}
            valueClassName={totals.netCup + totals.netUsd >= -EPS ? "text-success" : "text-error"}
          />
        </ReportKpiCard>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-base-content/60">
          Sin movimientos de caja en este periodo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th className="text-right">{moneyHeading("Importe", "CUP")}</th>
                <th className="text-right">{moneyHeading("Importe", "USD")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((tx) => (
                <tr key={tx.id}>
                  <td className="whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="capitalize">{tx.transactionType}</td>
                  <td className="max-w-[16rem] truncate">{tx.concept}</td>
                  <td className="text-right tabular-nums">{formatAmount(tx.amountCup)}</td>
                  <td className="text-right tabular-nums">{formatAmount(tx.amountUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 40 ? (
            <p className="px-3 py-2 text-xs text-base-content/60">
              Mostrando 40 de {rows.length} movimientos. El Excel/PDF incluye todos.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
