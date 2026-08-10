import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchCashTransactions } from "@/db/queries/cashflow";
import { CashTransactionReference } from "@/components/cashflow/CashTransactionReference";
import {
  cashAmountClassName,
  formatCashNet,
  formatSignedCashAmount,
  hasCashAmount,
} from "@/features/cashflow/lib/cash-amount-display";
import { formatDateTime } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";

/**
 * Historial de caja con filtros y totales duales CUP/USD del período.
 *
 * @returns Página de historial de caja.
 */
export function CashflowHistoryPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("");
  const [concept, setConcept] = useState("");
  const [currency, setCurrency] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const txQuery = useQuery({
    queryKey: [
      "cashflow",
      "history",
      dateFrom,
      dateTo,
      type,
      concept,
      currency,
      paymentMethod,
    ],
    queryFn: () =>
      fetchCashTransactions({
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        transactionType: type || null,
        concept: concept || null,
        currency: currency || null,
        paymentMethod: paymentMethod || null,
      }),
  });

  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);
  const totals = useMemo(() => {
    let incomeCup = 0;
    let expenseCup = 0;
    let incomeUsd = 0;
    let expenseUsd = 0;
    for (const tx of transactions) {
      if (tx.transactionType === "ingreso") {
        incomeCup += tx.amountCup;
        incomeUsd += tx.amountUsd;
      } else {
        expenseCup += tx.amountCup;
        expenseUsd += tx.amountUsd;
      }
    }
    return {
      incomeCup,
      expenseCup,
      netCup: incomeCup - expenseCup,
      incomeUsd,
      expenseUsd,
      netUsd: incomeUsd - expenseUsd,
    };
  }, [transactions]);

  const netCupDisplay = formatCashNet(totals.netCup);
  const netUsdDisplay = formatCashNet(totals.netUsd);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historial de caja</h1>
          <p className="text-sm text-base-content/70">
            Totales y filas por moneda física (sin convertir entre CUP y USD).
          </p>
        </div>
        <Link to="/caja" className="btn btn-ghost btn-sm">
          Volver
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="form-control">
          <label className="label py-1" htmlFor="h-from">
            <span className="label-text">Desde</span>
          </label>
          <input
            id="h-from"
            type="date"
            className="input input-bordered input-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label py-1" htmlFor="h-to">
            <span className="label-text">Hasta</span>
          </label>
          <input
            id="h-to"
            type="date"
            className="input input-bordered input-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="form-control">
          <label className="label py-1" htmlFor="h-type">
            <span className="label-text">Tipo</span>
          </label>
          <select
            id="h-type"
            className="select select-bordered select-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label py-1" htmlFor="h-currency">
            <span className="label-text">Moneda</span>
          </label>
          <select
            id="h-currency"
            className="select select-bordered select-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="cup">Solo CUP</option>
            <option value="usd">Solo USD</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>
        <div className="form-control">
          <label className="label py-1" htmlFor="h-method">
            <span className="label-text">Método</span>
          </label>
          <select
            id="h-method"
            className="select select-bordered select-sm"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
        <div className="form-control min-w-[12rem] flex-1">
          <label className="label py-1" htmlFor="h-concept">
            <span className="label-text">Concepto</span>
          </label>
          <input
            id="h-concept"
            type="search"
            className="input input-bordered input-sm w-full"
            placeholder="Buscar concepto..."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-base-300 bg-base-100 p-3">
          <p className="text-xs uppercase text-base-content/60">Ingresos</p>
          <p className="text-sm text-base-content/50">{moneyHeading("Ingresos", "CUP")}</p>
          <p className="text-lg font-semibold tabular-nums text-success">
            {formatAmount(totals.incomeCup)}
          </p>
          <p className="mt-1 text-sm text-base-content/50">{moneyHeading("Ingresos", "USD")}</p>
          <p className="text-lg font-semibold tabular-nums text-success">
            {formatAmount(totals.incomeUsd)}
          </p>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-3">
          <p className="text-xs uppercase text-base-content/60">Egresos</p>
          <p className="text-sm text-base-content/50">{moneyHeading("Egresos", "CUP")}</p>
          <p className="text-lg font-semibold tabular-nums text-error">
            {formatAmount(totals.expenseCup)}
          </p>
          <p className="mt-1 text-sm text-base-content/50">{moneyHeading("Egresos", "USD")}</p>
          <p className="text-lg font-semibold tabular-nums text-error">
            {formatAmount(totals.expenseUsd)}
          </p>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-3">
          <p className="text-xs uppercase text-base-content/60">Neto</p>
          <p className="text-sm text-base-content/50">{moneyHeading("Neto", "CUP")}</p>
          <p className={`text-lg ${netCupDisplay.className}`}>{netCupDisplay.text}</p>
          <p className="mt-1 text-sm text-base-content/50">{moneyHeading("Neto", "USD")}</p>
          <p className={`text-lg ${netUsdDisplay.className}`}>{netUsdDisplay.text}</p>
        </div>
      </div>

      {txQuery.isLoading && <p className="text-sm text-base-content/60">Cargando…</p>}
      {txQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el historial de caja.</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-zebra table-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Referencia</th>
              <th>Método</th>
              <th className="text-right">{moneyHeading("Importe", "CUP")}</th>
              <th className="text-right">{moneyHeading("Importe", "USD")}</th>
              <th className="text-right">Tasa</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const isIncome = tx.transactionType === "ingreso";
              return (
                <tr key={tx.id}>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(tx.date)}</td>
                  <td>{tx.concept}</td>
                  <td>
                    <CashTransactionReference
                      referenceType={tx.referenceType}
                      referenceId={tx.referenceId}
                    />
                  </td>
                  <td className="capitalize">{tx.paymentMethod}</td>
                  <td className={`text-right ${cashAmountClassName(tx.amountCup, isIncome)}`}>
                    {formatSignedCashAmount(tx.amountCup, isIncome)}
                  </td>
                  <td className={`text-right ${cashAmountClassName(tx.amountUsd, isIncome)}`}>
                    {formatSignedCashAmount(tx.amountUsd, isIncome)}
                  </td>
                  <td className="text-right tabular-nums text-base-content/70">
                    {hasCashAmount(tx.amountUsd) && hasCashAmount(tx.exchangeRate)
                      ? formatAmount(tx.exchangeRate)
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && !txQuery.isLoading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-base-content/60">
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
