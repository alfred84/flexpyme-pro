import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Banknote, Plus, Wallet } from "lucide-react";
import {
  fetchCashBalance,
  fetchCashDailySeries,
  fetchCashNetSummary,
  fetchCashTransactions,
} from "@/db/queries/cashflow";
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
 * Dashboard de flujo de caja: balances físicos CUP/USD, neto, serie e historial reciente.
 *
 * @returns Página de flujo de caja.
 */
export function CashflowPage() {
  const balanceQuery = useQuery({ queryKey: ["cashflow", "balance"], queryFn: fetchCashBalance });
  const seriesQuery = useQuery({ queryKey: ["cashflow", "series"], queryFn: fetchCashDailySeries });
  const netQuery = useQuery({ queryKey: ["cashflow", "net-summary"], queryFn: fetchCashNetSummary });
  const txQuery = useQuery({ queryKey: ["cashflow", "list"], queryFn: () => fetchCashTransactions() });

  const balance = balanceQuery.data;
  const net = netQuery.data;
  const recent = (txQuery.data ?? []).slice(0, 10);
  const series = (seriesQuery.data ?? []).map((point) => ({
    name: point.date.slice(5),
    netCup: point.netCup,
    netUsd: point.netUsd,
  }));

  const netTodayCup = formatCashNet(net?.netTodayCup ?? 0);
  const netTodayUsd = formatCashNet(net?.netTodayUsd ?? 0);
  const net30Cup = formatCashNet(net?.net30DaysCup ?? 0);
  const net30Usd = formatCashNet(net?.net30DaysUsd ?? 0);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wallet className="h-6 w-6" /> Flujo de Caja
          </h1>
          <p className="text-sm text-base-content/70">
            Cajones independientes: CUP y USD no se mezclan por conversión. La tasa es solo
            auditoría.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/caja/control" className="btn btn-outline btn-sm gap-1">
            <Banknote className="h-4 w-4" /> Control de efectivo
          </Link>
          <Link to="/caja/historial" className="btn btn-outline btn-sm">
            Historial
          </Link>
          <Link to="/caja/nuevo" className="btn btn-primary btn-sm gap-1">
            <Plus className="h-4 w-4" /> Movimiento
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase text-base-content/60">{moneyHeading("En caja", "CUP")}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {formatAmount(balance?.balanceCup ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase text-base-content/60">{moneyHeading("En caja", "USD")}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {formatAmount(balance?.balanceUsd ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <p className="mb-2 text-xs uppercase text-base-content/60">Flujo neto (hoy)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Neto", "CUP")}</p>
              <p className={`text-xl ${netTodayCup.className}`}>{netTodayCup.text}</p>
            </div>
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Neto", "USD")}</p>
              <p className={`text-xl ${netTodayUsd.className}`}>{netTodayUsd.text}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <p className="mb-2 text-xs uppercase text-base-content/60">Flujo neto (últimos 30 días)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Neto", "CUP")}</p>
              <p className={`text-xl ${net30Cup.className}`}>{net30Cup.text}</p>
            </div>
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Neto", "USD")}</p>
              <p className={`text-xl ${net30Usd.className}`}>{net30Usd.text}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-success" />
            <p className="text-xs uppercase text-base-content/60">Ingresos (acumulado)</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Ingresos", "CUP")}</p>
              <p className="text-lg font-semibold tabular-nums text-success">
                {formatAmount(balance?.totalIncomeCup ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Ingresos", "USD")}</p>
              <p className="text-lg font-semibold tabular-nums text-success">
                {formatAmount(balance?.totalIncomeUsd ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-error" />
            <p className="text-xs uppercase text-base-content/60">Egresos (acumulado)</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Egresos", "CUP")}</p>
              <p className="text-lg font-semibold tabular-nums text-error">
                {formatAmount(balance?.totalExpenseCup ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-base-content/50">{moneyHeading("Egresos", "USD")}</p>
              <p className="text-lg font-semibold tabular-nums text-error">
                {formatAmount(balance?.totalExpenseUsd ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <h2 className="mb-3 text-base font-semibold">Flujo neto diario (30 días)</h2>
        {seriesQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-base-300" />
        ) : series.length === 0 ? (
          <p className="py-10 text-center text-sm text-base-content/60">
            Sin movimientos en el período.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="cup"
                  tick={{ fontSize: 11 }}
                  width={64}
                  label={{ value: "CUP", angle: -90, position: "insideLeft", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="usd"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  width={48}
                  label={{ value: "USD", angle: 90, position: "insideRight", fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatAmount(Number(value)),
                    name === "netCup" ? "Neto CUP" : "Neto USD",
                  ]}
                />
                <Legend
                  formatter={(value) => (value === "netCup" ? "Neto CUP" : "Neto USD")}
                />
                <Line
                  yAxisId="cup"
                  type="monotone"
                  dataKey="netCup"
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="usd"
                  type="monotone"
                  dataKey="netUsd"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Últimas transacciones</h2>
          <Link to="/caja/historial" className="link link-hover text-sm">
            Ver historial
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm">
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
              {recent.map((tx) => {
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
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-base-content/60">
                    Sin transacciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
