import { BarChart3 } from "lucide-react";
import { IncomeByCategoryChart } from "@/features/statistics/components/IncomeByCategoryChart";

/**
 * Pantalla de Estadísticas: gráficos de ingresos y otros indicadores visuales.
 *
 * @returns Página de estadísticas.
 */
export function StatisticsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6" /> Estadísticas
        </h1>
        <p className="text-sm text-base-content/70">
          Ingresos del mes en curso por categoría de producto, en USD y CUP (montos físicos, sin
          conversión).
        </p>
      </div>
      <IncomeByCategoryChart />
    </section>
  );
}
