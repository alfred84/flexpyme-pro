import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ModalPortal } from "@/components/common/ModalPortal";
import { DenominationGrid } from "@/components/cashflow/DenominationGrid";
import { saveCashMonthOpening } from "@/db/queries/cashflow";
import { countsFromOpeningLines } from "@/features/cashflow/lib/cash-control";
import { emptyDenominationCounts, sumDenominationCounts } from "@/lib/cash-counts";
import { formatDate, monthEndIso, monthStartIso } from "@/lib/format-date";
import { formatAmount, moneyHeading } from "@/lib/format-money";
import type { CashControlSummaryDto } from "@/types/cashflow";

interface CashOpeningModalProps {
  /** Mes calendario (`YYYY-MM`). */
  month: string;
  /** Resumen actual (para precargar conteos). */
  summary: CashControlSummaryDto | undefined;
  /** Cierra el modal. */
  onClose: () => void;
  /** Se llama tras guardar con éxito. */
  onSaved: () => void;
}

/**
 * Modal para registrar o editar el conteo de billetes al inicio del mes.
 *
 * @param props - Mes, resumen, cierre y callback al guardar.
 * @returns Diálogo de saldo inicial CUP/USD.
 */
export function CashOpeningModal(props: CashOpeningModalProps) {
  const { month, summary, onClose, onSaved } = props;
  const queryClient = useQueryClient();
  const [cupCounts, setCupCounts] = useState<Record<string, number>>(() =>
    summary ? countsFromOpeningLines(summary.cup.lines, "CUP") : emptyDenominationCounts("CUP"),
  );
  const [usdCounts, setUsdCounts] = useState<Record<string, number>>(() =>
    summary ? countsFromOpeningLines(summary.usd.lines, "USD") : emptyDenominationCounts("USD"),
  );
  const [notes, setNotes] = useState(summary?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const cupTotal = sumDenominationCounts(cupCounts, "CUP");
  const usdTotal = sumDenominationCounts(usdCounts, "USD");
  const periodLabel = `${formatDate(monthStartIso(`${month}-01`))} – ${formatDate(monthEndIso(`${month}-01`))}`;

  const mutation = useMutation({
    mutationFn: saveCashMonthOpening,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cashflow", "control"] });
      onSaved();
      onClose();
    },
    onError: (err: Error) => setError(err.message || "No se pudo guardar el saldo inicial."),
  });

  /**
   * Envía el conteo declarado como saldo inicial del mes.
   */
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    mutation.mutate({
      month,
      countsCup: cupCounts,
      countsUsd: usdCounts,
      notes: notes.trim() || null,
    });
  };

  return (
    <ModalPortal>
      <dialog className="modal modal-open">
        <div className="modal-box max-h-[90vh] max-w-3xl overflow-y-auto">
          <h3 className="text-lg font-bold">Saldo inicial del mes</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Cuenta los billetes y monedas que hay en caja al comenzar el periodo {periodLabel}. CUP y
            USD son cajones independientes; no se convierte por tasa.
          </p>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            {error ? (
              <div className="alert alert-error text-sm">
                <span>{error}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-base-300 p-3">
                <DenominationGrid
                  currency="CUP"
                  counts={cupCounts}
                  onChange={setCupCounts}
                  label={moneyHeading("Conteo", "CUP")}
                  hideTotal
                />
                <p className="mt-2 text-right text-sm font-semibold">
                  Total CUP: {formatAmount(cupTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-base-300 p-3">
                <DenominationGrid
                  currency="USD"
                  counts={usdCounts}
                  onChange={setUsdCounts}
                  label={moneyHeading("Conteo", "USD")}
                  hideTotal
                />
                <p className="mt-2 text-right text-sm font-semibold">
                  Total USD: {formatAmount(usdTotal)}
                </p>
              </div>
            </div>

            <label className="form-control">
              <span className="label-text">Notas (opcional)</span>
              <textarea
                className="textarea textarea-bordered"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quién contó, observaciones…"
              />
            </label>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
                {mutation.isPending ? "Guardando…" : "Guardar saldo inicial"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" aria-label="Cerrar" onClick={onClose}>
            cerrar
          </button>
        </form>
      </dialog>
    </ModalPortal>
  );
}
