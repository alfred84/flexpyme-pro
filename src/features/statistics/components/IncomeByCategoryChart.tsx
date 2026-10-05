import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchIncomeByCategory } from "@/db/queries/reports";
import { monthEndIso, monthStartIso, todayIso } from "@/lib/format-date";
import { formatAmount } from "@/lib/format-money";

/**
 * Gráfico de ingresos físicos por categoría del mes calendario actual.
 * Barras USD (eje izquierdo) y CUP (eje derecho), sin conversión por tasa.
 *
 * @returns Tarjeta con el gráfico o estados de carga/vacío.
 */
export function IncomeByCategoryChart() {
  const today = todayIso();
  const monthStart = monthStartIso(today);
  const monthEnd = monthEndIso(today);

  const incomeQuery = useQuery({
    queryKey: ["reports", "income-by-category", monthStart, monthEnd],
    queryFn: () => fetchIncomeByCategory({ dateFrom: monthStart, dateTo: monthEnd }),
  });

  const chartData = useMemo(
    () =>
      (incomeQuery.data ?? []).map((row) => ({
        name: row.label,
        totalCup: row.totalCup,
        totalUsd: row.totalUsd,
      })),
    [incomeQuery.data],
  );

  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <h2 className="card-title text-base">Ingresos por categoría (mes actual)</h2>
        {incomeQuery.isLoading ? (
          <div className="h-72 animate-pulse rounded-lg bg-base-300" />
        ) : incomeQuery.isError ? (
          <div className="alert alert-error">
            <span>No se pudieron cargar los ingresos por categoría.</span>
          </div>
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-base-content/60">Sin datos en el período.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="usd"
                  tick={{ fontSize: 11 }}
                  width={56}
                  tickFormatter={(value: number) => formatAmount(Number(value))}
                  label={{ value: "USD", angle: -90, position: "insideLeft", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="cup"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  width={72}
                  tickFormatter={(value: number) => formatAmount(Number(value))}
                  label={{ value: "CUP", angle: 90, position: "insideRight", fontSize: 10 }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatAmount(Number(value)),
                    name === "totalUsd" ? "USD" : "CUP",
                  ]}
                />
                <Legend formatter={(value) => (value === "totalUsd" ? "USD" : "CUP")} />
                <Bar
                  yAxisId="usd"
                  dataKey="totalUsd"
                  name="totalUsd"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="cup"
                  dataKey="totalCup"
                  name="totalCup"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
