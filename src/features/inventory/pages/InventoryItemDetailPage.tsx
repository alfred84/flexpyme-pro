import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  fetchInventoryItem,
  fetchInventoryMovements,
  registerInventoryMovement,
} from "@/db/queries/inventory";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";

/**
 * Ficha de ítem de inventario con historial de movimientos y registro de
 * entradas/salidas.
 *
 * @returns Página de detalle de ítem de inventario.
 */
export function InventoryItemDetailPage() {
  const params = useParams({ strict: false }) as { itemId?: string };
  const itemId = Number(params.itemId);
  const queryClient = useQueryClient();

  const [movementType, setMovementType] = useState<"entrada" | "salida">("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const itemQuery = useQuery({
    queryKey: ["inventory", "item", itemId],
    queryFn: () => fetchInventoryItem(itemId),
    enabled: Number.isFinite(itemId),
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements", itemId],
    queryFn: () => fetchInventoryMovements(itemId),
    enabled: Number.isFinite(itemId),
  });

  const mutation = useMutation({
    mutationFn: registerInventoryMovement,
    onSuccess: async () => {
      setQuantity("");
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const item = itemQuery.data;
  const movements = movementsQuery.data ?? [];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Indica una cantidad mayor que cero.");
      return;
    }
    await mutation.mutateAsync({
      itemId,
      movementType,
      quantity: qty,
      reason: reason.trim() || null,
      notes: null,
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{item?.name ?? "Ítem"}</h1>
          {item && (
            <p className="text-sm text-base-content/60">
              {item.category ?? "Sin categoría"} · {item.unit}
            </p>
          )}
        </div>
        <Link to="/inventario" className="btn btn-ghost btn-sm">
          Volver
        </Link>
      </div>

      {item && (
        <div className="stats bg-base-200">
          <div className="stat">
            <div className="stat-title">Stock actual</div>
            <div className={`stat-value text-2xl ${item.lowStock ? "text-error" : ""}`}>{item.quantity}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Stock mínimo</div>
            <div className="stat-value text-2xl">{item.minStock}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Costo unitario</div>
            <div className="stat-value text-2xl">{formatMoney(item.costPerUnit)}</div>
          </div>
        </div>
      )}

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Registrar movimiento</h2>
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleRegister}>
            <div className="form-control">
              <label className="label" htmlFor="mov-type">
                <span className="label-text">Tipo</span>
              </label>
              <select
                id="mov-type"
                className="select select-bordered"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as "entrada" | "salida")}
              >
                <option value="entrada">Entrada (compra)</option>
                <option value="salida">Salida (uso)</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label" htmlFor="mov-qty">
                <span className="label-text">Cantidad</span>
              </label>
              <input
                id="mov-qty"
                type="number"
                className="input input-bordered w-32"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="form-control flex-1">
              <label className="label" htmlFor="mov-reason">
                <span className="label-text">Motivo</span>
              </label>
              <input
                id="mov-reason"
                className="input input-bordered w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              Registrar
            </button>
          </form>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Historial de movimientos</h2>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th className="text-right">Cantidad</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => (
                  <tr key={mov.id}>
                    <td className="text-xs">{formatDate(mov.date)}</td>
                    <td>
                      <span
                        className={`badge badge-sm ${mov.movementType === "entrada" ? "badge-success" : "badge-warning"}`}
                      >
                        {mov.movementType === "entrada" ? "Entrada" : "Salida"}
                      </span>
                    </td>
                    <td className="text-right">{mov.quantity}</td>
                    <td>{mov.reason ?? "—"}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-base-content/60">
                      Sin movimientos.
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
