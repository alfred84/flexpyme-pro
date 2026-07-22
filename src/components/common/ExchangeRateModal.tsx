import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { ModalPortal } from "@/components/common/ModalPortal";
import { setExchangeRate } from "@/db/queries/settings";
import { useAppSettings } from "@/hooks/use-app-settings";
import type { ExchangeRateSource } from "@/types/settings";

interface ExchangeRateModalProps {
  open: boolean;
  source: ExchangeRateSource;
  onClose: () => void;
}

/**
 * Modal para actualizar la tasa USD→CUP sin salir de la pantalla actual.
 *
 * @param props - Visibilidad, origen del cambio y callback al cerrar.
 * @returns Diálogo modal de tasa de cambio.
 */
export function ExchangeRateModal(props: ExchangeRateModalProps) {
  const { open, source, onClose } = props;
  const queryClient = useQueryClient();
  const settings = useAppSettings();
  const [rate, setRate] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setRate(settings.usdExchangeRate > 0 ? String(settings.usdExchangeRate) : "");
      setSaved(false);
    }
  }, [open, settings.usdExchangeRate]);

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = Number.parseFloat(rate.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Indica una tasa válida mayor que cero.");
      }
      return setExchangeRate(parsed, source);
    },
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["settings", "exchange-rate-history"] });
      window.setTimeout(() => onClose(), 600);
    },
  });

  if (!open) {
    return null;
  }

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-w-sm">
          <h3 className="flex items-center gap-2 font-bold text-lg">
            <DollarSign className="h-5 w-5 text-success" />
            Tasa de cambio
          </h3>
          <p className="mt-1 text-sm text-base-content/70">1 USD equivale a cuántos CUP</p>
          {saved && <div className="alert alert-success mt-3 py-2 text-sm">Tasa actualizada.</div>}
          {mutation.isError && (
            <div className="alert alert-error mt-3 py-2 text-sm">
              <span>{(mutation.error as Error).message}</span>
            </div>
          )}
          <label className="form-control mt-4">
            <span className="label-text">Tasa (CUP por 1 USD)</span>
            <input
              id="exchange-rate-modal-input"
              type="number"
              min={0}
              step="any"
              className="input input-bordered"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              autoFocus
            />
          </label>
          <p className="mt-2 text-xs text-base-content/60">
            El cambio aplica de inmediato a operaciones en curso que usen la tasa vigente.
          </p>
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={mutation.isPending}
              onClick={() => void mutation.mutateAsync()}
            >
              {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : "Guardar tasa"}
            </button>
          </div>
        </div>
        <button type="button" className="modal-backdrop bg-black/40" aria-label="Cerrar" onClick={onClose} />
      </dialog>
    </ModalPortal>
  );
}
