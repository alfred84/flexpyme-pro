import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeDollarSign,
  ClipboardList,
  FolderTree,
  Package,
  PackageMinus,
  PackageSearch,
  Search,
} from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { fetchInventoryItems, fetchMaterialCategories, fetchInventoryPendingOrderDemand } from "@/db/queries/inventory";
import { InventoryRecipesPanel } from "@/features/inventory/components/InventoryRecipesPanel";
import { InventoryMovementsSection } from "@/features/inventory/components/InventoryMovementsSection";
import { ManualOutboundModal } from "@/features/inventory/components/ManualOutboundModal";
import { MaterialSaleModal } from "@/features/inventory/components/MaterialSaleModal";
import { MaterialCategoriesPanel } from "@/features/inventory/components/MaterialCategoriesPanel";

type InventoryManagePanel = "categorias" | "normas" | null;

/** Fila del listado de categorías de material. */
interface CategoryRow {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  lowCount: number;
  deficitCount: number;
}

/**
 * Pantalla principal de inventario: tabla de categorías de material.
 * Categorías y normas se gestionan desde opciones (modales).
 *
 * @returns Página de inventario.
 */
export function InventoryListPage() {
  const [showOutbound, setShowOutbound] = useState(false);
  const [showMaterialSale, setShowMaterialSale] = useState(false);
  const [managePanel, setManagePanel] = useState<InventoryManagePanel>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

  const itemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });
  const categoriesQuery = useQuery({
    queryKey: ["inventory", "material-categories"],
    queryFn: () => fetchMaterialCategories(false),
  });
  const pendingDemandQuery = useQuery({
    queryKey: ["inventory", "pending-order-demand"],
    queryFn: fetchInventoryPendingOrderDemand,
  });

  const items = itemsQuery.data ?? [];
  const lowStockCount = items.filter((item) => item.lowStock).length;
  const deficitCount = items.filter((item) => item.deficit).length;
  const pendingDemand = pendingDemandQuery.data ?? [];
  const pendingDemandCount = pendingDemand.length;

  const tiles = useMemo((): CategoryRow[] => {
    const cats = (categoriesQuery.data ?? []).filter((c) => c.isActive);
    return cats
      .map((cat) => {
        const catItems = items.filter((i) => i.materialCategoryId === cat.id);
        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          itemCount: catItems.length,
          lowCount: catItems.filter((i) => i.lowStock).length,
          deficitCount: catItems.filter((i) => i.deficit).length,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [items, categoriesQuery.data]);

  const filteredTiles = useMemo(() => {
    const query = categoryFilter.trim().toLowerCase();
    if (!query) {
      return tiles;
    }
    return tiles.filter((tile) => {
      const description = tile.description?.toLowerCase() ?? "";
      return tile.name.toLowerCase().includes(query) || description.includes(query);
    });
  }, [tiles, categoryFilter]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Package className="h-6 w-6" /> Inventario
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/inventario/resumen" className="btn btn-outline btn-sm gap-1">
            <PackageSearch className="h-4 w-4" /> Resumen
          </Link>
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            onClick={() => setManagePanel("categorias")}
          >
            <FolderTree className="h-4 w-4" /> Categorías
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            onClick={() => setManagePanel("normas")}
          >
            <ClipboardList className="h-4 w-4" /> Normas
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm gap-1"
            onClick={() => setShowOutbound(true)}
          >
            <PackageMinus className="h-4 w-4" /> Salida manual
          </button>
          <button
            type="button"
            className="btn btn-outline btn-success btn-sm gap-1"
            onClick={() => setShowMaterialSale(true)}
          >
            <BadgeDollarSign className="h-4 w-4" /> Venta de material
          </button>
        </div>
      </div>

      {pendingDemandCount > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle className="h-5 w-5" />
          <div className="space-y-1">
            <span>
              <strong>{pendingDemandCount}</strong> material(es) pedidos por pedidos en espera
              (necesario &gt; disponible).
            </span>
            <ul className="list-inside list-disc text-sm">
              {pendingDemand.slice(0, 5).map((d) => (
                <li key={d.inventoryItemId}>
                  {d.itemName}: necesario {d.needed.toFixed(2)} {d.unit} / disponible{" "}
                  {d.available.toFixed(2)} {d.unit} ({d.openOrderCount} pedido
                  {d.openOrderCount === 1 ? "" : "s"})
                </li>
              ))}
              {pendingDemandCount > 5 && (
                <li>… y {pendingDemandCount - 5} más</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {deficitCount > 0 && (
        <div className="alert alert-error">
          <AlertTriangle className="h-5 w-5" />
          <span>
            <strong>{deficitCount}</strong> ítem(s) con existencia negativa (legado). Repón material
            con una entrada.
          </span>
        </div>
      )}

      {lowStockCount > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle className="h-5 w-5" />
          <span>
            <strong>{lowStockCount}</strong> ítem(s) en stock bajo.
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Materiales por categoría</h2>
            <p className="text-sm text-base-content/70">
              Elige una categoría para ver sus materiales y dar de alta ítems.
            </p>
          </div>
          {tiles.length > 0 && (
            <label className="form-control w-full sm:max-w-xs">
              <span className="sr-only">Buscar categoría</span>
              <span className="input input-bordered input-sm flex items-center gap-2">
                <Search className="h-4 w-4 shrink-0 text-base-content/50" />
                <input
                  type="search"
                  className="grow bg-transparent outline-none"
                  placeholder="Buscar categoría…"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                />
              </span>
            </label>
          )}
        </div>

        {(itemsQuery.isLoading || categoriesQuery.isLoading) && <p>Cargando inventario...</p>}
        {(itemsQuery.isError || categoriesQuery.isError) && (
          <div className="alert alert-error">
            <span>No se pudo cargar el inventario.</span>
          </div>
        )}

        {categoriesQuery.data && tiles.length === 0 && (
          <div className="rounded-lg border border-dashed border-base-300 p-6 text-center text-base-content/60">
            <p>No hay categorías de material activas.</p>
            <button
              type="button"
              className="btn btn-link btn-sm mt-1"
              onClick={() => setManagePanel("categorias")}
            >
              Gestionar categorías de materiales
            </button>
          </div>
        )}

        {tiles.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th className="text-right">Ítems</th>
                  <th>Alertas</th>
                  <th className="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredTiles.map((tile) => (
                  <tr key={tile.id} className="hover">
                    <td className="font-medium">
                      <Link
                        to="/inventario/categoria/$categoryId"
                        params={{ categoryId: String(tile.id) }}
                        className="link link-hover"
                      >
                        {tile.name}
                      </Link>
                    </td>
                    <td className="max-w-md text-sm text-base-content/70">
                      {tile.description?.trim() ? tile.description : "—"}
                    </td>
                    <td className="text-right tabular-nums">{tile.itemCount}</td>
                    <td>
                      {tile.deficitCount > 0 || tile.lowCount > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tile.deficitCount > 0 && (
                            <span className="badge badge-error badge-sm">
                              Déficit {tile.deficitCount}
                            </span>
                          )}
                          {tile.lowCount > 0 && (
                            <span className="badge badge-warning badge-sm">
                              Bajo {tile.lowCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-base-content/40">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link
                        to="/inventario/categoria/$categoryId"
                        params={{ categoryId: String(tile.id) }}
                        className="btn btn-outline btn-xs"
                      >
                        Ver materiales
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredTiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-base-content/60">
                      Ninguna categoría coincide con «{categoryFilter.trim()}».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InventoryMovementsSection />

      {showOutbound && <ManualOutboundModal onClose={() => setShowOutbound(false)} />}
      {showMaterialSale && <MaterialSaleModal onClose={() => setShowMaterialSale(false)} />}

      {managePanel === "categorias" && (
        <ModalPortal>
          <dialog className="modal modal-open">
            <div className="modal-box max-h-[90vh] max-w-3xl overflow-y-auto">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold">Categorías de materiales</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-circle btn-ghost"
                  aria-label="Cerrar"
                  onClick={() => setManagePanel(null)}
                >
                  ✕
                </button>
              </div>
              <div className="mt-3">
                <MaterialCategoriesPanel embedded />
              </div>
              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setManagePanel(null)}>
                  Cerrar
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-backdrop bg-transparent"
              aria-label="Cerrar"
              onClick={() => setManagePanel(null)}
            />
          </dialog>
        </ModalPortal>
      )}

      {managePanel === "normas" && (
        <ModalPortal>
          <dialog className="modal modal-open">
            <div className="modal-box max-h-[90vh] max-w-5xl overflow-y-auto">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold">Normas de producción</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-circle btn-ghost"
                  aria-label="Cerrar"
                  onClick={() => setManagePanel(null)}
                >
                  ✕
                </button>
              </div>
              <div className="mt-3">
                <InventoryRecipesPanel embedded />
              </div>
              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setManagePanel(null)}>
                  Cerrar
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-backdrop bg-transparent"
              aria-label="Cerrar"
              onClick={() => setManagePanel(null)}
            />
          </dialog>
        </ModalPortal>
      )}
    </section>
  );
}
