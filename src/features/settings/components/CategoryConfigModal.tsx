import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useMemo } from "react";
import { X } from "lucide-react";
import {
  addCategoryFinish,
  addCategoryFormat,
  addCategoryWorkType,
  deleteCategoryFinish,
  fetchCategoryFinishes,
  fetchCategoryFormats,
  fetchCategoryWorkTypes,
  removeCategoryFormat,
  removeCategoryWorkType,
  setCategoryFinishDefault,
} from "@/db/queries/categories";
import { fetchFinishes } from "@/db/queries/finishes";
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
 * Los tres catálogos se eligen desde Configuración (Tipos de trabajo, Formatos,
 * Acabados). Los acabados siguen siendo opcionales en el pedido.
 *
 * @param props - Categoría y callback de cierre.
 * @returns Modal de configuración de categoría.
 */
export function CategoryConfigModal(props: CategoryConfigModalProps) {
  const { category, onClose } = props;
  const queryClient = useQueryClient();

  const linkedFinishesQuery = useQuery({
    queryKey: ["category-finishes"],
    queryFn: fetchCategoryFinishes,
  });
  const finishesCatalogQuery = useQuery({
    queryKey: ["finishes", "manage"],
    queryFn: () => fetchFinishes(false),
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

  const linkedFinishes = (linkedFinishesQuery.data ?? []).filter(
    (f) => f.categoryId === category.id,
  );
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

  const linkedByFinishId = useMemo(() => {
    const map = new Map<number, (typeof linkedFinishes)[number]>();
    for (const row of linkedFinishes) {
      if (row.finishId != null) {
        map.set(row.finishId, row);
      }
    }
    return map;
  }, [linkedFinishes]);

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

  const selectableFinishes = useMemo(() => {
    const catalog = finishesCatalogQuery.data ?? [];
    return catalog
      .filter((f) => f.isActive || linkedByFinishId.has(f.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [finishesCatalogQuery.data, linkedByFinishId]);

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
    mutationFn: (finishId: number) => addCategoryFinish(category.id, finishId, false),
    onSuccess: () => void invalidateFinishes(),
  });
  const toggleFinishDefault = useMutation({
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
  const finishBusy =
    addFinish.isPending || removeFinish.isPending || toggleFinishDefault.isPending;
  const workTypeError =
    (addWorkType.error as Error | null)?.message ??
    (removeWorkType.error as Error | null)?.message ??
    null;
  const formatError =
    (addFormat.error as Error | null)?.message ??
    (removeFormat.error as Error | null)?.message ??
    null;
  const finishError =
    (addFinish.error as Error | null)?.message ??
    (removeFinish.error as Error | null)?.message ??
    (toggleFinishDefault.error as Error | null)?.message ??
    null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <h3 className="text-lg font-bold">Configurar: {category.name}</h3>
        <p className="mt-1 text-sm text-base-content/60">
          Asocia tipos de trabajo, formatos y acabados de los catálogos de Configuración.
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
              Selecciona uno o más del catálogo (Configuración → Acabados). Siguen siendo opcionales
              en el pedido; «Por defecto» los preselecciona al crear la línea.
            </p>

            {linkedFinishes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {linkedFinishes.map((row) => (
                  <span
                    key={row.id}
                    className={`badge badge-sm gap-1 ${row.finishActive ? "badge-accent badge-outline" : "badge-ghost"}`}
                  >
                    {row.finish}
                    {row.isDefault && <span className="opacity-70">· defecto</span>}
                    {!row.finishActive && <span className="opacity-60">(inactivo)</span>}
                    <button
                      type="button"
                      className="text-error"
                      title="Quitar"
                      disabled={finishBusy}
                      onClick={() => void removeFinish.mutateAsync(row.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {finishesCatalogQuery.isLoading || linkedFinishesQuery.isLoading ? (
              <p className="text-xs text-base-content/50">Cargando acabados…</p>
            ) : selectableFinishes.length === 0 ? (
              <p className="text-xs text-base-content/50">
                No hay acabados activos. Créalos en la pestaña Acabados.
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-2 md:max-w-xl">
                {selectableFinishes.map((finish) => {
                  const linked = linkedByFinishId.get(finish.id);
                  const checked = linked != null;
                  return (
                    <div
                      key={finish.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded px-1 py-1 hover:bg-base-200"
                    >
                      <label className="label cursor-pointer justify-start gap-3 py-0">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-accent"
                          checked={checked}
                          disabled={finishBusy}
                          onChange={(e) => {
                            if (e.target.checked) {
                              void addFinish.mutateAsync(finish.id);
                            } else if (linked) {
                              void removeFinish.mutateAsync(linked.id);
                            }
                          }}
                        />
                        <span className="label-text text-sm">
                          {finish.name}
                          {!finish.isActive && (
                            <span className="ml-1 text-xs text-base-content/50">(inactivo)</span>
                          )}
                        </span>
                      </label>
                      {linked && (
                        <label className="flex cursor-pointer items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={linked.isDefault}
                            disabled={finishBusy}
                            onChange={(e) =>
                              void toggleFinishDefault.mutateAsync({
                                id: linked.id,
                                isDefault: e.target.checked,
                              })
                            }
                          />
                          Por defecto
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {finishError && <p className="text-xs text-error">{finishError}</p>}
            {linkedFinishes.length === 0 && selectableFinishes.length > 0 && (
              <p className="text-xs text-base-content/50">Ningún acabado seleccionado todavía.</p>
            )}
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
