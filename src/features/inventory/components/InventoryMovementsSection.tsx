import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fetchInventoryMovementsList } from "@/db/queries/inventory";
import { formatDate } from "@/lib/format-date";

type MovementPeriod = "hoy" | "mes" | "todos";

const PERIOD_OPTIONS: { id: MovementPeriod; label: string }[] = [
  { id: "hoy", label: "Día actual" },
  { id: "mes", label: "Mes actual" },
  { id: "todos", label: "Todos" },
];

/**
 * Sección de movimientos globales de inventario con filtro Día/Mes/Todos
 * (por defecto mes actual).
 *
 * @returns Bloque de UI para la pantalla principal de Inventario.
 */
export function InventoryMovementsSection() {
  const [period, setPeriod] = useState<MovementPeriod>("mes");
  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements", "list", period],
    queryFn: () => fetchInventoryMovementsList(period),
  });

  const movements = movementsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Movimientos de materiales de inventario</h2>
          <p className="text-xs text-base-content/60">
            Filtra la tabla de forma rápida. Por defecto: mes actual.
          </p>
        </div>
        <div className="join" role="group" aria-label="Filtrar movimientos por periodo">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn btn-sm join-item ${period === opt.id ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={period === opt.id}
              onClick={() => setPeriod(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {movementsQuery.isLoading && (
        <p className="text-sm text-base-content/60">Cargando movimientos…</p>
      )}
      {movementsQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los movimientos.</span>
        </div>
      )}

      {movementsQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th>Tipo</th>
                <th className="text-right">Cantidad</th>
                <th>Motivo</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mov) => (
                <tr key={mov.id}>
                  <td className="text-xs whitespace-nowrap">{formatDate(mov.date)}</td>
                  <td>
                    <Link
                      to="/inventario/$itemId"
                      params={{ itemId: String(mov.itemId) }}
                      className="link link-hover font-medium"
                    >
                      {mov.itemName}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`badge badge-sm ${
                        mov.movementType === "entrada" ? "badge-success" : "badge-warning"
                      }`}
                    >
                      {mov.movementType === "entrada" ? "Entrada" : "Salida"}
                    </span>
                  </td>
                  <td className="text-right">{mov.quantity}</td>
                  <td className="max-w-[16rem] truncate" title={mov.reason ?? undefined}>
                    {mov.reason ?? "—"}
                  </td>
                  <td>
                    {mov.method === "Manual" ? (
                      <span className="badge badge-sm badge-ghost">{mov.method}</span>
                    ) : mov.method === "Rebaja por Pedido" ? (
                      <span className="badge badge-sm badge-info">{mov.method}</span>
                    ) : mov.method === "Merma" ? (
                      <span className="badge badge-sm badge-warning">{mov.method}</span>
                    ) : (
                      <span className="text-base-content/50">{mov.method}</span>
                    )}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-base-content/60">
                    No hay movimientos en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
