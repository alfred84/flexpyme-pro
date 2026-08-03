import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchCashTransactions } from "@/db/queries/cashflow";
import { CashTransactionReference } from "@/components/cashflow/CashTransactionReference";
import { formatDateTime } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";

/**
 * Historial completo de caja con filtros por fecha y tipo, más totales del
 * período seleccionado.
 *
 * @returns Página de historial de caja.
 */
export function CashflowHistoryPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("");

  const txQuery = useQuery({
    queryKey: ["cashflow", "history", dateFrom, dateTo, type],
    queryFn: () =>
      fetchCashTransactions({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        transactionType: type || null,
      }),
  });

  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.transactionType === "ingreso") {
        income += tx.amountCup;
      } else {
        expense += tx.amountCup;
      }
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Historial de caja</h1>
        <Link to="/caja" className="btn btn-ghost btn-sm">
          Volver
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-base-200 p-4">
        <div className="form-control">
          <label className="label" htmlFor="h-from">
            <span className="label-text">Desde</span>
          </label>
          <input id="h-from" type="date" className="input input-bordered input-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="h-to">
            <span className="label-text">Hasta</span>
          </label>
          <input id="h-to" type="date" className="input input-bordered input-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="form-control">
          <label className="label" htmlFor="h-type">
            <span className="label-text">Tipo</span>
          </label>
          <select id="h-type" className="select select-bordered select-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat rounded-lg bg-base-200">
          <div className="stat-title">{moneyHeading("Ingresos")}</div>
          <div className="stat-value text-lg text-success">{formatAmount(totals.income)}</div>
        </div>
        <div className="stat rounded-lg bg-base-200">
          <div className="stat-title">{moneyHeading("Egresos")}</div>
          <div className="stat-value text-lg text-error">{formatAmount(totals.expense)}</div>
        </div>
        <div className="stat rounded-lg bg-base-200">
          <div className="stat-title">{moneyHeading("Neto")}</div>
          <div className="stat-value text-lg">{formatAmount(totals.net)}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Referencia</th>
              <th>Método</th>
              <th className="text-right">{moneyHeading("Importe")}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="text-xs">{formatDateTime(tx.date)}</td>
                <td>{tx.concept}</td>
                <td>
                  <CashTransactionReference
                    referenceType={tx.referenceType}
                    referenceId={tx.referenceId}
                  />
                </td>
                <td className="capitalize">{tx.paymentMethod}</td>
                <td
                  className={`text-right font-medium ${tx.transactionType === "ingreso" ? "text-success" : "text-error"}`}
                >
                  {tx.transactionType === "ingreso" ? "+" : "−"}
                  {formatAmount(tx.amountCup)}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-base-content/60">
                  Sin transacciones en el período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
