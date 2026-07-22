import { useEffect, useMemo, useState } from "react";
import {
  draftLineSubtotal,
  formatOptionsForCategory,
  resolveServicePrice,
  serviceAndFinishOptions,
  type DraftLine,
  type DraftLineService,
} from "@/features/invoices/lib/order-draft";
import { formatMoney } from "@/lib/format-money";
import type {
  CategoryFinishDto,
  CategoryFormatDto,
  CategoryWorkTypeDto,
  ProductCategoryDto,
} from "@/types/category";
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
  const configured = categoryFinishes.filter((f) => f.categoryId === categoryId);
  if (configured.length > 0) {
    const def = configured.find((f) => f.isDefault);
    return { finishes: configured.map((f) => f.finish), defaultFinish: def?.finish ?? "" };
  }
  const { finishes } = serviceAndFinishOptions(prices, categoryId, formatId);
  return { finishes, defaultFinish: "" };
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
    onClose,
    onSave,
  } = props;
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      return { service: o.name, unitPrice: price !== null ? String(price) : "" };
    });
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    if (editing) {
      setDraft({ ...editing, services: editing.services.map((s) => ({ ...s })) });
    } else {
      const { defaultFinish } = finishOptionsFor(categoryFinishes, prices, defaultCategoryId, null);
      setDraft({
        key: crypto.randomUUID(),
        categoryId: defaultCategoryId,
        formatId: null,
        finish: defaultFinish,
        quantity: "1",
        services: buildDefaultWorkTypes(defaultCategoryId, null, defaultFinish),
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
            { service: name, unitPrice: price !== null ? String(price) : "" },
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

  /** Precio del modo manual (categorías sin tipos de trabajo configurados). */
  const setManualPrice = (unitPrice: string) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return { ...prev, services: [{ service: "", unitPrice }] };
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
    onSave(draft);
    onClose();
  };

  if (!open || !draft) {
    return null;
  }

  const manualPrice = draft.services[0]?.unitPrice ?? "";

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
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
                  return (
                    <div key={opt.name} className="flex items-center gap-2">
                      <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
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
  );
}
