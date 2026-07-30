import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { LineEmployeesModal } from "@/features/invoices/components/LineEmployeesModal";
import {
  draftLineSubtotal,
  formatOptionsForCategory,
  resolveRecipeMaterials,
  resolveServicePrice,
  serviceAndFinishOptions,
  type DraftLine,
  type DraftLineMaterial,
  type DraftLineService,
  type DraftMaterialMode,
  type DraftServiceAssignment,
} from "@/features/invoices/lib/order-draft";
import { formatMoney } from "@/lib/format-money";
import type {
  CategoryFinishDto,
  CategoryFormatDto,
  CategoryWorkTypeDto,
  ProductCategoryDto,
} from "@/types/category";
import type { InventoryItemDto, InventoryRecipeDto, MaterialCategoryDto } from "@/types/inventory";
import type { FormatDto, PriceRowDto } from "@/types/price";

interface OrderLineModalProps {
  open: boolean;
  editing: DraftLine | null;
  defaultCategoryId: number;
  categories: ProductCategoryDto[];
  formats: FormatDto[];
  prices: PriceRowDto[];
  /** Tipos de trabajo asociados a cada categoría. */
  categoryWorkTypes: CategoryWorkTypeDto[];
  /** Formatos asociados a cada categoría. */
  categoryFormats: CategoryFormatDto[];
  categoryFinishes: CategoryFinishDto[];
  /** Categorías de material de inventario (activas). */
  materialCategories: MaterialCategoryDto[];
  /** Materiales de almacén para asignación manual. */
  inventoryItems: InventoryItemDto[];
  /** Normas activas (vista previa en modo norma). */
  recipes: InventoryRecipeDto[];
  onClose: () => void;
  onSave: (line: DraftLine) => void;
}

interface WorkTypeOption {
  name: string;
  /** Si true, se preselecciona al crear la línea. */
  isDefault: boolean;
}

/**
 * Deriva las opciones de tipo de trabajo para una categoría.
 * Prioriza `category_work_types`; si no hay, cae a los servicios de la lista de precios.
 *
 * @param categoryWorkTypes - Tipos vinculados por categoría.
 * @param prices - Lista de precios.
 * @param categoryId - Categoría seleccionada.
 * @param formatId - Formato seleccionado.
 * @returns Opciones con marca de preselección.
 */
function workTypeOptionsFor(
  categoryWorkTypes: CategoryWorkTypeDto[],
  prices: PriceRowDto[],
  categoryId: number,
  formatId: number | null,
): WorkTypeOption[] {
  const configured = categoryWorkTypes.filter(
    (row) => row.categoryId === categoryId && row.workTypeActive,
  );
  if (configured.length > 0) {
    return configured.map((row) => ({
      name: row.workTypeName,
      isDefault: true,
    }));
  }
  const { services } = serviceAndFinishOptions(prices, categoryId, formatId);
  return services.map((name) => ({ name, isDefault: false }));
}

/**
 * Deriva los acabados para una categoría: usa configuración si existe, si no
 * cae a los acabados de la lista de precios.
 *
 * @param categoryFinishes - Acabados configurados por categoría.
 * @param prices - Lista de precios.
 * @param categoryId - Categoría seleccionada.
 * @param formatId - Formato seleccionado.
 * @returns Lista de acabados y el acabado por defecto (si hay).
 */
function finishOptionsFor(
  categoryFinishes: CategoryFinishDto[],
  prices: PriceRowDto[],
  categoryId: number,
  formatId: number | null,
): { finishes: string[]; defaultFinish: string } {
  const configured = categoryFinishes.filter(
    (f) => f.categoryId === categoryId && (f.finishActive ?? true),
  );
  if (configured.length > 0) {
    const def = configured.find((f) => f.isDefault);
    return { finishes: configured.map((f) => f.finish), defaultFinish: def?.finish ?? "" };
  }
  const { finishes } = serviceAndFinishOptions(prices, categoryId, formatId);
  return { finishes, defaultFinish: "" };
}

