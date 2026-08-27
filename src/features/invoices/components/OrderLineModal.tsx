import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { SearchSelect } from "@/components/common/SearchSelect";
import { LineEmployeesModal } from "@/features/invoices/components/LineEmployeesModal";
import {
  draftLineSubtotal,
  formatOptionsForCategory,
  resolveRecipeMaterials,
  resolveSaleUnitPriceCup,
  resolveSaleUnitPriceUsd,
  serviceAndFinishOptions,
  type DraftLine,
  type DraftLineMaterial,
  type DraftLineService,
  type DraftMaterialMode,
  type DraftServiceAssignment,
} from "@/features/invoices/lib/order-draft";
import { findProductPriceRow } from "@/features/products/lib/product-price";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import { SalePriceInput } from "@/features/invoices/components/SalePriceInput";
import { formatInventoryMaterialOptionLabel } from "@/features/inventory/lib/inventory-item-label";
import { useAppSettings } from "@/hooks/use-app-settings";
import { moneyHeading } from "@/lib/format-money";
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
  /** Tasa USD→CUP del pedido (formulario); si falta, se usa la de Configuración. */
  orderExchangeRate?: number;
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
 * Construye una fila de material manual eligiendo la primera categoría con ítems
 * (o la primera categoría activa si ninguna tiene stock aún).
 *
 * @param materialCategories - Categorías de material activas.
 * @param inventoryItems - Ítems de inventario.
 * @param excludeItemIds - Ítems ya asignados en la línea (para sugerir otro).
 * @returns Fila por defecto o `null` si no hay categorías.
 */
