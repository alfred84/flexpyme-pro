import { Pencil, Trash2 } from "lucide-react";
import { DualMoneyText } from "@/components/common/DualMoneyText";
import { draftLineSubtotal, draftLineUnitPriceCup, type DraftLine } from "@/features/invoices/lib/order-draft";
import { moneyHeading } from "@/lib/format-money";

interface OrderLinesTableProps {
  lines: DraftLine[];
  categoryNames: Map<number, string>;
  formatLabels: Map<number, string>;
  /** Tasa USD→CUP para mostrar importes en USD. */
  exchangeRate: number;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
}

/**
 * Tabla compacta de líneas del pedido en creación.
 *
 * @param props - Líneas y mapas de etiquetas.
 * @returns Tabla de líneas.
 */
export function OrderLinesTable(props: OrderLinesTableProps) {
  const { lines, categoryNames, formatLabels, exchangeRate, onEdit, onRemove } = props;

  if (lines.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-base-content/60">
        Aún no hay líneas. Pulsa «Añadir línea» para agregar productos.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-xs sm:table-sm">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Formato</th>
            <th>Tipos de trabajo</th>
            <th>Acabado</th>
            <th className="text-right">Cant.</th>
            <th className="text-right">{moneyHeading("P.U. total", "USD")}</th>
            <th className="text-right">{moneyHeading("Subtotal", "USD")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const serviceLabels = line.services
              .map((s) => s.service.trim())
              .filter((s) => s.length > 0);
            const unitCup = draftLineUnitPriceCup(line, exchangeRate);
            return (
              <tr key={line.key}>
                <td className="max-w-[8rem] truncate">
                  {categoryNames.get(line.categoryId) ?? "—"}
                </td>
                <td>{line.formatId ? (formatLabels.get(line.formatId) ?? "—") : "—"}</td>
                <td className="max-w-[10rem]">
                  {serviceLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-0.5">
                      {serviceLabels.map((s) => (
                        <span key={s} className="badge badge-ghost badge-sm">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-[6rem] truncate">{line.finish || "—"}</td>
                <td className="text-right">{line.quantity}</td>
                <td className="text-right font-mono text-xs">
                  <DualMoneyText amountCup={unitCup} rate={exchangeRate} primary="USD" />
                </td>
                <td className="text-right font-mono text-xs">
                  <DualMoneyText
                    amountCup={draftLineSubtotal(line, exchangeRate)}
                    rate={exchangeRate}
                    primary="USD"
                  />
                </td>
                <td>
                  <div className="flex justify-end gap-0.5">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Editar"
                      onClick={() => onEdit(line.key)}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      title="Eliminar"
                      onClick={() => onRemove(line.key)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
