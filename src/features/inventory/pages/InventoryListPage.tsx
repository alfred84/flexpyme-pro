import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Package, Plus } from "lucide-react";
import { fetchInventoryItems } from "@/db/queries/inventory";
import { formatMoney } from "@/lib/format-money";

/**
 * Listado de inventario con alertas visuales de stock bajo.
 *
 * @returns Página de inventario.
 */
export function InventoryListPage() {
  const itemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });

  const items = itemsQuery.data ?? [];
  const lowStockCount = items.filter((item) => item.lowStock).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Package className="h-6 w-6" /> Inventario
        </h1>
        <Link to="/inventario/nuevo" className="btn btn-primary btn-sm gap-1">
          <Plus className="h-4 w-4" /> Nuevo ítem
        </Link>
      </div>

      {lowStockCount > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle className="h-5 w-5" />
          <span>
            <strong>{lowStockCount}</strong> ítem(s) en stock bajo.
          </span>
        </div>
      )}

      {itemsQuery.isLoading && <p>Cargando inventario...</p>}
      {itemsQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el inventario.</span>
        </div>
      )}

      {itemsQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th className="text-right">Stock</th>
                <th>Unidad</th>
                <th className="text-right">Stock mín.</th>
                <th className="text-right">Costo unit.</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.lowStock ? "bg-error/10" : ""}>
                  <td className="font-medium">{item.name}</td>
                  <td>{item.category ?? "—"}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td className="text-right">{item.minStock}</td>
                  <td className="text-right">{formatMoney(item.costPerUnit)}</td>
                  <td>
                    {item.lowStock ? (
                      <span className="badge badge-sm badge-error">Bajo</span>
                    ) : (
                      <span className="badge badge-sm badge-success">OK</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Link
                      className="btn btn-xs btn-outline"
                      to="/inventario/$itemId"
                      params={{ itemId: String(item.id) }}
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-base-content/60">
                    No hay ítems de inventario todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
