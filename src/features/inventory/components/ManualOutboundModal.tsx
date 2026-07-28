import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { fetchInventoryItems, registerInventoryMovement } from "@/db/queries/inventory";

interface ManualOutboundModalProps {
  onClose: () => void;
}

/**
 * Salida manual de inventario no asociada a un pedido (motivo obligatorio).
 *
 * @param props - Callback al cerrar.
 * @returns Modal de salida manual.
 */
export function ManualOutboundModal(props: ManualOutboundModalProps) {
  const { onClose } = props;
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({ queryKey: ["inventory", "list"], queryFn: fetchInventoryItems });
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: registerInventoryMovement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "No se pudo registrar la salida");
    },
  });

  const handleSubmit = () => {
    setError(null);
    const id = Number.parseInt(itemId, 10);
    const qty = Number.parseFloat(quantity.replace(",", "."));
    if (!Number.isFinite(id) || id <= 0) {
      setError("Selecciona un material.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }
    if (!reason.trim()) {
      setError("El motivo de la salida es obligatorio.");
      return;
    }
    void mutation.mutateAsync({
      itemId: id,
      movementType: "salida",
      quantity: qty,
      reason: reason.trim(),
      notes: notes.trim() || null,
    });
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Salida manual de inventario</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Esta salida no está vinculada a un pedido. Indica claramente el motivo (merma, ajuste,
            uso interno, etc.).
          </p>
          <div className="mt-4 space-y-3">
            <label className="form-control">
              <span className="label-text">Material *</span>
              <select
                className="select select-bordered"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {(itemsQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (stock: {item.quantity} {item.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">Cantidad *</span>
              <input
                className="input input-bordered"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text">Motivo de la salida *</span>
              <input
                className="input input-bordered"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Merma por humedad"
              />
            </label>
            <label className="form-control">
              <span className="label-text">Notas</span>
              <textarea
                className="textarea textarea-bordered"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-warning"
              disabled={mutation.isPending}
              onClick={handleSubmit}
            >
              {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Registrar salida"}
            </button>
          </div>
        </div>
        <button type="button" className="modal-backdrop bg-transparent" aria-label="Cerrar" onClick={onClose} />
      </dialog>
    </ModalPortal>
  );
}
