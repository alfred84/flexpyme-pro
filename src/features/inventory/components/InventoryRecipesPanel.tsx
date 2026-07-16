import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Power } from "lucide-react";
import { fetchCategories } from "@/db/queries/categories";
import {
  createInventoryRecipe,
  deactivateInventoryRecipe,
  fetchInventoryItems,
  fetchInventoryRecipes,
} from "@/db/queries/inventory";
import { pushFlashMessage } from "@/lib/flash-message";

/**
 * Panel de normas de consumo: vincula categorías/servicios de pedido con materiales de inventario.
 *
 * @returns Sección de gestión de normas de producción.
 */
export function InventoryRecipesPanel() {
  const queryClient = useQueryClient();
  const recipesQuery = useQuery({
    queryKey: ["inventory", "recipes"],
    queryFn: () => fetchInventoryRecipes(false),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => fetchCategories(true),
  });
  const itemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });

  const [showModal, setShowModal] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [service, setService] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantityPerUnit, setQuantityPerUnit] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cat = Number(categoryId);
      const item = Number(inventoryItemId);
      const qty = Number(quantityPerUnit);
      if (!cat || !item) {
        throw new Error("Seleccione categoría e ítem de inventario.");
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("La cantidad por unidad debe ser mayor que cero.");
      }
      return createInventoryRecipe({
        categoryId: cat,
        service: service.trim() || null,
        inventoryItemId: item,
        quantityPerUnit: qty,
      });
    },
    onSuccess: async () => {
      setShowModal(false);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["inventory", "recipes"] });
      pushFlashMessage({ kind: "success", text: "Norma guardada." });
    },
    onError: (e: Error) => setError(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateInventoryRecipe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory", "recipes"] });
      pushFlashMessage({ kind: "success", text: "Norma desactivada." });
    },
    onError: (e: Error) => pushFlashMessage({ kind: "error", text: e.message }),
  });

  const resetForm = () => {
    setCategoryId("");
    setService("");
    setInventoryItemId("");
    setQuantityPerUnit("1");
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const recipes = recipesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  return (
    <div className="space-y-4 rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Normas de producción</h2>
          <p className="text-sm text-base-content/70">
            Al marcar un pedido como listo se descuentan los materiales según estas reglas.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
          <Plus size={14} /> Nueva norma
        </button>
      </div>

      {recipesQuery.isLoading && <p className="text-sm">Cargando normas...</p>}
      {recipesQuery.isError && (
        <p className="text-error text-sm">No se pudieron cargar las normas.</p>
      )}

      {recipesQuery.data && (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Servicio</th>
                <th>Material</th>
                <th className="text-right">Cant./unidad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.id} className={!recipe.isActive ? "opacity-60" : ""}>
                  <td>{recipe.categoryName}</td>
                  <td>{recipe.service ?? "Cualquiera"}</td>
                  <td>{recipe.inventoryItemName}</td>
                  <td className="text-right">{recipe.quantityPerUnit}</td>
                  <td>
                    {recipe.isActive ? (
                      <span className="badge badge-sm badge-success">Activa</span>
                    ) : (
                      <span className="badge badge-sm">Inactiva</span>
                    )}
                  </td>
                  <td className="text-right">
                    {recipe.isActive && (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost text-error"
                        disabled={deactivateMutation.isPending}
                        onClick={() => void deactivateMutation.mutateAsync(recipe.id)}
                      >
                        <Power size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {recipes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-base-content/60">
                    No hay normas configuradas. El inventario no se descontará automáticamente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-lg font-bold">Nueva norma de consumo</h3>
            <div className="mt-4 space-y-3">
              <label className="form-control w-full">
                <span className="label-text">Categoría del pedido</span>
                <select
                  className="select select-bordered select-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control w-full">
                <span className="label-text">Servicio (opcional)</span>
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder="Vacío = aplica a cualquier servicio de la categoría"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                />
              </label>
              <label className="form-control w-full">
                <span className="label-text">Material de inventario</span>
                <select
                  className="select select-bordered select-sm"
                  value={inventoryItemId}
                  onChange={(e) => setInventoryItemId(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control w-full">
                <span className="label-text">Cantidad por unidad del pedido</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input input-bordered input-sm"
                  value={quantityPerUnit}
                  onChange={(e) => setQuantityPerUnit(e.target.value)}
                />
              </label>
              {error && <p className="text-error text-sm">{error}</p>}
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={saveMutation.isPending}
                onClick={() => void saveMutation.mutateAsync()}
              >
                Guardar
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={closeModal}>
              cerrar
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
