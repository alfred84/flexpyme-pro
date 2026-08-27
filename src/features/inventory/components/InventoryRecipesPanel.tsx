import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { fetchCategories, fetchAllCategoryFormats, fetchAllCategoryWorkTypes, fetchCategoryFinishes } from "@/db/queries/categories";
import {
  createInventoryRecipe,
  deactivateInventoryRecipe,
  fetchInventoryItems,
  fetchInventoryRecipes,
  reactivateInventoryRecipe,
  updateInventoryRecipe,
} from "@/db/queries/inventory";
import { formatInventoryMaterialOptionLabel } from "@/features/inventory/lib/inventory-item-label";
import { pushFlashMessage } from "@/lib/flash-message";
import type { InventoryRecipeDto } from "@/types/inventory";

interface InventoryRecipesPanelProps {
  /** Si true, oculta el título externo y el borde (p. ej. dentro de un modal). */
  embedded?: boolean;
}

/**
 * Panel de normas de consumo por categoría, tipo de trabajo, formato y acabado.
 *
 * @param props - Opciones de presentación.
 * @returns Sección de gestión de normas de producción.
 */
export function InventoryRecipesPanel(props: InventoryRecipesPanelProps = {}) {
  const { embedded = false } = props;
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const recipesQuery = useQuery({
    queryKey: ["inventory", "recipes", showInactive],
    queryFn: () => fetchInventoryRecipes(!showInactive),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => fetchCategories(true),
  });
  const categoryWorkTypesQuery = useQuery({
    queryKey: ["category-work-types"],
    queryFn: fetchAllCategoryWorkTypes,
  });
  const categoryFormatsQuery = useQuery({
    queryKey: ["category-formats"],
    queryFn: fetchAllCategoryFormats,
  });
  const categoryFinishesQuery = useQuery({
    queryKey: ["category-finishes"],
    queryFn: fetchCategoryFinishes,
  });
  const itemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
  });

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InventoryRecipeDto | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [workTypeTab, setWorkTypeTab] = useState<number | null>(null);
  const [formatId, setFormatId] = useState("");
  const [finish, setFinish] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantityPerUnit, setQuantityPerUnit] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const workTypesForCategory = useMemo(() => {
    const cat = Number(categoryId);
    if (!cat) return [];
    return (categoryWorkTypesQuery.data ?? []).filter(
      (row) => row.categoryId === cat && row.workTypeActive,
    );
  }, [categoryId, categoryWorkTypesQuery.data]);

  const formatsForCategory = useMemo(() => {
    const cat = Number(categoryId);
    if (!cat) return [];
    return (categoryFormatsQuery.data ?? []).filter(
      (row) => row.categoryId === cat && row.formatActive,
    );
  }, [categoryId, categoryFormatsQuery.data]);

  const finishesForCategory = useMemo(() => {
    const cat = Number(categoryId);
    if (!cat) return [];
    return (categoryFinishesQuery.data ?? []).filter(
      (f) => f.categoryId === cat && (f.finishActive ?? true),
    );
  }, [categoryId, categoryFinishesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cat = Number(categoryId);
      const item = Number(inventoryItemId);
      const qty = Number(quantityPerUnit);
      const fmt = formatId ? Number(formatId) : null;
      if (!cat) throw new Error("Selecciona la categoría del pedido.");
      if (!workTypeTab) throw new Error("Selecciona un tipo de trabajo.");
      if (!item) throw new Error("Selecciona el material de inventario.");
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("La cantidad por unidad debe ser mayor que cero.");
      }
      if (editing) {
        return updateInventoryRecipe({
          id: editing.id,
          inventoryItemId: item,
          formatId: fmt,
          finish: finish.trim() || null,
          quantityPerUnit: qty,
        });
      }
      return createInventoryRecipe({
        categoryId: cat,
        workTypeId: workTypeTab,
        formatId: fmt,
        finish: finish.trim() || null,
        inventoryItemId: item,
        quantityPerUnit: qty,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory", "recipes"] });
      pushFlashMessage({
        kind: "success",
        text: editing
          ? "Norma actualizada. Solo afectará a pedidos futuros."
          : "Norma guardada.",
      });
      if (editing) {
        closeModal();
      } else {
        setInventoryItemId("");
        setQuantityPerUnit("1");
        setError(null);
      }
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

  const reactivateMutation = useMutation({
    mutationFn: reactivateInventoryRecipe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory", "recipes"] });
      pushFlashMessage({ kind: "success", text: "Norma reactivada." });
    },
    onError: (e: Error) => pushFlashMessage({ kind: "error", text: e.message }),
  });

  const resetForm = () => {
    setEditing(null);
    setCategoryId("");
    setWorkTypeTab(null);
    setFormatId("");
    setFinish("");
    setInventoryItemId("");
    setQuantityPerUnit("1");
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (recipe: InventoryRecipeDto) => {
    setEditing(recipe);
    setCategoryId(String(recipe.categoryId));
    setWorkTypeTab(recipe.workTypeId);
    setFormatId(recipe.formatId != null ? String(recipe.formatId) : "");
    setFinish(recipe.finish ?? "");
    setInventoryItemId(String(recipe.inventoryItemId));
    setQuantityPerUnit(String(recipe.quantityPerUnit));
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const onCategoryChange = (value: string) => {
    setCategoryId(value);
    setWorkTypeTab(null);
    setFormatId("");
    setFinish("");
  };

  const recipes = recipesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  return (
    <div
      className={
        embedded
          ? "space-y-4"
          : "space-y-4 rounded-lg border border-base-300 bg-base-100 p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {!embedded && <h2 className="text-lg font-semibold">Normas de producción</h2>}
          <p className="text-sm text-base-content/70">
            Al concluir una línea de trabajo se descuentan materiales según la norma (o los
            materiales asignados al pedido). Editar una norma solo afecta a pedidos futuros.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Ver desactivadas
          </label>
          <button type="button" className="btn btn-primary btn-sm gap-2" onClick={openCreate}>
            <Plus size={14} /> Nueva norma
          </button>
        </div>
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
                <th>Tipo de trabajo</th>
                <th>Formato</th>
                <th>Acabado</th>
                <th>Material</th>
                <th className="text-right">Cant./unidad</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.id} className={!recipe.isActive ? "opacity-60" : ""}>
                  <td>{recipe.categoryName}</td>
                  <td>{recipe.workTypeName ?? recipe.service ?? "—"}</td>
                  <td>{recipe.formatLabel ?? "Cualquiera"}</td>
                  <td>{recipe.finish ?? "Cualquiera"}</td>
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
                    <div className="flex justify-end gap-1">
                      {recipe.isActive && (
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
                          title="Editar"
                          onClick={() => openEdit(recipe)}
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {recipe.isActive ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost text-warning"
                          title="Desactivar"
                          disabled={deactivateMutation.isPending}
                          onClick={() => void deactivateMutation.mutateAsync(recipe.id)}
                        >
                          <Power size={12} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost text-success"
                          title="Reactivar"
                          disabled={reactivateMutation.isPending}
                          onClick={() => void reactivateMutation.mutateAsync(recipe.id)}
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {recipes.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-base-content/60">
                    {showInactive
                      ? "No hay normas desactivadas."
                      : "No hay normas activas. Configura normas o asigna materiales en cada pedido."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ModalPortal>
          <dialog className="modal modal-open">
            <div className="modal-box max-w-2xl">
              <h3 className="text-lg font-bold">
                {editing ? "Editar norma de producción" : "Nueva norma de producción"}
              </h3>
              {editing && (
                <p className="mt-1 text-sm text-warning">
                  Los cambios solo se aplicarán a pedidos futuros que usen esta norma.
                </p>
              )}
              <div className="mt-4 space-y-3">
                <label className="form-control w-full">
                  <span className="label-text">Categoría del pedido *</span>
                  <select
                    className="select select-bordered select-sm"
                    value={categoryId}
                    disabled={Boolean(editing)}
                    onChange={(e) => onCategoryChange(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>

                {categoryId && (
                  <div>
                    <span className="label-text mb-1 block">Tipo de trabajo *</span>
                    {workTypesForCategory.length === 0 ? (
                      <p className="text-sm text-warning">
                        Esta categoría no tiene tipos de trabajo habilitados. Configúralos en
                        Categorías.
                      </p>
                    ) : (
                      <div role="tablist" className="tabs tabs-boxed flex-wrap">
                        {workTypesForCategory.map((wt) => (
                          <button
                            key={wt.workTypeId}
                            type="button"
                            role="tab"
                            className={`tab ${workTypeTab === wt.workTypeId ? "tab-active" : ""}`}
                            disabled={Boolean(editing)}
                            onClick={() => setWorkTypeTab(wt.workTypeId)}
                          >
                            {wt.workTypeName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {workTypeTab != null && (
                  <>
                    <p className="text-xs text-base-content/60">
                      Configura el material para el formato y acabado correspondientes a este tipo
                      de trabajo.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="form-control w-full">
                        <span className="label-text">Formato</span>
                        <select
                          className="select select-bordered select-sm"
                          value={formatId}
                          onChange={(e) => setFormatId(e.target.value)}
                        >
                          <option value="">Cualquiera</option>
                          {formatsForCategory.map((f) => (
                            <option key={f.formatId} value={f.formatId}>
                              {f.formatLabel}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-control w-full">
                        <span className="label-text">Acabado</span>
                        {finishesForCategory.length > 0 ? (
                          <select
                            className="select select-bordered select-sm"
                            value={finish}
                            onChange={(e) => setFinish(e.target.value)}
                          >
                            <option value="">Cualquiera</option>
                            {finishesForCategory.map((f) => (
                              <option key={f.finish} value={f.finish}>
                                {f.finish}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input input-bordered input-sm"
                            placeholder="Opcional"
                            value={finish}
                            onChange={(e) => setFinish(e.target.value)}
                          />
                        )}
                      </label>
                    </div>
                    <label className="form-control w-full">
                      <span className="label-text">Material de inventario *</span>
                      <select
                        className="select select-bordered select-sm"
                        value={inventoryItemId}
                        onChange={(e) => setInventoryItemId(e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.materialCategoryName
                              ? `${item.materialCategoryName} · ${formatInventoryMaterialOptionLabel(item)}`
                              : formatInventoryMaterialOptionLabel(item)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-control w-full">
                      <span className="label-text">Cantidad por unidad del pedido *</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="input input-bordered input-sm"
                        value={quantityPerUnit}
                        onChange={(e) => setQuantityPerUnit(e.target.value)}
                      />
                    </label>
                  </>
                )}

                {error && <p className="text-error text-sm">{error}</p>}
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
                  {editing ? "Cancelar" : "Cerrar"}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={saveMutation.isPending || workTypeTab == null}
                  onClick={() => void saveMutation.mutateAsync()}
                >
                  {editing ? "Guardar cambios" : "Añadir material a la norma"}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="modal-backdrop bg-transparent"
              aria-label="Cerrar"
              onClick={closeModal}
            />
          </dialog>
        </ModalPortal>
      )}
    </div>
  );
}
