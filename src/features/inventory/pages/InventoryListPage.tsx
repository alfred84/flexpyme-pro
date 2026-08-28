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
} from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { fetchInventoryItems, fetchMaterialCategories, fetchInventoryPendingOrderDemand } from "@/db/queries/inventory";
import { InventoryRecipesPanel } from "@/features/inventory/components/InventoryRecipesPanel";
import { InventoryMovementsSection } from "@/features/inventory/components/InventoryMovementsSection";
import { ManualOutboundModal } from "@/features/inventory/components/ManualOutboundModal";
import { MaterialSaleModal } from "@/features/inventory/components/MaterialSaleModal";
import { MaterialCategoriesPanel } from "@/features/inventory/components/MaterialCategoriesPanel";
import { categoryMosaicTone } from "@/lib/category-icons";

type InventoryManagePanel = "categorias" | "normas" | null;

interface CategoryTile {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  lowCount: number;
  deficitCount: number;
}

/**
 * Pantalla principal de inventario: mosaico de categorías de material.
 * Categorías y normas se gestionan desde opciones (modales).
 *
 * @returns Página de inventario.
 */
export function InventoryListPage() {
  const [showOutbound, setShowOutbound] = useState(false);
  const [showMaterialSale, setShowMaterialSale] = useState(false);
  const [managePanel, setManagePanel] = useState<InventoryManagePanel>(null);

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

  const tiles = useMemo((): CategoryTile[] => {
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
        <div>
          <h2 className="text-lg font-semibold">Materiales por categoría</h2>
          <p className="text-sm text-base-content/70">
            Elige una categoría para ver sus materiales y dar de alta ítems.
          </p>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {tiles.map((tile, index) => (
              <Link
                key={tile.id}
                to="/inventario/categoria/$categoryId"
                params={{ categoryId: String(tile.id) }}
                className={`flex min-h-[5.5rem] flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2.5 text-left transition ${categoryMosaicTone(index)}`}
              >
                <div className="flex w-full flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold leading-tight">{tile.name}</span>
                  <span className="badge badge-xs badge-primary h-auto px-2 py-1 leading-none">
                    {tile.itemCount} ítem(s)
                  </span>
                  {tile.deficitCount > 0 && (
                    <span className="badge badge-xs badge-error">Déficit</span>
                  )}
                  {tile.lowCount > 0 && (
                    <span className="badge badge-xs badge-warning">Bajo</span>
                  )}
                </div>
                {tile.description ? (
                  <p className="line-clamp-2 w-full text-xs leading-snug text-base-content/60">
                    {tile.description}
                  </p>
                ) : (
                  <p className="text-xs text-base-content/40">Sin descripción</p>
                )}
              </Link>
            ))}
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
