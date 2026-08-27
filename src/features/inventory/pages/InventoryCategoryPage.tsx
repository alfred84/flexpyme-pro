import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { fetchInventoryItems, fetchMaterialCategories, fetchInventoryPendingOrderDemand } from "@/db/queries/inventory";
import { formatAmount, moneyHeading } from "@/lib/format-money";

/**
 * Formatea stock mínimo: 0 = sin umbral de alerta.
 *
 * @param minStock - Valor almacenado.
 * @returns Texto para UI.
 */
function formatMinStock(minStock: number): string {
  return minStock > 0 ? String(minStock) : "Sin establecer";
}

/**
 * Formatea costo unitario opcional.
 *
 * @param cost - Costo (CUP o USD).
 * @returns Texto para UI.
 */
function formatCost(cost: number): string {
  return cost > 0 ? formatAmount(cost) : "Sin establecer";
}

/**
 * Tabla de ítems de una categoría de material, con alta de ítem para esa categoría.
 *
 * @returns Pantalla de categoría de inventario.
 */
export function InventoryCategoryPage() {
  const params = useParams({ strict: false }) as { categoryId?: string };
  const categoryId = Number(params.categoryId);

  const categoriesQuery = useQuery({
    queryKey: ["inventory", "material-categories"],
    queryFn: () => fetchMaterialCategories(false),
  });
  const itemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });
  const pendingDemandQuery = useQuery({
    queryKey: ["inventory", "pending-order-demand"],
    queryFn: fetchInventoryPendingOrderDemand,
  });

  const category = useMemo(
    () => (categoriesQuery.data ?? []).find((c) => c.id === categoryId) ?? null,
    [categoriesQuery.data, categoryId],
  );

  const items = useMemo(
    () => (itemsQuery.data ?? []).filter((i) => i.materialCategoryId === categoryId),
    [itemsQuery.data, categoryId],
  );

  const demandByItemId = useMemo(() => {
    const map = new Map<number, { needed: number; available: number; unit: string }>();
    for (const d of pendingDemandQuery.data ?? []) {
      map.set(d.inventoryItemId, {
        needed: d.needed,
        available: d.available,
        unit: d.unit,
      });
    }
    return map;
  }, [pendingDemandQuery.data]);

  const validId = Number.isFinite(categoryId) && categoryId > 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Link to="/inventario" className="btn btn-ghost btn-sm gap-2 px-0">
            <ArrowLeft className="h-4 w-4" />
            Todas las categorías
          </Link>
          <h1 className="text-2xl font-bold">{category?.name ?? "Categoría"}</h1>
          {category?.description && (
            <p className="text-sm text-base-content/70">{category.description}</p>
          )}
        </div>
        {validId && (
          <Link
            to="/inventario/nuevo"
            search={{ categoria: categoryId }}
            className="btn btn-primary btn-sm gap-1"
          >
            <Plus className="h-4 w-4" /> Nuevo ítem
          </Link>
        )}
      </div>

      {!validId && (
        <div className="alert alert-error">
          <span>Categoría no válida.</span>
        </div>
      )}

      {validId && categoriesQuery.isSuccess && !category && (
        <div className="alert alert-warning">
          <span>No se encontró esta categoría de material.</span>
        </div>
      )}

      {itemsQuery.isLoading && <p>Cargando materiales...</p>}
      {itemsQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar los materiales.</span>
        </div>
      )}

      {itemsQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Formato</th>
                <th className="text-right">Stock</th>
                <th>Unidad</th>
                <th className="text-right">Stock mín.</th>
                <th className="text-right">{moneyHeading("Costo unit.")}</th>
                <th className="text-right">{moneyHeading("Costo unit.", "USD")}</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const demand = demandByItemId.get(item.id);
                return (
                <tr key={item.id} className={item.deficit || item.lowStock || demand ? "bg-error/10" : ""}>
                  <td className="font-medium">
                    {item.name}
                    {demand && (
                      <div className="mt-0.5 text-xs text-warning">
                        Necesario en pedidos: {demand.needed.toFixed(2)} {demand.unit} / Disponible:{" "}
                        {demand.available.toFixed(2)} {demand.unit}
                      </div>
                    )}
                  </td>
                  <td>{item.formatLabel ?? "Sin formato"}</td>
                  <td className={`text-right ${item.deficit ? "font-semibold text-error" : ""}`}>
                    {item.quantity}
                  </td>
                  <td>{item.unit}</td>
                  <td className="text-right">{formatMinStock(item.minStock)}</td>
                  <td className="text-right">{formatCost(item.costPerUnit)}</td>
                  <td className="text-right">{formatCost(item.costPerUnitUsd)}</td>
                  <td>
                    {demand ? (
                      <span className="badge badge-sm badge-warning">Pedido en espera</span>
                    ) : item.deficit ? (
                      <span className="badge badge-sm badge-error">Déficit</span>
                    ) : item.lowStock ? (
                      <span className="badge badge-sm badge-warning">Bajo</span>
                    ) : (
                      <span className="badge badge-sm badge-success">OK</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        className="btn btn-xs btn-outline"
                        to="/inventario/$itemId"
                        params={{ itemId: String(item.id) }}
                      >
                        Ver
                      </Link>
                      <Link
                        className="btn btn-xs btn-ghost"
                        to="/inventario/$itemId/editar"
                        params={{ itemId: String(item.id) }}
                      >
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-base-content/60">
                    No hay materiales en esta categoría. Crea el primero con «Nuevo ítem».
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
