import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { fetchCostListForWorkType } from "@/db/queries/employees";
import { markInvoiceItemListo } from "@/db/queries/invoices";
import { todayIso } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import type { InvoiceItemDto } from "@/types/invoice";

interface WorkTypeOption {
  id: number;
  name: string;
  code: string;
}

interface WorkerRow {
  employeeId: number;
  employeeName: string;
  quantity: string;
  unitCost: string;
}

interface ConfirmCompleteWorkModalProps {
  open: boolean;
  item: InvoiceItemDto | null;
  workTypes: WorkTypeOption[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal de confirmación para marcar una línea como Listo (opción C):
 * pre-rellena empleados asignados con 1 ud. y tarifa custom o de Precios.
 *
 * @param props - Línea, tipos de trabajo y callbacks.
 */
export function ConfirmCompleteWorkModal(props: ConfirmCompleteWorkModalProps) {
  const { open, item, workTypes, onClose, onSuccess } = props;
  const [date, setDate] = useState(() => todayIso());
  const [rows, setRows] = useState<WorkerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const workType = useMemo(() => {
    if (!item?.service) {
      return null;
    }
    const want = item.service.trim().toLowerCase();
    return (
      workTypes.find(
        (wt) => wt.name.toLowerCase() === want || wt.code.toLowerCase() === want,
      ) ?? null
    );
  }, [item, workTypes]);

  const costsQuery = useQuery({
    queryKey: ["cost-list", workType?.id],
    queryFn: () => fetchCostListForWorkType(workType!.id),
    enabled: open && Boolean(workType?.id),
  });

  const defaultCost = useMemo(() => {
    if (!item || !costsQuery.data) {
      return 0;
    }
    const match = costsQuery.data.find((c) => c.formatId === item.formatId);
    return match?.unitCost ?? costsQuery.data[0]?.unitCost ?? 0;
  }, [costsQuery.data, item]);

  useEffect(() => {
    if (!open || !item) {
      return;
    }
    setDate(todayIso());
    setError(null);
    const pending = Math.max(0, item.quantity - item.completedQuantity);
    const assignments = item.assignments ?? [];
    let remaining = pending;
    const next: WorkerRow[] = assignments.map((a, idx) => {
      const isLast = idx === assignments.length - 1;
      const qty = isLast ? remaining : Math.min(1, remaining);
      if (!isLast) {
        remaining -= qty;
      } else {
        remaining = 0;
      }
      return {
        employeeId: a.employeeId,
        employeeName: a.employeeName,
        quantity: String(Math.max(qty, 0)),
        unitCost: String(
          a.customUnitCost !== null && a.customUnitCost !== undefined
            ? a.customUnitCost
            : defaultCost,
        ),
      };
    });
    setRows(next);
  }, [open, item, defaultCost]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) {
        throw new Error("Línea no válida");
      }
      if (rows.length === 0) {
        throw new Error("Asigna empleados a la línea antes de marcar listo.");
      }
      const workers = rows.map((r) => {
        const quantity = Number.parseInt(r.quantity, 10);
        const unitCost = Number.parseFloat(r.unitCost.replace(",", "."));
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Cantidad inválida para ${r.employeeName}`);
        }
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error(`Tarifa inválida para ${r.employeeName}`);
        }
        return { employeeId: r.employeeId, quantity, unitCost };
      });
      const pending = Math.max(0, item.quantity - item.completedQuantity);
      const sum = workers.reduce((s, w) => s + w.quantity, 0);
      if (sum > pending) {
        throw new Error(`La suma de cantidades (${sum}) supera lo pendiente (${pending}).`);
      }
      return markInvoiceItemListo({
        invoiceItemId: item.id,
        date,
        workers,
      });
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!open || !item) {
    return null;
  }

  const totalPay = rows.reduce((sum, r) => {
    const q = Number.parseInt(r.quantity, 10) || 0;
    const c = Number.parseFloat(r.unitCost.replace(",", ".")) || 0;
    return sum + q * c;
  }, 0);

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-lg">
          <h3 className="font-bold text-lg">Confirmar Listo — {item.service ?? "Línea"}</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Se crearán lotes de producción por empleado. Puedes ajustar cantidad y tarifa antes de
            confirmar.
          </p>
          <label className="form-control mt-3 w-full max-w-xs">
            <span className="label-text text-xs">Fecha del lote</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-warning">
                Esta línea no tiene empleados asignados. Edita el pedido y asígnalos primero.
              </p>
            ) : (
              rows.map((r) => (
                <div
                  key={r.employeeId}
                  className="flex flex-wrap items-end gap-2 rounded-lg border border-base-300 p-2"
                >
                  <div className="min-w-0 flex-1 text-sm font-medium">{r.employeeName}</div>
                  <label className="form-control w-20">
                    <span className="label-text text-[10px]">Cant.</span>
                    <input
                      className="input input-bordered input-xs"
                      value={r.quantity}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.employeeId === r.employeeId
                              ? { ...x, quantity: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="form-control w-24">
                    <span className="label-text text-[10px]">Tarifa</span>
                    <input
                      className="input input-bordered input-xs"
                      value={r.unitCost}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.employeeId === r.employeeId
                              ? { ...x, unitCost: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex justify-between text-sm">
            <span>Total a pagar (lotes)</span>
            <span className="font-semibold">{formatMoney(totalPay)}</span>
          </div>
          {error && <p className="mt-2 text-error text-sm">{error}</p>}

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={mutation.isPending || rows.length === 0}
              onClick={() => void mutation.mutateAsync()}
            >
              {mutation.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Confirmar Listo"
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
