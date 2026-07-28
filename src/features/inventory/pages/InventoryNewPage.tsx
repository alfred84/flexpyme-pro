import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { UnitSelect } from "@/components/inventory/UnitSelect";
import { createInventoryItem, fetchMaterialCategories } from "@/db/queries/inventory";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Alta de ítem de inventario (categoría fijada desde la pantalla de categoría).
 *
 * @returns Página de creación de ítem.
 */
export function InventoryNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { categoria?: number };
  const presetCategoryId = search.categoria;

  const categoriesQuery = useQuery({
    queryKey: ["inventory", "material-categories", "active"],
    queryFn: () => fetchMaterialCategories(true),
  });

  const [materialCategoryId, setMaterialCategoryId] = useState(
    presetCategoryId != null ? String(presetCategoryId) : "",
  );
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("0");
  const [minStock, setMinStock] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeCategories = categoriesQuery.data ?? [];
  const lockedCategory = presetCategoryId != null && Number.isFinite(presetCategoryId);
  const categoryName =
    activeCategories.find((c) => c.id === Number(materialCategoryId))?.name ??
    categoriesQuery.data?.find((c) => c.id === presetCategoryId)?.name;

  useEffect(() => {
    if (presetCategoryId != null && Number.isFinite(presetCategoryId)) {
      setMaterialCategoryId(String(presetCategoryId));
    }
  }, [presetCategoryId]);

  const mutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      pushFlashMessage({ kind: "success", text: "Ítem creado correctamente." });
      if (lockedCategory && presetCategoryId) {
        await navigate({
          to: "/inventario/categoria/$categoryId",
          params: { categoryId: String(presetCategoryId) },
        });
      } else {
        await navigate({ to: "/inventario/$itemId", params: { itemId: String(id) } });
      }
    },
  });

  const cancelTo =
    lockedCategory && presetCategoryId
      ? ({
          to: "/inventario/categoria/$categoryId" as const,
          params: { categoryId: String(presetCategoryId) },
        })
      : ({ to: "/inventario" as const });

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
      name: name.trim(),
      materialCategoryId: catId,
      unitId,
      quantity: Number(quantity) || 0,
      minStock: min,
      costPerUnit: cost,
      supplier: supplier.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nuevo ítem de inventario</h1>
          {lockedCategory && categoryName && (
            <p className="text-sm text-base-content/70">Categoría: {categoryName}</p>
          )}
        </div>
        {"params" in cancelTo ? (
          <Link
            to={cancelTo.to}
            params={cancelTo.params}
            className="btn btn-ghost btn-sm"
          >
            Cancelar
          </Link>
        ) : (
          <Link to={cancelTo.to} className="btn btn-ghost btn-sm">
            Cancelar
          </Link>
        )}
      </div>

      {activeCategories.length === 0 && !categoriesQuery.isLoading && (
        <div className="alert alert-warning">
          <span>
            No hay categorías de material activas. Créalas en Inventario antes de dar de alta ítems.
          </span>
          <Link to="/inventario" className="btn btn-sm">
            Ir a Inventario
          </Link>
        </div>
      )}

      {(error || mutation.isError) && (
        <div className="alert alert-error">
          <span>{error ?? (mutation.error as Error)?.message ?? "No se pudo crear el ítem."}</span>
        </div>
      )}

      <form className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        {!lockedCategory && (
          <div className="form-control sm:col-span-2">
            <label className="label" htmlFor="inv-cat">
              <span className="label-text">Categoría *</span>
            </label>
            <select
              id="inv-cat"
              className="select select-bordered"
              value={materialCategoryId}
              onChange={(e) => setMaterialCategoryId(e.target.value)}
              required
            >
              <option value="">Selecciona…</option>
              {activeCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-control sm:col-span-2">
          <label className="label" htmlFor="inv-name">
            <span className="label-text">Nombre *</span>
          </label>
          <input
            id="inv-name"
            className="input input-bordered"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="inv-unit">
            <span className="label-text">Unidad *</span>
          </label>
          <UnitSelect id="inv-unit" value={unitId} onChange={setUnitId} />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="inv-qty">
            <span className="label-text">Stock inicial</span>
          </label>
          <input
            id="inv-qty"
            type="number"
            min="0"
            step="any"
            className="input input-bordered"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div className="form-control">
          <label className="label" htmlFor="inv-min">
            <span className="label-text">Stock mínimo (opcional)</span>
          </label>
          <input
            id="inv-min"
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
          <label className="label" htmlFor="inv-cost">
            <span className="label-text">Costo unitario CUP (opcional)</span>
          </label>
          <input
            id="inv-cost"
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
          <label className="label" htmlFor="inv-supplier">
            <span className="label-text">Proveedor (opcional)</span>
          </label>
          <input
            id="inv-supplier"
            className="input input-bordered"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>

        <div className="form-control sm:col-span-2">
          <label className="label" htmlFor="inv-notes">
            <span className="label-text">Descripción (opcional)</span>
          </label>
          <textarea
            id="inv-notes"
            className="textarea textarea-bordered"
            rows={3}
            placeholder="Apuntes sobre el material…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={mutation.isPending || activeCategories.length === 0}
          >
            {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Crear ítem"}
          </button>
        </div>
      </form>
    </section>
  );
}
