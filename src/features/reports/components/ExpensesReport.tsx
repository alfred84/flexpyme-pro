import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOtherExpenses } from "@/db/queries/other-expenses";
import { DualPhysicalAmounts, ReportKpiCard } from "@/features/reports/components/ReportKpis";
import type { OperationalReportViewProps } from "@/features/reports/components/report-view-props";
import { formatDate } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { ReportTableSection } from "@/lib/report-export";

/**
 * Filtra gastos por rango ISO (inclusivo). Sin fechas = todos.
 *
 * @param date - Fecha del gasto.
 * @param dateFrom - Inicio o `null`.
 * @param dateTo - Fin o `null`.
 * @returns Si el gasto entra en el periodo.
 */
function expenseInRange(date: string, dateFrom: string | null, dateTo: string | null): boolean {
  const day = date.trim().slice(0, 10);
  if (dateFrom && day < dateFrom) {
    return false;
  }
  if (dateTo && day > dateTo) {
    return false;
  }
  return true;
}

/**
 * Otros gastos del periodo con totales CUP/USD.
 *
 * @param props - Rango, habilitación y callback de exporte.
 * @returns Vista del informe.
 */
export function ExpensesReport(props: OperationalReportViewProps) {
  const { dateFrom, dateTo, enabled, periodLabel, onSectionsChange } = props;
  const query = useQuery({
    queryKey: ["reports", "other-expenses"],
    queryFn: fetchOtherExpenses,
    enabled,
  });

  const rows = useMemo(
    () => (query.data ?? []).filter((row) => expenseInRange(row.date, dateFrom, dateTo)),
    [dateFrom, dateTo, query.data],
  );

  const totals = useMemo(() => {
    let cup = 0;
    let usd = 0;
    for (const row of rows) {
      cup += row.amountCup;
      usd += row.amountUsd;
    }
    return { cup, usd };
  }, [rows]);

  useEffect(() => {
    if (!enabled || !query.data) {
      onSectionsChange(null);
      return;
    }
    const sections: ReportTableSection[] = [
      {
        name: "OTROS_GASTOS",
        aoa: [
          ["Periodo", periodLabel],
          ["Fecha", "Concepto", "Tipo", "Empleado", "CUP", "USD", "Método"],
          ...rows.map((row) => [
            row.date,
            row.concept,
            row.expenseType,
            row.employeeName ?? "",
            row.amountCup,
            row.amountUsd,
            row.paymentMethod,
          ]),
          ["TOTAL", "", "", "", totals.cup, totals.usd, ""],
        ],
      },
    ];
    onSectionsChange(sections);
  }, [enabled, onSectionsChange, periodLabel, query.data, rows, totals]);

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
        <span>No se pudieron cargar los gastos.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReportKpiCard label="Total del periodo">
        <DualPhysicalAmounts amountCup={totals.cup} amountUsd={totals.usd} valueClassName="text-error" />
      </ReportKpiCard>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-base-content/60">Sin gastos en este periodo.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Tipo</th>
                <th className="text-right">{moneyHeading("Importe", "CUP")}</th>
                <th className="text-right">{moneyHeading("Importe", "USD")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.date)}</td>
                  <td className="max-w-[14rem] truncate">{row.concept}</td>
                  <td>{row.expenseType}</td>
                  <td className="text-right tabular-nums">{formatAmount(row.amountCup)}</td>
                  <td className="text-right tabular-nums">{formatAmount(row.amountUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
