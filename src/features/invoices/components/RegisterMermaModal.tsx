import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ModalPortal } from "@/components/common/ModalPortal";
import { SearchSelect } from "@/components/common/SearchSelect";
import { registerInvoiceMaterialWaste } from "@/db/queries/inventory";
import { formatInventoryMaterialOptionLabel } from "@/features/inventory/lib/inventory-item-label";
import { MERMA_REASON_OPTIONS } from "@/features/invoices/lib/merma-reasons";
import { formatMoney } from "@/lib/format-money";
import type { InventoryItemDto, MermaReasonCode, RegisterMermaLinePayload } from "@/types/inventory";

interface MermaDraftRow {
  key: string;
  inventoryItemId: string;
  quantity: string;
  reasonCode: MermaReasonCode;
  notes: string;
}

interface RegisterMermaModalProps {
  invoiceId: number;
  inventoryItems: InventoryItemDto[];
  /** Ítems asignados al pedido; se listan primero en el selector. */
  orderMaterialIds: number[];
  onClose: () => void;
  onRegistered: () => void;
}

/**
 * Crea una fila vacía de merma.
 *
 * @returns Fila de borrador.
 */
function emptyRow(): MermaDraftRow {
  return {
    key: crypto.randomUUID(),
    inventoryItemId: "",
    quantity: "",
    reasonCode: "error_impresion",
    notes: "",
  };
}

/**
 * Modal para registrar merma de materiales de un pedido.
 * Descuenta almacén y guarda el costo según el precio unitario del ítem;
 * no altera el precio de venta al cliente.
 *
 * @param props - Pedido, catálogo y callbacks.
 * @returns Diálogo de registro de merma.
 */
export function RegisterMermaModal(props: RegisterMermaModalProps) {
  const { invoiceId, inventoryItems, orderMaterialIds, onClose, onRegistered } = props;
  const [rows, setRows] = useState<MermaDraftRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);

  const orderIdSet = useMemo(() => new Set(orderMaterialIds), [orderMaterialIds]);

  const materialOptions = useMemo(() => {
    const assigned = inventoryItems.filter((item) => orderIdSet.has(item.id));
    const rest = inventoryItems.filter((item) => !orderIdSet.has(item.id));
    return [...assigned, ...rest].map((item) => ({
      value: String(item.id),
      label: formatInventoryMaterialOptionLabel(item),
      searchText: `${item.name} ${item.unit}`,
    }));
  }, [inventoryItems, orderIdSet]);

  const mutation = useMutation({
    mutationFn: registerInvoiceMaterialWaste,
    onSuccess: () => {
      onRegistered();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No se pudo registrar la merma.");
    },
  });

  const updateRow = (key: string, patch: Partial<MermaDraftRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleSubmit = () => {
    setError(null);
    const items: RegisterMermaLinePayload[] = [];
    for (const row of rows) {
      const inventoryItemId = Number.parseInt(row.inventoryItemId, 10);
      const quantity = Number.parseFloat(row.quantity.replace(",", "."));
      if (!Number.isFinite(inventoryItemId) || inventoryItemId <= 0) {
        setError("Selecciona un material en cada fila.");
        return;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError("La cantidad de merma debe ser mayor que cero.");
        return;
      }
      const notes = row.notes.trim();
      if (row.reasonCode === "otro" && !notes) {
        setError("Indica el detalle del motivo «Otro».");
        return;
      }
      items.push({
        inventoryItemId,
        quantity,
        reasonCode: row.reasonCode,
        notes: notes || null,
      });
    }
    if (items.length === 0) {
      setError("Añade al menos un material merma.");
      return;
    }
    void mutation.mutateAsync({ invoiceId, items });
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-2xl">
          <h3 className="text-lg font-bold">Registrar merma</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Se descuenta el material del almacén y se registra el costo según el precio unitario
            del ítem. El precio del pedido para el cliente no cambia.
          </p>

          <div className="mt-4 space-y-3">
            {rows.map((row) => {
              const item = inventoryItems.find((it) => String(it.id) === row.inventoryItemId);
              const qty = Number.parseFloat(row.quantity.replace(",", "."));
              const previewCup =
                item && Number.isFinite(qty) && qty > 0 ? item.costPerUnit * qty : 0;
              const previewUsd =
                item && Number.isFinite(qty) && qty > 0 ? item.costPerUnitUsd * qty : 0;
              return (
                <div
                  key={row.key}
                  className="space-y-2 rounded-lg border border-base-300 p-3"
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="form-control min-w-[12rem] flex-[2]">
                      <label htmlFor={`merma-item-${row.key}`} className="label-text text-xs">
                        Material
                      </label>
                      <SearchSelect
                        id={`merma-item-${row.key}`}
                        value={row.inventoryItemId}
                        options={materialOptions}
                        onChange={(next) => updateRow(row.key, { inventoryItemId: next })}
                        placeholder="Buscar material…"
                        allowClear
                        clearLabel="Quitar material"
                      />
                    </div>
                    <label className="form-control w-24">
                      <span className="label-text text-xs">Cantidad</span>
                      <input
                        className="input input-bordered input-sm"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      />
                    </label>
                    <label className="form-control min-w-[10rem] flex-1">
                      <span className="label-text text-xs">Motivo</span>
                      <select
                        className="select select-bordered select-sm"
                        value={row.reasonCode}
                        onChange={(e) =>
                          updateRow(row.key, { reasonCode: e.target.value as MermaReasonCode })
                        }
                      >
                        {MERMA_REASON_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                        aria-label="Quitar fila"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {row.reasonCode === "otro" ? (
                    <label className="form-control">
                      <span className="label-text text-xs">Detalle del motivo *</span>
                      <input
                        className="input input-bordered input-sm"
                        value={row.notes}
                        onChange={(e) => updateRow(row.key, { notes: e.target.value })}
                        placeholder="Describe el motivo…"
                      />
                    </label>
                  ) : (
                    <label className="form-control">
                      <span className="label-text text-xs">Notas (opcional)</span>
                      <input
                        className="input input-bordered input-sm"
                        value={row.notes}
                        onChange={(e) => updateRow(row.key, { notes: e.target.value })}
                      />
                    </label>
                  )}
                  {item && (previewCup > 0 || previewUsd > 0) && (
                    <p className="text-xs text-base-content/60">
                      Costo estimado:{" "}
                      {previewCup > 0 ? formatMoney(previewCup, "CUP") : null}
                      {previewCup > 0 && previewUsd > 0 ? " · " : null}
                      {previewUsd > 0 ? formatMoney(previewUsd, "USD") : null}
                    </p>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
            >
              + Material
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <div className="modal-action">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-warning btn-sm"
              disabled={mutation.isPending}
              onClick={handleSubmit}
            >
              {mutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Registrar merma"
              )}
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
    </ModalPortal>
  );
}
