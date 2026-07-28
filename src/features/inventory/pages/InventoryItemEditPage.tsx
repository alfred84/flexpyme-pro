import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { UnitSelect } from "@/components/inventory/UnitSelect";
import {
  fetchInventoryItem,
  fetchMaterialCategories,
  updateInventoryItem,
} from "@/db/queries/inventory";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Edición de datos de un ítem de inventario (el stock solo cambia vía movimientos).
 *
 * @returns Página de edición de ítem.
 */
export function InventoryItemEditPage() {
  const params = useParams({ strict: false }) as { itemId?: string };
  const itemId = Number(params.itemId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const itemQuery = useQuery({
    queryKey: ["inventory", "item", itemId],
    queryFn: () => fetchInventoryItem(itemId),
    enabled: Number.isFinite(itemId) && itemId > 0,
  });
  const categoriesQuery = useQuery({
    queryKey: ["inventory", "material-categories", "active"],
    queryFn: () => fetchMaterialCategories(true),
  });

  const [materialCategoryId, setMaterialCategoryId] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [minStock, setMinStock] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const item = itemQuery.data;
    if (!item || hydrated) {
      return;
    }
    setMaterialCategoryId(item.materialCategoryId != null ? String(item.materialCategoryId) : "");
    setName(item.name);
    setUnitId(item.unitId);
    setMinStock(item.minStock > 0 ? String(item.minStock) : "");
    setCostPerUnit(item.costPerUnit > 0 ? String(item.costPerUnit) : "");
    setSupplier(item.supplier ?? "");
    setNotes(item.notes ?? "");
    setHydrated(true);
  }, [itemQuery.data, hydrated]);

  const activeCategories = categoriesQuery.data ?? [];
  /** Incluye la categoría actual aunque esté inactiva, para no perderla al editar. */
  const categoryOptions = (() => {
    const list = [...activeCategories];
    const currentId = itemQuery.data?.materialCategoryId;
    if (
      currentId != null &&
      !list.some((c) => c.id === currentId) &&
      itemQuery.data?.materialCategoryName
    ) {
      list.unshift({
        id: currentId,
        name: `${itemQuery.data.materialCategoryName} (inactiva)`,
        description: null,
        sortOrder: 0,
        isActive: false,
      });
    }
    return list;
  })();

  const mutation = useMutation({
    mutationFn: updateInventoryItem,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      pushFlashMessage({ kind: "success", text: "Ítem actualizado correctamente." });
      const categoryId = variables.materialCategoryId;
      if (categoryId > 0) {
        await navigate({
          to: "/inventario/categoria/$categoryId",
          params: { categoryId: String(categoryId) },
        });
      } else {
        await navigate({ to: "/inventario" });
      }
    },
  });

  const backToCategory =
    itemQuery.data?.materialCategoryId != null
      ? {
          to: "/inventario/categoria/$categoryId" as const,
          params: { categoryId: String(itemQuery.data.materialCategoryId) },
        }
      : { to: "/inventario" as const };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const catId = Number.parseInt(materialCategoryId, 10);
    if (!Number.isFinite(catId) || catId <= 0) {
      setError("Selecciona una categoría de material.");
      return;
    }
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!unitId) {
      setError("Selecciona una unidad de medida.");
      return;
    }
    const min = minStock.trim() === "" ? 0 : Number(minStock);
    const cost = costPerUnit.trim() === "" ? 0 : Number(costPerUnit);
    if (!Number.isFinite(min) || min < 0) {
      setError("El stock mínimo no es válido.");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setError("El costo unitario no es válido.");
      return;
    }
    await mutation.mutateAsync({
      id: itemId,
      name: name.trim(),
      materialCategoryId: catId,
      unitId,
      minStock: min,
      costPerUnit: cost,
      supplier: supplier.trim() || null,
      notes: notes.trim() || null,
    });
  };

  if (!Number.isFinite(itemId) || itemId <= 0) {
    return (
      <div className="alert alert-warning">
        <span>Identificador de ítem no válido.</span>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Editar ítem</h1>
          {itemQuery.data && (
            <p className="text-sm text-base-content/70">
              Stock actual: {itemQuery.data.quantity} {itemQuery.data.unit} (solo cambia con
              movimientos)
            </p>
          )}
        </div>
        {"params" in backToCategory ? (
          <Link
            to={backToCategory.to}
            params={backToCategory.params}
            className="btn btn-ghost btn-sm"
          >
            Cancelar
          </Link>
        ) : (
          <Link to={backToCategory.to} className="btn btn-ghost btn-sm">
            Cancelar
          </Link>
        )}
      </div>

      {itemQuery.isLoading && <p>Cargando...</p>}
      {itemQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudo cargar el ítem.</span>
        </div>
      )}

      {(error || mutation.isError) && (
        <div className="alert alert-error">
          <span>
            {error ?? (mutation.error as Error)?.message ?? "No se pudo guardar el ítem."}
          </span>
        </div>
      )}

      {itemQuery.data && hydrated && (
        <form
          className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="form-control sm:col-span-2">
            <label className="label" htmlFor="edit-inv-cat">
              <span className="label-text">Categoría *</span>
            </label>
            <select
              id="edit-inv-cat"
              className="select select-bordered"
              value={materialCategoryId}
              onChange={(e) => setMaterialCategoryId(e.target.value)}
              required
            >
              <option value="">Selecciona…</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control sm:col-span-2">
            <label className="label" htmlFor="edit-inv-name">
              <span className="label-text">Nombre *</span>
            </label>
            <input
              id="edit-inv-name"
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="edit-inv-unit">
              <span className="label-text">Unidad *</span>
            </label>
            <UnitSelect id="edit-inv-unit" value={unitId} onChange={setUnitId} />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Stock actual</span>
            </label>
            <input
              className="input input-bordered"
              value={`${itemQuery.data.quantity} ${itemQuery.data.unit}`}
              disabled
              readOnly
            />
            <span className="label-text-alt text-base-content/50">
              Usa entradas/salidas en la ficha del ítem para ajustar el stock.
            </span>
          </div>

          <div className="form-control">
            <label className="label" htmlFor="edit-inv-min">
              <span className="label-text">Stock mínimo (opcional)</span>
            </label>
            <input
              id="edit-inv-min"
              type="number"
              min="0"
              step="any"
              className="input input-bordered"
              placeholder="Sin establecer"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
            <span className="label-text-alt text-base-content/50">
              Si queda vacío o en 0 no habrá alertas de stock bajo.
            </span>
          </div>

          <div className="form-control">
            <label className="label" htmlFor="edit-inv-cost">
              <span className="label-text">Costo unitario CUP (opcional)</span>
            </label>
            <input
              id="edit-inv-cost"
              type="number"
              min="0"
              step="any"
              className="input input-bordered"
              placeholder="Sin establecer"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
            />
          </div>

          <div className="form-control sm:col-span-2">
            <label className="label" htmlFor="edit-inv-supplier">
              <span className="label-text">Proveedor (opcional)</span>
            </label>
            <input
              id="edit-inv-supplier"
              className="input input-bordered"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          <div className="form-control sm:col-span-2">
            <label className="label" htmlFor="edit-inv-notes">
              <span className="label-text">Descripción (opcional)</span>
            </label>
            <textarea
              id="edit-inv-notes"
              className="textarea textarea-bordered"
              rows={3}
              placeholder="Apuntes sobre el material…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Guardar cambios"
              )}
            </button>
            {"params" in backToCategory ? (
              <Link
                to={backToCategory.to}
                params={backToCategory.params}
                className="btn btn-ghost"
              >
                Cancelar
              </Link>
            ) : (
              <Link to={backToCategory.to} className="btn btn-ghost">
                Cancelar
              </Link>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
