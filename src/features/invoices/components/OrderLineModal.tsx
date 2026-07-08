import { useEffect, useMemo, useState } from "react";
import {
  autoFillLineFromPrices,
  formatOptionsForCategory,
  resolvePriceFromRows,
  serviceAndFinishOptions,
  filterPricesByCategory,
  type DraftLine,
} from "@/features/invoices/lib/order-draft";
import type { ProductCategoryDto } from "@/types/category";
import type { FormatDto, PriceRowDto } from "@/types/price";

interface OrderLineModalProps {
  open: boolean;
  editing: DraftLine | null;
  defaultCategoryId: number;
  categories: ProductCategoryDto[];
  formats: FormatDto[];
  prices: PriceRowDto[];
  onClose: () => void;
  onSave: (line: DraftLine) => void;
}

/**
 * Modal CRUD para añadir o editar una línea de pedido con autocompletado de precios.
 *
 * @param props - Estado del modal y catálogos.
 * @returns Diálogo de línea de pedido.
 */
export function OrderLineModal(props: OrderLineModalProps) {
  const { open, editing, defaultCategoryId, categories, formats, prices, onClose, onSave } = props;
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (editing) {
      setDraft({ ...editing });
    } else {
      setDraft({
        key: crypto.randomUUID(),
        categoryId: defaultCategoryId,
        formatId: null,
        finish: "",
        service: "",
        quantity: "1",
        unitPrice: "",
      });
    }
    setError(null);
  }, [open, editing, defaultCategoryId]);

  const formatOptions = useMemo(() => {
    if (!draft) {
      return [];
    }
    return formatOptionsForCategory(prices, draft.categoryId, formats);
  }, [draft, prices, formats]);

  const { services, finishes } = useMemo(() => {
    if (!draft) {
      return { services: [], finishes: [] };
    }
    return serviceAndFinishOptions(prices, draft.categoryId, draft.formatId);
  }, [draft, prices]);

  const applyAutoFill = (base: DraftLine, patch: Partial<DraftLine>): DraftLine => {
    const merged = { ...base, ...patch };
    const auto = autoFillLineFromPrices(prices, merged);
    return { ...merged, ...auto };
  };

  const updateDraft = (patch: Partial<DraftLine>) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      if (patch.categoryId !== undefined && patch.categoryId !== prev.categoryId) {
        return applyAutoFill(
          {
            ...prev,
            categoryId: patch.categoryId,
            formatId: null,
            service: "",
            finish: "",
            unitPrice: "",
          },
          {},
        );
      }
      if (patch.formatId !== undefined && patch.formatId !== prev.formatId) {
        return applyAutoFill(
          {
            ...prev,
            formatId: patch.formatId,
            service: "",
            finish: "",
            unitPrice: "",
          },
          {},
        );
      }
      const merged = applyAutoFill({ ...prev, ...patch }, {});
      if (patch.service !== undefined || patch.finish !== undefined) {
        const rows = filterPricesByCategory(prices, merged.categoryId, merged.formatId);
        const price = resolvePriceFromRows(rows, merged.service, merged.finish);
        if (price !== null) {
          merged.unitPrice = String(price);
        }
      }
      return merged;
    });
  };

  const handleSave = () => {
    if (!draft) {
      return;
    }
    const qty = Number.parseInt(draft.quantity, 10);
    const unit = Number.parseFloat(draft.unitPrice.replace(",", "."));
    if (!draft.categoryId) {
      setError("Selecciona una categoría.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }
    if (!Number.isFinite(unit) || unit < 0) {
      setError("Indica un precio unitario válido.");
      return;
    }
    onSave(draft);
    onClose();
  };

  if (!open || !draft) {
    return null;
  }

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
              onChange={(e) => updateDraft({ categoryId: Number(e.target.value) })}
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
                updateDraft({ formatId: v === "" ? null : Number(v) });
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
              onChange={(e) => updateDraft({ quantity: e.target.value })}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Servicio</span>
            {services.length > 0 ? (
              <select
                className="select select-bordered select-sm"
                value={draft.service}
                onChange={(e) => updateDraft({ service: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {services.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input input-bordered input-sm"
                value={draft.service}
                onChange={(e) => updateDraft({ service: e.target.value })}
                placeholder="ej. impresión"
              />
            )}
          </label>
          <label className="form-control">
            <span className="label-text text-xs">Acabado</span>
            {finishes.length > 0 ? (
              <select
                className="select select-bordered select-sm"
                value={draft.finish}
                onChange={(e) => updateDraft({ finish: e.target.value })}
              >
                <option value="">— Seleccionar —</option>
                {finishes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input input-bordered input-sm"
                value={draft.finish}
                onChange={(e) => updateDraft({ finish: e.target.value })}
                placeholder="ej. brillo"
              />
            )}
          </label>
          <label className="form-control sm:col-span-2">
            <span className="label-text text-xs">Precio unitario (CUP)</span>
            <input
              type="text"
              inputMode="decimal"
              className="input input-bordered input-sm"
              value={draft.unitPrice}
              onChange={(e) => updateDraft({ unitPrice: e.target.value })}
            />
          </label>
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
