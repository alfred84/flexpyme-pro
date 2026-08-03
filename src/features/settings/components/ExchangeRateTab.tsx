import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAllSettings, fetchExchangeRateHistory, setExchangeRate } from "@/db/queries/settings";
import { formatDateTime } from "@/lib/format-date";
import { formatAmount } from "@/lib/format-money";

/**
 * Tab de tasa de cambio USD → CUP con histórico de cambios.
 *
 * @returns Panel de configuración de tasa de cambio.
 */
export function ExchangeRateTab() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings", "all"], queryFn: fetchAllSettings });
  const historyQuery = useQuery({
    queryKey: ["settings", "exchange-rate-history"],
    queryFn: () => fetchExchangeRateHistory(30),
  });
  const [rate, setRate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const current = settingsQuery.data?.usd_exchange_rate ?? "";

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = Number.parseFloat((rate ?? current).replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Indica una tasa válida mayor que cero.");
      }
      return setExchangeRate(parsed, "config");
    },
    onSuccess: async () => {
      setSaved(true);
      setRate(null);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["settings", "exchange-rate-history"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="card max-w-md bg-base-200">
        <div className="card-body space-y-3">
          <h2 className="card-title text-base">Tasa USD → CUP</h2>
          {saved && <div className="alert alert-success py-2 text-sm">Tasa actualizada.</div>}
          {mutation.isError && (
            <div className="alert alert-error py-2 text-sm">
              <span>{(mutation.error as Error).message}</span>
            </div>
          )}
          <label className="form-control">
            <span className="label-text">Cuántos CUP equivale 1 USD</span>
            <input
              id="exchange-rate-input"
              type="number"
              className="input input-bordered"
              defaultValue={current}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <div>
            <button className="btn btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar tasa"}
            </button>
          </div>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Histórico de tasas</h2>
          {historyQuery.isLoading && <p className="text-sm text-base-content/60">Cargando histórico...</p>}
          {(historyQuery.data ?? []).length === 0 && !historyQuery.isLoading && (
            <p className="text-sm text-base-content/60">Aún no hay cambios registrados.</p>
          )}
          {(historyQuery.data ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="text-right">Tasa (CUP)</th>
                    <th>Anterior</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {historyQuery.data?.map((row) => (
                    <tr key={row.id}>
                      <td className="text-xs">{formatDateTime(row.effectiveAt)}</td>
                      <td className="text-right font-mono">{formatAmount(row.rate)}</td>
                      <td className="text-right font-mono text-base-content/70">
                        {row.previousRate != null ? formatAmount(row.previousRate) : "—"}
                      </td>
                      <td>
                        <span className="badge badge-ghost badge-sm">
                          {row.source === "header" ? "Cabecera" : "Configuración"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