/**
 * Construye una fila de material manual con la primera categoría e ítem disponibles.
 *
 * @param materialCategories - Categorías de material activas.
 * @param inventoryItems - Ítems de inventario.
 * @returns Fila por defecto o `null` si no hay datos.
 */
function defaultManualMaterialRow(
  materialCategories: MaterialCategoryDto[],
  inventoryItems: InventoryItemDto[],
): DraftLineMaterial | null {
  const categories = materialCategories.filter((c) => c.isActive);
  const firstCat = categories[0];
  if (!firstCat) {
    return null;
  }
  const itemsInCat = inventoryItems.filter((i) => i.materialCategoryId === firstCat.id);
  const firstItem = itemsInCat[0];
  if (!firstItem) {
    return {
      materialCategoryId: firstCat.id,
      inventoryItemId: 0,
      quantityPerUnit: "1",
    };
  }
  return {
    materialCategoryId: firstCat.id,
    inventoryItemId: firstItem.id,
    quantityPerUnit: "1",
    label: firstItem.name,
  };
}

/**
 * Normaliza filas de material al editar (rellena categoría desde el ítem).
 *
 * @param materials - Filas del borrador.
 * @param inventoryItems - Catálogo de ítems.
 * @param materialCategories - Categorías activas.
 * @returns Filas con categoría resuelta.
 */
function hydrateManualMaterials(
  materials: DraftLineMaterial[],
  inventoryItems: InventoryItemDto[],
  materialCategories: MaterialCategoryDto[],
): DraftLineMaterial[] {
  return materials.map((m) => {
    if (m.materialCategoryId > 0) {
      return m;
    }
    const item = inventoryItems.find((it) => it.id === m.inventoryItemId);
    const fallbackCat = materialCategories.find((c) => c.isActive)?.id ?? 0;
    return {
      ...m,
      materialCategoryId: item?.materialCategoryId ?? fallbackCat,
      label: m.label ?? item?.name,
    };
  });
}

/**
 * Modal CRUD para añadir o editar una línea de pedido con tipos de trabajo
 * por categoría y cálculo automático de precios.
 *
 * @param props - Estado del modal y catálogos.
 * @returns Diálogo de línea de pedido.
 */
