import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scissors } from "lucide-react";
import { fetchInvoiceMaterialWastes, fetchInventoryItems } from "@/db/queries/inventory";
import { RegisterMermaModal } from "@/features/invoices/components/RegisterMermaModal";
import { formatDateTime } from "@/lib/format-date";
import { formatAmount, formatMoney, moneyHeading } from "@/lib/format-money";
import type { InventoryItemDto } from "@/types/inventory";

interface OrderMermasSectionProps {
  invoiceId: number;
  /** Si es false (pedido anulado), solo se puede consultar el historial. */
  canRegister: boolean;
  /** Catálogo ya cargado (edición); si falta, se consulta aquí. */
  inventoryItems?: InventoryItemDto[];
  /** Ítems de inventario asignados a líneas del pedido. */
  orderMaterialIds: number[];
  /** Si true, la tabla de mermas empieza plegada (detalle del pedido). */
  collapseList?: boolean;
}

/**
 * Gestión de mermas de un pedido: registro y consulta del historial con costo.
 *
 * @param props - Pedido y catálogo de materiales.
 * @returns Bloque de UI de mermas.
 */
export function OrderMermasSection(props: OrderMermasSectionProps) {
  const {
    invoiceId,
    canRegister,
    inventoryItems: inventoryItemsProp,
    orderMaterialIds,
    collapseList = false,
  } = props;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [listOpen, setListOpen] = useState(!collapseList);
  const [successText, setSuccessText] = useState<string | null>(null);

  const wastesQuery = useQuery({
    queryKey: ["invoices", "mermas", invoiceId],
    queryFn: () => fetchInvoiceMaterialWastes(invoiceId),
    enabled: Number.isFinite(invoiceId) && invoiceId > 0,
  });
  const itemsQuery = useQuery({
    queryKey: ["inventory", "list"],
    queryFn: fetchInventoryItems,
    enabled: inventoryItemsProp == null,
  });

  const wastes = wastesQuery.data ?? [];
  const inventoryItems = inventoryItemsProp ?? itemsQuery.data ?? [];
  const hasWastes = wastes.length > 0;

  const totals = useMemo(() => {
    return wastes.reduce(
      (acc, row) => ({
        costCup: acc.costCup + row.costCup,
        costUsd: acc.costUsd + row.costUsd,
      }),
      { costCup: 0, costUsd: 0 },
    );
  }, [wastes]);

  const handleRegistered = async () => {
    setModalOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["invoices", "mermas", invoiceId] });
    await queryClient.invalidateQueries({ queryKey: ["inventory"] });
    await queryClient.invalidateQueries({ queryKey: ["invoices", "detail", invoiceId] });
    setSuccessText("Merma registrada. El precio del pedido no cambia.");
    setListOpen(true);
  };

  if (!canRegister && !hasWastes && !wastesQuery.isLoading) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Scissors className="h-4 w-4" />
            Mermas de producción
          </h2>
          <p className="text-xs text-base-content/60">
            Costo interno del material perdido. No modifica el precio al cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasWastes && collapseList && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setListOpen((open) => !open)}
            >
              {listOpen ? "Ocultar mermas" : `Ver mermas (${wastes.length})`}
            </button>
          )}
          {canRegister && (
            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={() => setModalOpen(true)}
            >
              Registrar merma
            </button>
          )}
        </div>
      </div>

      {successText && (
        <div className="alert alert-success text-sm">
          <span>{successText}</span>
        </div>
      )}

      {wastesQuery.isLoading && <p className="text-sm text-base-content/60">Cargando mermas…</p>}
      {wastesQuery.isError && (
        <div className="alert alert-error">
          <span>No se pudieron cargar las mermas del pedido.</span>
        </div>
      )}

      {hasWastes && listOpen && (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Material</th>
                <th className="text-right">Cantidad</th>
                <th>Motivo</th>
                <th className="text-right">{moneyHeading("Costo")}</th>
                <th className="text-right">{moneyHeading("Costo", "USD")}</th>
              </tr>
            </thead>
            <tbody>
              {wastes.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</td>
                  <td className="font-medium">{row.itemName}</td>
                  <td className="text-right">
                    {row.quantity} {row.unit}
                  </td>
                  <td>
                    {row.reasonLabel}
                    {row.notes ? (
                      <div className="text-xs text-base-content/60">{row.notes}</div>
                    ) : null}
                  </td>
                  <td className="text-right">
                    {row.costCup > 0 ? formatAmount(row.costCup) : "—"}
                  </td>
                  <td className="text-right">
                    {row.costUsd > 0 ? formatAmount(row.costUsd) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {(totals.costCup > 0 || totals.costUsd > 0) && (
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={4}>Total costo merma</td>
                  <td className="text-right">
                    {totals.costCup > 0 ? formatMoney(totals.costCup, "CUP") : "—"}
                  </td>
                  <td className="text-right">
                    {totals.costUsd > 0 ? formatMoney(totals.costUsd, "USD") : "—"}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {modalOpen && (
        <RegisterMermaModal
          invoiceId={invoiceId}
          inventoryItems={inventoryItems}
          orderMaterialIds={orderMaterialIds}
          onClose={() => setModalOpen(false)}
          onRegistered={() => {
            void handleRegistered();
          }}
        />
      )}
    </div>
  );
}