function defaultManualMaterialRow(
  materialCategories: MaterialCategoryDto[],
  inventoryItems: InventoryItemDto[],
  excludeItemIds: ReadonlySet<number> = new Set(),
): DraftLineMaterial | null {
  const categories = materialCategories.filter((c) => c.isActive);
  if (categories.length === 0) {
    return null;
  }

  // Preferir un ítem aún no usado en la línea.
  for (const cat of categories) {
    const itemsInCat = inventoryItems.filter((i) => i.materialCategoryId === cat.id);
    const unused = itemsInCat.find((i) => !excludeItemIds.has(i.id));
    if (unused) {
      return {
        materialCategoryId: cat.id,
        inventoryItemId: unused.id,
        quantityPerUnit: "1",
        label: unused.name,
      };
    }
  }

  // Si todos los ítems ya están en la línea, repetir el primero disponible.
  for (const cat of categories) {
    const firstItem = inventoryItems.find((i) => i.materialCategoryId === cat.id);
    if (firstItem) {
      return {
        materialCategoryId: cat.id,
        inventoryItemId: firstItem.id,
        quantityPerUnit: "1",
        label: firstItem.name,
      };
    }
  }

  // Hay categorías pero ningún ítem en inventario: fila vacía para que elijan categoría.
  return {
    materialCategoryId: categories[0].id,
    inventoryItemId: 0,
    quantityPerUnit: "1",
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
 * Modal CRUD para añadir o editar una línea de pedido.
 * El precio de venta es único del producto (formato + acabado); los tipos de trabajo
 * son para producción y empleados.
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
    orderExchangeRate,
    onClose,
    onSave,
  } = props;
  const { usdExchangeRate: appRate } = useAppSettings();
  /** Tasa del pedido (formulario) con fallback a Configuración. */
  const usdExchangeRate =
    orderExchangeRate != null && orderExchangeRate > 0 ? orderExchangeRate : appRate;
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [employeesForService, setEmployeesForService] = useState<string | null>(null);

  /**
   * Resuelve el precio único del producto (formato + acabado), no por tipo de trabajo.
   */
  const resolveProductPrices = (
    categoryId: number,
    formatId: number | null,
    finish: string,
  ): { unitPrice: string; unitPriceUsd: string } => {
    const row = findProductPriceRow(prices, categoryId, formatId, finish);
    const cup = resolveSaleUnitPriceCup(row, usdExchangeRate);
    const usd = resolveSaleUnitPriceUsd(row, usdExchangeRate);
    const usdFallback =
      usd ??
      (cup !== null && usdExchangeRate > 0 ? cup / usdExchangeRate : null);
    return {
      unitPrice: cup !== null ? String(cup) : "",
      unitPriceUsd: usdFallback !== null ? String(usdFallback) : "",
    };
  };

  /**
   * Construye la lista de tipos de trabajo preseleccionados con su precio en CUP/USD.
   */
  const buildDefaultWorkTypes = (
    categoryId: number,
    formatId: number | null,
    finish: string,
  ): DraftLineService[] => {
    const options = workTypeOptionsFor(categoryWorkTypes, prices, categoryId, formatId);
    const defaults = options.filter((o) => o.isDefault);
    const priced = resolveProductPrices(categoryId, formatId, finish);
    return defaults.map((o) => {
      return {
        service: o.name,
        unitPrice: priced.unitPrice,
        unitPriceUsd: priced.unitPriceUsd,
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
      const defaultMaterial = defaultManualMaterialRow(materialCategories, inventoryItems);
      setDraft({
        key: crypto.randomUUID(),
        categoryId: defaultCategoryId,
        formatId: null,
        finish: defaultFinish,
        quantity: "1",
        services: buildDefaultWorkTypes(defaultCategoryId, null, defaultFinish),
        materialMode: "manual",
        materials: defaultMaterial ? [defaultMaterial] : [],
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

  /** Recalcula precios USD/CUP de los tipos seleccionados tras cambiar formato/acabado. */
  const recalcWorkTypePrices = (
    services: DraftLineService[],
    categoryId: number,
    formatId: number | null,
    finish: string,
  ): DraftLineService[] => {
    const priced = resolveProductPrices(categoryId, formatId, finish);
    return services.map((s) =>
      priced.unitPrice !== ""
        ? { ...s, unitPrice: priced.unitPrice, unitPriceUsd: priced.unitPriceUsd }
        : s,
    );
  };

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
        const priced =
          prev.services[0] != null && prev.services[0].unitPrice !== ""
            ? {
                unitPrice: prev.services[0].unitPrice,
                unitPriceUsd: prev.services[0].unitPriceUsd,
              }
            : resolveProductPrices(
                prev.categoryId,
                prev.formatId,
                prev.finish,
              );
        return {
          ...prev,
          services: [
            ...prev.services,
            {
              service: name,
              unitPrice: priced.unitPrice,
              unitPriceUsd: priced.unitPriceUsd,
              assignments: [],
            },
          ],
        };
      }
      return { ...prev, services: prev.services.filter((s) => s.service !== name) };
    });
  };

  const setProductPrice = (unitPrice: string) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      const cup = Number.parseFloat(unitPrice.replace(",", "."));
      const unitPriceUsd =
        Number.isFinite(cup) && usdExchangeRate > 0 ? String(cup / usdExchangeRate) : "";
      if (prev.services.length === 0) {
        return prev;
      }
      return {
        ...prev,
        services: prev.services.map((s) => ({ ...s, unitPrice, unitPriceUsd })),
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
      const cup = Number.parseFloat(unitPrice.replace(",", "."));
      const unitPriceUsd =
        Number.isFinite(cup) && usdExchangeRate > 0 ? String(cup / usdExchangeRate) : "";
      return {
        ...prev,
        services: [{ service: "", unitPrice, unitPriceUsd, assignments: [] }],
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
      setError("Indica un precio válido del producto.");
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

  const lineQuantity = useMemo(() => {
    if (!draft) return 1;
    const q = Number.parseInt(draft.quantity, 10);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }, [draft]);

  const previewNormMaterials = useMemo(() => {
    if (!draft || draft.materialMode !== "norma") return [];
    const seen = new Map<
      number,
      { name: string; qty: number; stock: number; unit: string }
    >();
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
            stock: item?.quantity ?? 0,
            unit: item?.unit ?? "",
          });
        }
      }
    }
    return Array.from(seen.values()).map((m) => {
      const needed = m.qty * lineQuantity;
      return {
        ...m,
        needed,
        shortfall: needed > m.stock + 1e-9,
      };
    });
  }, [draft, recipes, categoryWorkTypes, inventoryItems, lineQuantity]);

  const hasNormShortage = previewNormMaterials.some((m) => m.shortfall);

  const hasManualShortage = useMemo(() => {
    if (!draft || draft.materialMode !== "manual") return false;
    return draft.materials.some((m) => {
      const perUnit = Number.parseFloat(m.quantityPerUnit.replace(",", "."));
      if (!m.inventoryItemId || !Number.isFinite(perUnit) || perUnit <= 0) return false;
      const item = inventoryItems.find((it) => it.id === m.inventoryItemId);
      const needed = perUnit * lineQuantity;
      return needed > (item?.quantity ?? 0) + 1e-9;
    });
  }, [draft, inventoryItems, lineQuantity]);

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
    if (activeMaterialCategories.length === 0) {
      setError("No hay categorías de material activas. Créalas en Inventario.");
      return;
    }
    const usedIds = new Set(
      (draft?.materials ?? [])
        .map((m) => m.inventoryItemId)
        .filter((id) => id > 0),
    );
    const hasAnyItem = inventoryItems.some((i) =>
      activeMaterialCategories.some((c) => c.id === i.materialCategoryId),
    );
    if (!hasAnyItem) {
      setError("No hay materiales en inventario para asignar.");
      return;
    }
    const row = defaultManualMaterialRow(materialCategories, inventoryItems, usedIds);
    if (!row) {
      setError("No hay categorías de material activas. Créalas en Inventario.");
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
          <div className="form-control sm:col-span-2">
            <label htmlFor="line-category" className="label-text text-xs">
              Categoría
            </label>
            <SearchSelect
              id="line-category"
              value={draft.categoryId > 0 ? String(draft.categoryId) : ""}
              options={categories.map((c) => ({
                value: String(c.id),
                label: c.name,
              }))}
              onChange={(next) => {
                if (next !== "") {
                  changeCategory(Number(next));
                }
              }}
              placeholder="Buscar o seleccionar categoría…"
              allowClear={false}
            />
          </div>
          <div className="form-control">
            <label htmlFor="line-format" className="label-text text-xs">
              Formato
            </label>
            <SearchSelect
              id="line-format"
              value={draft.formatId != null ? String(draft.formatId) : ""}
              options={formatOptions.map((f) => ({
                value: String(f.id),
                label: f.label,
              }))}
              onChange={(next) => changeFormat(next === "" ? null : Number(next))}
              placeholder="Buscar formato o dejar vacío…"
              allowClear
              clearLabel="Quitar formato"
            />
          </div>
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
          <div className="form-control sm:col-span-2">
            <label htmlFor="line-finish" className="label-text text-xs">
              Acabado (opcional)
            </label>
            {finishInfo.finishes.length > 0 ? (
              <SearchSelect
                id="line-finish"
                value={draft.finish}
                options={finishInfo.finishes.map((f) => ({
                  value: f,
                  label: f,
                }))}
                onChange={changeFinish}
                placeholder="Buscar acabado o dejar vacío…"
                allowClear
                clearLabel="Quitar acabado"
              />
            ) : (
              <input
                id="line-finish"
                className="input input-bordered input-sm"
                value={draft.finish}
                onChange={(e) => changeFinish(e.target.value)}
                placeholder="ej. brillo"
              />
            )}
          </div>

          <div className="form-control sm:col-span-2">
            <span className="label-text text-xs">Precio del producto</span>
            <p className="mb-1 text-xs text-base-content/50">
              Único por formato y acabado. Los tipos de trabajo no se cobran por separado.
            </p>
            <SalePriceInput
              valueCup={draft.services[0]?.unitPrice ?? manualPrice}
              rate={usdExchangeRate}
              placeholder="Precio"
              onChangeCup={(cup) => {
                if (hasConfiguredWorkTypes) {
                  setProductPrice(cup);
                } else {
                  setManualPrice(cup);
                }
              }}
            />
          </div>

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
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={!checked}
                        onClick={() => setEmployeesForService(opt.name)}
                        title="Tarifas de empleados en CUP"
                      >
                        Empleados{assignedCount > 0 ? ` (${assignedCount})` : ""}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1 text-xs text-base-content/50">
                Esta categoría no tiene tipos de trabajo asociados. Configúralos en Categorías o
                indica un precio unitario arriba.
              </p>
            )}
          </div>

          <div className="form-control sm:col-span-2">
            <span className="label-text text-xs">Materiales de inventario</span>
            <div role="tablist" className="tabs tabs-boxed mt-1 w-full">
              <button
                type="button"
                role="tab"
                className={`tab flex-1 ${draft.materialMode === "manual" ? "tab-active" : ""}`}
                onClick={() => setMaterialMode("manual")}
              >
                Asignación manual
              </button>
              <button
                type="button"
                role="tab"
                className={`tab flex-1 ${draft.materialMode === "norma" ? "tab-active" : ""}`}
                onClick={() => setMaterialMode("norma")}
              >
                Norma de producción
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
                      <li key={m.name} className="space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <span>{m.name}</span>
                          <span className="font-medium">{m.qty} / ud.</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1 text-base-content/60">
                          <span>
                            Necesario: {m.needed.toFixed(2)} {m.unit} · Stock: {m.stock} {m.unit}
                          </span>
                          {m.shortfall && (
                            <span className="badge badge-warning badge-xs">Déficit</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {hasNormShortage && (
                  <p className="mt-2 text-warning">
                    Se registrará como material en déficit; no podrás marcar Listo hasta reponer.
                  </p>
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
                  const item = inventoryItems.find((it) => it.id === m.inventoryItemId);
                  const perUnit = Number.parseFloat(m.quantityPerUnit.replace(",", "."));
                  const needed =
                    Number.isFinite(perUnit) && perUnit > 0 ? perUnit * lineQuantity : 0;
                  const stock = item?.quantity ?? 0;
                  const shortfall = needed > stock + 1e-9;
                  return (
                    <div
                      key={`mat-${index}-${m.materialCategoryId}-${m.inventoryItemId}`}
                      className="space-y-1 rounded-lg border border-base-300 p-2"
                    >
                      <div className="flex flex-wrap items-end gap-2">
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
                              itemsInCat.map((invItem) => (
                                <option key={invItem.id} value={invItem.id}>
                                  {formatInventoryMaterialOptionLabel(invItem)}
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
                      {item && needed > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-base-content/70">
                          <span>
                            Necesario: {needed.toFixed(2)} {item.unit} · Disponible: {stock}{" "}
                            {item.unit}
                          </span>
                          {shortfall && (
                            <span className="badge badge-warning badge-xs">Déficit</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {hasManualShortage && (
                  <p className="text-xs text-warning">
                    Se registrará como material en déficit; no podrás marcar Listo hasta reponer.
                  </p>
                )}
                <button type="button" className="btn btn-outline btn-xs" onClick={addManualMaterial}>
                  + Material
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span className="text-base-content/60">{moneyHeading("Subtotal de la línea", "USD")}</span>
          <span className="font-semibold">
            <DualMoneyText
              amountCup={draftLineSubtotal(draft, usdExchangeRate)}
              rate={usdExchangeRate}
              primary="USD"
            />
          </span>
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