export function OrderLineModal(props: OrderLineModalProps) {
  const {
    open,
    editing,
    defaultCategoryId,
    categories,
    formats,
    prices,
    categoryWorkTypes,
    categoryFormats,
    categoryFinishes,
    materialCategories,
    inventoryItems,
    recipes,
    onClose,
    onSave,
  } = props;
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeesForService, setEmployeesForService] = useState<string | null>(null);

  /**
   * Construye la lista de tipos de trabajo preseleccionados con su precio.
   */
  const buildDefaultWorkTypes = (
    categoryId: number,
    formatId: number | null,
    finish: string,
  ): DraftLineService[] => {
    const options = workTypeOptionsFor(categoryWorkTypes, prices, categoryId, formatId);
    const defaults = options.filter((o) => o.isDefault);
    return defaults.map((o) => {
      const price = resolveServicePrice(prices, categoryId, formatId, o.name, finish);
      return {
        service: o.name,
        unitPrice: price !== null ? String(price) : "",
        assignments: [],
      };
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    if (editing) {
      setDraft({
        ...editing,
        services: editing.services.map((s) => ({
          ...s,
          assignments: (s.assignments ?? []).map((a) => ({ ...a })),
        })),
        materials: hydrateManualMaterials(
          (editing.materials ?? []).map((m) => ({ ...m })),
          inventoryItems,
          materialCategories,
        ),
        materialMode: editing.materialMode ?? "norma",
      });
    } else {
      const { defaultFinish } = finishOptionsFor(categoryFinishes, prices, defaultCategoryId, null);
      setDraft({
        key: crypto.randomUUID(),
        categoryId: defaultCategoryId,
        formatId: null,
        finish: defaultFinish,
        quantity: "1",
        services: buildDefaultWorkTypes(defaultCategoryId, null, defaultFinish),
        materialMode: "norma",
        materials: [],
      });
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, defaultCategoryId]);

  const formatOptions = useMemo(() => {
    if (!draft) {
      return [];
    }
    return formatOptionsForCategory(prices, draft.categoryId, formats, categoryFormats);
  }, [draft, prices, formats, categoryFormats]);

  const workTypeOptions = useMemo(() => {
    if (!draft) {
      return [] as WorkTypeOption[];
    }
    return workTypeOptionsFor(categoryWorkTypes, prices, draft.categoryId, draft.formatId);
  }, [draft, categoryWorkTypes, prices]);

  const finishInfo = useMemo(() => {
    if (!draft) {
      return { finishes: [] as string[], defaultFinish: "" };
    }
    return finishOptionsFor(categoryFinishes, prices, draft.categoryId, draft.formatId);
  }, [draft, categoryFinishes, prices]);

  const hasConfiguredWorkTypes = workTypeOptions.length > 0;

  /** Recalcula el precio de los tipos seleccionados tras cambiar formato/acabado. */
  const recalcWorkTypePrices = (
    services: DraftLineService[],
    categoryId: number,
    formatId: number | null,
    finish: string,
  ): DraftLineService[] =>
    services.map((s) => {
      const price = resolveServicePrice(prices, categoryId, formatId, s.service, finish);
      return price !== null ? { ...s, unitPrice: String(price) } : s;
    });

  const changeCategory = (categoryId: number) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const { defaultFinish } = finishOptionsFor(categoryFinishes, prices, categoryId, null);
      const allowedFormats = formatOptionsForCategory(
        prices,
        categoryId,
        formats,
        categoryFormats,
      );
      const formatStillValid =
        prev.formatId != null && allowedFormats.some((f) => f.id === prev.formatId);
      return {
        ...prev,
        categoryId,
        formatId: formatStillValid ? prev.formatId : null,
        finish: defaultFinish,
        services: buildDefaultWorkTypes(categoryId, null, defaultFinish),
        materials: prev.materialMode === "manual" ? prev.materials : [],
      };
    });
  };

  const changeFormat = (formatId: number | null) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        formatId,
        services: recalcWorkTypePrices(prev.services, prev.categoryId, formatId, prev.finish),
      };
    });
  };

  const changeFinish = (finish: string) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        finish,
        services: recalcWorkTypePrices(prev.services, prev.categoryId, prev.formatId, finish),
      };
    });
  };

  const toggleWorkType = (name: string, checked: boolean) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      if (checked) {
        if (prev.services.some((s) => s.service === name)) {
          return prev;
        }
        const price = resolveServicePrice(prices, prev.categoryId, prev.formatId, name, prev.finish);
        return {
          ...prev,
          services: [
            ...prev.services,
            {
              service: name,
              unitPrice: price !== null ? String(price) : "",
              assignments: [],
            },
          ],
        };
      }
      return { ...prev, services: prev.services.filter((s) => s.service !== name) };
    });
  };

  const setWorkTypePrice = (name: string, unitPrice: string) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        services: prev.services.map((s) => (s.service === name ? { ...s, unitPrice } : s)),
      };
    });
  };

  /**
   * Guarda las asignaciones de empleados para un tipo de trabajo.
   *
   * @param serviceName - Nombre del tipo.
   * @param assignments - Empleados seleccionados.
   */
  const saveServiceAssignments = (
    serviceName: string,
    assignments: DraftServiceAssignment[],
  ) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        services: prev.services.map((s) =>
          s.service === serviceName ? { ...s, assignments } : s,
        ),
      };
    });
  };

  /** Precio del modo manual (categorías sin tipos de trabajo configurados). */
  const setManualPrice = (unitPrice: string) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        services: [{ service: "", unitPrice, assignments: [] }],
      };
    });
  };

  const handleSave = () => {
    if (!draft) {
      return;
    }
    const qty = Number.parseInt(draft.quantity, 10);
    if (!draft.categoryId) {
      setError("Selecciona una categoría.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }
    if (draft.services.length === 0) {
      setError("Selecciona al menos un tipo de trabajo.");
      return;
    }
    const invalidPrice = draft.services.some((s) => {
      const unit = Number.parseFloat(s.unitPrice.replace(",", "."));
      return !Number.isFinite(unit) || unit < 0;
    });
    if (invalidPrice) {
      setError("Indica un precio válido para cada tipo de trabajo.");
      return;
    }
    const qtyNum = Number.parseInt(draft.quantity, 10);
    const overAssigned = draft.services.find(
      (s) => (s.assignments?.length ?? 0) > qtyNum,
    );
    if (overAssigned) {
      setError(
        `«${overAssigned.service}» tiene más empleados que la cantidad de la línea (${qtyNum}).`,
      );
      return;
    }
    if (draft.materialMode === "manual") {
      if (draft.materials.length === 0) {
        setError("Añade al menos un material de inventario, o cambia a normas de producción.");
        return;
      }
      const badMat = draft.materials.some((m) => {
        const q = Number.parseFloat(m.quantityPerUnit.replace(",", "."));
        return !m.inventoryItemId || !Number.isFinite(q) || q <= 0;
      });
      if (badMat) {
        setError("Revisa las cantidades de los materiales asignados.");
        return;
      }
    }
    onSave(draft);
    onClose();
  };

  const previewNormMaterials = useMemo(() => {
    if (!draft || draft.materialMode !== "norma") return [];
    const seen = new Map<number, { name: string; qty: number }>();
    for (const s of draft.services) {
      const mats = resolveRecipeMaterials(
        recipes,
        categoryWorkTypes,
        draft.categoryId,
        draft.formatId,
        draft.finish.trim() || null,
        s.service.trim() || null,
      );
      for (const m of mats) {
        const item = inventoryItems.find((it) => it.id === m.inventoryItemId);
        const prev = seen.get(m.inventoryItemId);
        if (prev) {
          prev.qty += m.quantityPerUnit;
        } else {
          seen.set(m.inventoryItemId, {
            name: item?.name ?? `Ítem #${m.inventoryItemId}`,
            qty: m.quantityPerUnit,
          });
        }
      }
    }
    return Array.from(seen.values());
  }, [draft, recipes, categoryWorkTypes, inventoryItems]);

  const activeMaterialCategories = useMemo(
    () => materialCategories.filter((c) => c.isActive),
    [materialCategories],
  );

  if (!open || !draft) {
    return null;
  }

  const manualPrice = draft.services[0]?.unitPrice ?? "";

  const setMaterialMode = (mode: DraftMaterialMode) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (mode === "manual" && prev.materials.length === 0) {
        const row = defaultManualMaterialRow(materialCategories, inventoryItems);
        if (!row) {
          setError("No hay categorías o materiales de inventario disponibles.");
          return prev;
        }
        return { ...prev, materialMode: mode, materials: [row] };
      }
      return { ...prev, materialMode: mode };
    });
  };

  const addManualMaterial = () => {
    const row = defaultManualMaterialRow(materialCategories, inventoryItems);
    if (!row || row.inventoryItemId <= 0) {
      setError("No hay materiales en inventario para asignar.");
      return;
    }
    setError(null);
    setDraft((prev) => (prev ? { ...prev, materials: [...prev.materials, row] } : prev));
  };

  const updateManualMaterial = (index: number, patch: Partial<DraftLineMaterial>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        materials: prev.materials.map((m, i) => {
          if (i !== index) return m;
          let next: DraftLineMaterial = { ...m, ...patch };
          if (patch.materialCategoryId != null && patch.inventoryItemId == null) {
            const itemsInCat = inventoryItems.filter(
              (it) => it.materialCategoryId === patch.materialCategoryId,
            );
            const first = itemsInCat[0];
            next = {
              ...next,
              inventoryItemId: first?.id ?? 0,
              label: first?.name,
              quantityPerUnit: next.quantityPerUnit || "1",
            };
          } else if (patch.inventoryItemId != null) {
            const item = inventoryItems.find((it) => it.id === patch.inventoryItemId);
            next.label = item?.name;
            if (item?.materialCategoryId != null) {
              next.materialCategoryId = item.materialCategoryId;
            }
          }
          return next;
        }),
      };
    });
  };

  const removeManualMaterial = (index: number) => {
    setDraft((prev) =>
      prev ? { ...prev, materials: prev.materials.filter((_, i) => i !== index) } : prev,
    );
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg">{editing ? "Editar línea" : "Nueva línea"}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="form-control sm:col-span-2">
            <span className="label-text text-xs">Categoría</span>
            <select
              className="select select-bordered select-sm"
              value={draft.categoryId}
              onChange={(e) => changeCategory(Number(e.target.value))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Formato</span>
            <select
              className="select select-bordered select-sm"
              value={draft.formatId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                changeFormat(v === "" ? null : Number(v));
              }}
            >
              <option value="">— Ninguno —</option>
              {formatOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Cantidad</span>
            <input
              type="number"
              min={1}
              className="input input-bordered input-sm"
              value={draft.quantity}
              onChange={(e) => setDraft((prev) => (prev ? { ...prev, quantity: e.target.value } : prev))}
            />
          </label>
          <label className="form-control sm:col-span-2">
            <span className="label-text text-xs">Acabado (opcional)</span>
            {finishInfo.finishes.length > 0 ? (
              <select
                className="select select-bordered select-sm"
                value={draft.finish}
                onChange={(e) => changeFinish(e.target.value)}
              >
                <option value="">— Sin acabado —</option>
                {finishInfo.finishes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input input-bordered input-sm"
                value={draft.finish}
                onChange={(e) => changeFinish(e.target.value)}
                placeholder="ej. brillo"
              />
            )}
          </label>

          <div className="form-control sm:col-span-2">
            <span className="label-text text-xs">Tipos de trabajo</span>
            {hasConfiguredWorkTypes ? (
              <div className="mt-1 space-y-1 rounded-lg border border-base-300 p-2">
                {workTypeOptions.map((opt) => {
                  const selected = draft.services.find((s) => s.service === opt.name);
                  const checked = Boolean(selected);
                  const assignedCount = selected?.assignments?.length ?? 0;
                  return (
                    <div key={opt.name} className="flex flex-wrap items-center gap-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={checked}
                          onChange={(e) => toggleWorkType(opt.name, e.target.checked)}
                        />
                        {opt.name}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input input-bordered input-xs w-24"
                        placeholder="Precio"
                        value={selected?.unitPrice ?? ""}
                        disabled={!checked}
                        onChange={(e) => setWorkTypePrice(opt.name, e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={!checked}
                        onClick={() => setEmployeesForService(opt.name)}
                      >
                        Empleados{assignedCount > 0 ? ` (${assignedCount})` : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-base-content/50">
                  Esta categoría no tiene tipos de trabajo asociados. Configúralos en Categorías o
                  indica un precio unitario.
                </p>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input input-bordered input-sm w-full"
                  placeholder="Precio unitario (CUP)"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-control sm:col-span-2">
            <span className="label-text text-xs">Materiales de inventario</span>
            <div role="tablist" className="tabs tabs-boxed mt-1 w-full">
              <button
                type="button"
                role="tab"
                className={`tab flex-1 ${draft.materialMode === "norma" ? "tab-active" : ""}`}
                onClick={() => setMaterialMode("norma")}
              >
                Norma de producción
              </button>
              <button
                type="button"
                role="tab"
                className={`tab flex-1 ${draft.materialMode === "manual" ? "tab-active" : ""}`}
                onClick={() => setMaterialMode("manual")}
              >
                Asignación manual
              </button>
            </div>

            {draft.materialMode === "norma" ? (
              <div className="mt-2 rounded-lg border border-base-300 bg-base-200/40 p-2 text-xs">
                {previewNormMaterials.length === 0 ? (
                  <p className="text-base-content/60">
                    No hay normas activas que coincidan con esta línea. Puedes crearlas en Inventario
                    o usar asignación manual.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {previewNormMaterials.map((m) => (
                      <li key={m.name} className="flex justify-between gap-2">
                        <span>{m.name}</span>
                        <span className="font-medium">{m.qty} / ud.</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-base-content/50">
                  Los materiales se fijan al guardar el pedido; editar normas después no cambia este
                  pedido.
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {activeMaterialCategories.length === 0 && (
                  <p className="text-xs text-warning">
                    No hay categorías de material activas. Créalas en Inventario.
                  </p>
                )}
                {draft.materials.map((m, index) => {
                  const itemsInCat = inventoryItems.filter(
                    (it) => it.materialCategoryId === m.materialCategoryId,
                  );
                  return (
                    <div
                      key={`mat-${index}-${m.materialCategoryId}-${m.inventoryItemId}`}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <label className="form-control min-w-[8rem] flex-1">
                        <span className="label-text text-[0.65rem]">Categoría</span>
                        <select
                          className="select select-bordered select-xs"
                          value={m.materialCategoryId || ""}
                          onChange={(e) =>
                            updateManualMaterial(index, {
                              materialCategoryId: Number(e.target.value),
                            })
                          }
                        >
                          {activeMaterialCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-control min-w-[10rem] flex-[1.4]">
                        <span className="label-text text-[0.65rem]">Material</span>
                        <select
                          className="select select-bordered select-xs"
                          value={m.inventoryItemId || ""}
                          disabled={itemsInCat.length === 0}
                          onChange={(e) =>
                            updateManualMaterial(index, {
                              inventoryItemId: Number(e.target.value),
                            })
                          }
                        >
                          {itemsInCat.length === 0 ? (
                            <option value="">Sin materiales</option>
                          ) : (
                            itemsInCat.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.quantity} {item.unit})
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                      <label className="form-control w-20">
                        <span className="label-text text-[0.65rem]">Cant./ud.</span>
                        <input
                          className="input input-bordered input-xs w-20"
                          inputMode="decimal"
                          value={m.quantityPerUnit}
                          onChange={(e) =>
                            updateManualMaterial(index, { quantityPerUnit: e.target.value })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs mb-0.5"
                        onClick={() => removeManualMaterial(index)}
                        aria-label="Quitar material"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                <button type="button" className="btn btn-outline btn-xs" onClick={addManualMaterial}>
                  + Material
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-base-content/60">Subtotal de la línea</span>
          <span className="font-semibold">{formatMoney(draftLineSubtotal(draft))}</span>
        </div>
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
        <div className="modal-action">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave}>
            {editing ? "Guardar cambios" : "Añadir línea"}
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={onClose} />
      </dialog>
      {employeesForService && draft && (
        <LineEmployeesModal
          open={Boolean(employeesForService)}
          workTypeName={employeesForService}
          quantity={Number.parseInt(draft.quantity, 10) || 1}
          initial={
            draft.services.find((s) => s.service === employeesForService)?.assignments ?? []
          }
          onClose={() => setEmployeesForService(null)}
          onSave={(assignments) => saveServiceAssignments(employeesForService, assignments)}
        />
      )}
    </ModalPortal>
  );
}
