import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle, Plus, Wallet } from "lucide-react";
import { fetchCashBalance, fetchCashDailySeries, fetchCashTransactions } from "@/db/queries/cashflow";
import { formatMoney } from "@/lib/format-money";

/**
 * Dashboard de flujo de caja: balance CUP/USD, serie de 30 días y últimas
 * transacciones.
 *
 * @returns Página de flujo de caja.
 */
export function CashflowPage() {
  const balanceQuery = useQuery({ queryKey: ["cashflow", "balance"], queryFn: fetchCashBalance });
  const seriesQuery = useQuery({ queryKey: ["cashflow", "series"], queryFn: fetchCashDailySeries });
  const txQuery = useQuery({ queryKey: ["cashflow", "list"], queryFn: () => fetchCashTransactions() });

  const balance = balanceQuery.data;
  const recent = (txQuery.data ?? []).slice(0, 10);
  const series = (seriesQuery.data ?? []).map((point) => ({ name: point.date.slice(5), net: point.netCup }));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wallet className="h-6 w-6" /> Flujo de Caja
        </h1>
        <div className="flex gap-2">
          <Link to="/caja/historial" className="btn btn-outline btn-sm">
            Historial
          </Link>
          <Link to="/caja/nuevo" className="btn btn-primary btn-sm gap-1">
            <Plus className="h-4 w-4" /> Movimiento
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <p className="text-xs uppercase text-base-content/60">Balance CUP</p>
            <p className="text-2xl font-semibold">{formatMoney(balance?.balanceCup ?? 0)}</p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <p className="text-xs uppercase text-base-content/60">Balance USD</p>
            <p className="text-2xl font-semibold">${(balance?.balanceUsd ?? 0).toFixed(2)}</p>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body flex-row items-center gap-3 p-4">
            <ArrowUpCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs uppercase text-base-content/60">Ingresos</p>
              <p className="text-lg font-semibold">{formatMoney(balance?.totalIncomeCup ?? 0)}</p>
            </div>
          </div>
        </div>
        <div className="card bg-base-200">
          <div className="card-body flex-row items-center gap-3 p-4">
            <ArrowDownCircle className="h-8 w-8 text-error" />
            <div>
              <p className="text-xs uppercase text-base-content/60">Egresos</p>
              <p className="text-lg font-semibold">{formatMoney(balance?.totalExpenseCup ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Flujo neto (últimos 30 días)</h2>
          {seriesQuery.isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-base-300" />
          ) : series.length === 0 ? (
            <p className="py-10 text-center text-sm text-base-content/60">Sin movimientos en el período.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Area type="monotone" dataKey="net" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Últimas transacciones</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th className="text-right">Importe CUP</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr key={tx.id}>
                    <td className="text-xs">{tx.date.slice(0, 16).replace("T", " ")}</td>
                    <td>{tx.concept}</td>
                    <td className="capitalize">{tx.paymentMethod}</td>
                    <td
                      className={`text-right font-medium ${tx.transactionType === "ingreso" ? "text-success" : "text-error"}`}
                    >
                      {tx.transactionType === "ingreso" ? "+" : "−"}
                      {formatMoney(tx.amountCup)}
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-base-content/60">
                      Sin transacciones.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
