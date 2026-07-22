import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  addCategoryFormat,
  addCategoryWorkType,
  createCategoryFinish,
  deleteCategoryFinish,
  fetchCategoryFinishes,
  fetchCategoryFormats,
  fetchCategoryWorkTypes,
  removeCategoryFormat,
  removeCategoryWorkType,
  setCategoryFinishDefault,
} from "@/db/queries/categories";
import type { ProductCategoryDto } from "@/types/category";

interface WorkTypeOption {
  id: number;
  name: string;
  isActive: boolean;
}

interface FormatOption {
  id: number;
  label: string;
  widthInches: number | null;
  heightInches: number | null;
  isActive: boolean;
}

interface CategoryConfigModalProps {
  /** Categoría en configuración. */
  category: ProductCategoryDto;
  /** Callback al cerrar el modal. */
  onClose: () => void;
}

/**
 * Modal para configurar tipos de trabajo, formatos y acabados de una categoría.
 *
 * Tipos y formatos se eligen de los catálogos de Configuración; los acabados
 * son texto propio de la categoría.
 *
 * @param props - Categoría y callback de cierre.
 * @returns Modal de configuración de categoría.
 */
export function CategoryConfigModal(props: CategoryConfigModalProps) {
  const { category, onClose } = props;
  const queryClient = useQueryClient();
  const [newFinish, setNewFinish] = useState("");

  const finishesQuery = useQuery({
    queryKey: ["category-finishes"],
    queryFn: fetchCategoryFinishes,
  });
  const workTypesCatalogQuery = useQuery({
    queryKey: ["work-types"],
    queryFn: () => invoke<WorkTypeOption[]>("get_work_types", { activeOnly: false }),
  });
  const formatsCatalogQuery = useQuery({
    queryKey: ["formats", "manage"],
    queryFn: () => invoke<FormatOption[]>("get_formats", { activeOnly: false }),
  });
  const linkedWorkTypesQuery = useQuery({
    queryKey: ["category-work-types", category.id],
    queryFn: () => fetchCategoryWorkTypes(category.id),
  });
  const linkedFormatsQuery = useQuery({
    queryKey: ["category-formats", category.id],
    queryFn: () => fetchCategoryFormats(category.id),
  });

  const finishes = (finishesQuery.data ?? []).filter((f) => f.categoryId === category.id);
  const linkedWorkTypes = linkedWorkTypesQuery.data ?? [];
  const linkedFormats = linkedFormatsQuery.data ?? [];

  const linkedByWorkTypeId = useMemo(() => {
    const map = new Map<number, (typeof linkedWorkTypes)[number]>();
    for (const row of linkedWorkTypes) {
      map.set(row.workTypeId, row);
    }
    return map;
  }, [linkedWorkTypes]);

  const linkedByFormatId = useMemo(() => {
    const map = new Map<number, (typeof linkedFormats)[number]>();
    for (const row of linkedFormats) {
      map.set(row.formatId, row);
    }
    return map;
  }, [linkedFormats]);

  const selectableWorkTypes = useMemo(() => {
    const catalog = workTypesCatalogQuery.data ?? [];
    return catalog
      .filter((wt) => wt.isActive || linkedByWorkTypeId.has(wt.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [workTypesCatalogQuery.data, linkedByWorkTypeId]);

  const selectableFormats = useMemo(() => {
    const catalog = formatsCatalogQuery.data ?? [];
    return catalog
      .filter((f) => f.isActive || linkedByFormatId.has(f.id))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, [formatsCatalogQuery.data, linkedByFormatId]);

  const invalidateFinishes = () =>
    queryClient.invalidateQueries({ queryKey: ["category-finishes"] });
  const invalidateWorkTypes = async () => {
    await queryClient.invalidateQueries({ queryKey: ["category-work-types", category.id] });
    await queryClient.invalidateQueries({ queryKey: ["category-work-types"] });
  };
  const invalidateFormats = async () => {
    await queryClient.invalidateQueries({ queryKey: ["category-formats", category.id] });
    await queryClient.invalidateQueries({ queryKey: ["category-formats"] });
  };

  const addFinish = useMutation({
    mutationFn: () => createCategoryFinish(category.id, newFinish.trim(), false),
    onSuccess: async () => {
      setNewFinish("");
      await invalidateFinishes();
    },
  });
  const toggleFinish = useMutation({
    mutationFn: (args: { id: number; isDefault: boolean }) =>
      setCategoryFinishDefault(args.id, args.isDefault),
    onSuccess: () => void invalidateFinishes(),
  });
  const removeFinish = useMutation({
    mutationFn: (id: number) => deleteCategoryFinish(id),
    onSuccess: () => void invalidateFinishes(),
  });

  const addWorkType = useMutation({
    mutationFn: (workTypeId: number) => addCategoryWorkType(category.id, workTypeId),
    onSuccess: () => void invalidateWorkTypes(),
  });
  const removeWorkType = useMutation({
    mutationFn: (id: number) => removeCategoryWorkType(id),
    onSuccess: () => void invalidateWorkTypes(),
  });

  const addFormat = useMutation({
    mutationFn: (formatId: number) => addCategoryFormat(category.id, formatId),
    onSuccess: () => void invalidateFormats(),
  });
  const removeFormat = useMutation({
    mutationFn: (id: number) => removeCategoryFormat(id),
    onSuccess: () => void invalidateFormats(),
  });

  const workTypeBusy = addWorkType.isPending || removeWorkType.isPending;
  const formatBusy = addFormat.isPending || removeFormat.isPending;
  const workTypeError =
    (addWorkType.error as Error | null)?.message ??
    (removeWorkType.error as Error | null)?.message ??
    null;
  const formatError =
    (addFormat.error as Error | null)?.message ??
    (removeFormat.error as Error | null)?.message ??
    null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <h3 className="text-lg font-bold">Configurar: {category.name}</h3>
        <p className="mt-1 text-sm text-base-content/60">
          Asocia tipos de trabajo y formatos del catálogo, y define acabados propios (opcionales).
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="space-y-2">
            <h4 className="font-semibold">Tipos de trabajo</h4>
            <p className="text-xs text-base-content/60">
              Selecciona uno o más (Configuración → Tipos de trabajo). En el pedido aparecerán como
              opciones.
            </p>

            {linkedWorkTypes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {linkedWorkTypes.map((row) => (
                  <span
                    key={row.id}
                    className={`badge badge-sm gap-1 ${row.workTypeActive ? "badge-primary badge-outline" : "badge-ghost"}`}
                  >
                    {row.workTypeName}
                    {!row.workTypeActive && <span className="opacity-60">(inactivo)</span>}
                    <button
                      type="button"
                      className="text-error"
                      title="Quitar"
                      disabled={workTypeBusy}
                      onClick={() => void removeWorkType.mutateAsync(row.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {workTypesCatalogQuery.isLoading || linkedWorkTypesQuery.isLoading ? (
              <p className="text-xs text-base-content/50">Cargando tipos de trabajo…</p>
            ) : selectableWorkTypes.length === 0 ? (
              <p className="text-xs text-base-content/50">
                No hay tipos de trabajo activos. Créalos en la pestaña Tipos de trabajo.
              </p>
            ) : (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-2">
                {selectableWorkTypes.map((wt) => {
                  const linked = linkedByWorkTypeId.get(wt.id);
                  const checked = linked != null;
                  return (
                    <label
                      key={wt.id}
                      className="label cursor-pointer justify-start gap-3 rounded px-1 py-1 hover:bg-base-200"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={checked}
                        disabled={workTypeBusy}
                        onChange={(e) => {
                          if (e.target.checked) {
                            void addWorkType.mutateAsync(wt.id);
                          } else if (linked) {
                            void removeWorkType.mutateAsync(linked.id);
                          }
                        }}
                      />
                      <span className="label-text text-sm">
                        {wt.name}
                        {!wt.isActive && (
                          <span className="ml-1 text-xs text-base-content/50">(inactivo)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {workTypeError && <p className="text-xs text-error">{workTypeError}</p>}
            {linkedWorkTypes.length === 0 && selectableWorkTypes.length > 0 && (
              <p className="text-xs text-base-content/50">Ningún tipo seleccionado todavía.</p>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold">Formatos</h4>
            <p className="text-xs text-base-content/60">
              Selecciona uno o más (Configuración → Formatos). En el pedido limitarán las opciones de
              formato.
            </p>

            {linkedFormats.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {linkedFormats.map((row) => (
                  <span
                    key={row.id}
                    className={`badge badge-sm gap-1 ${row.formatActive ? "badge-secondary badge-outline" : "badge-ghost"}`}
                  >
                    {row.formatLabel}
                    {!row.formatActive && <span className="opacity-60">(inactivo)</span>}
                    <button
                      type="button"
                      className="text-error"
                      title="Quitar"
                      disabled={formatBusy}
                      onClick={() => void removeFormat.mutateAsync(row.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {formatsCatalogQuery.isLoading || linkedFormatsQuery.isLoading ? (
              <p className="text-xs text-base-content/50">Cargando formatos…</p>
            ) : selectableFormats.length === 0 ? (
              <p className="text-xs text-base-content/50">
                No hay formatos activos. Créalos en la pestaña Formatos.
              </p>
            ) : (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-2">
                {selectableFormats.map((fmt) => {
                  const linked = linkedByFormatId.get(fmt.id);
                  const checked = linked != null;
                  const dims =
                    fmt.widthInches != null && fmt.heightInches != null
                      ? `${fmt.widthInches}×${fmt.heightInches}"`
                      : null;
                  return (
                    <label
                      key={fmt.id}
                      className="label cursor-pointer justify-start gap-3 rounded px-1 py-1 hover:bg-base-200"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-secondary"
                        checked={checked}
                        disabled={formatBusy}
                        onChange={(e) => {
                          if (e.target.checked) {
                            void addFormat.mutateAsync(fmt.id);
                          } else if (linked) {
                            void removeFormat.mutateAsync(linked.id);
                          }
                        }}
                      />
                      <span className="label-text text-sm">
                        {fmt.label}
                        {dims && (
                          <span className="ml-1 text-xs text-base-content/50">{dims}</span>
                        )}
                        {!fmt.isActive && (
                          <span className="ml-1 text-xs text-base-content/50">(inactivo)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {formatError && <p className="text-xs text-error">{formatError}</p>}
            {linkedFormats.length === 0 && selectableFormats.length > 0 && (
              <p className="text-xs text-base-content/50">Ningún formato seleccionado todavía.</p>
            )}
          </section>

          <section className="space-y-2 md:col-span-2">
            <h4 className="font-semibold">Acabados</h4>
            <p className="text-xs text-base-content/60">
              Acabados propios de esta categoría (siempre opcionales en el pedido).
            </p>
            <div className="flex max-w-md gap-1">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder="Ej. Brillo"
                value={newFinish}
                onChange={(e) => setNewFinish(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFinish.trim()) {
                    void addFinish.mutateAsync();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!newFinish.trim() || addFinish.isPending}
                onClick={() => void addFinish.mutateAsync()}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {addFinish.isError && (
              <p className="text-xs text-error">{(addFinish.error as Error).message}</p>
            )}
            <ul className="max-w-md space-y-1">
              {finishes.length === 0 && (
                <li className="text-xs text-base-content/50">Sin acabados configurados.</li>
              )}
              {finishes.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded border border-base-300 px-2 py-1"
                >
                  <span className="text-sm">{f.finish}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={f.isDefault}
                        onChange={(e) =>
                          void toggleFinish.mutateAsync({
                            id: f.id,
                            isDefault: e.target.checked,
                          })
                        }
                      />
                      Por defecto
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => void removeFinish.mutateAsync(f.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
      <button
        type="button"
        className="modal-backdrop bg-transparent"
        aria-label="Cerrar"
        onClick={onClose}
      />
    </dialog>
  );
}
