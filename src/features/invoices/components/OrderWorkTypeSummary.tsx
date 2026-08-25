import { DualMoneyText } from "@/components/common/DualMoneyText";
import type { SaleCurrency } from "@/lib/currency";
import { moneyHeading } from "@/lib/format-money";

/**
 * Fila de resumen de producción por tipo de trabajo.
 */
export interface WorkTypeSummaryRow {
  workType: string;
  quantity: number;
  amount: number;
}

interface OrderWorkTypeSummaryProps {
  rows: WorkTypeSummaryRow[];
  /** Tasa USD→CUP para el equivalente. */
  exchangeRate?: number;
  /** Moneda principal de visualización. */
  primary?: SaleCurrency;
  /** Título opcional de la sección. */
  title?: string;
  /** Nota bajo el título (p. ej. cobro único del producto). */
  caption?: string;
}

/**
 * Agrupa líneas de borrador o ítems de factura por tipo de trabajo.
 *
 * @param items - Lista con service, quantity y subtotal o unitPrice.
 * @returns Filas agregadas ordenadas por nombre.
 */
export function aggregateWorkTypeSummary(
  items: {
    service: string | null | undefined;
    quantity: number;
    unitPrice?: number;
    subtotal?: number;
  }[],
): WorkTypeSummaryRow[] {
  const map = new Map<string, WorkTypeSummaryRow>();
  for (const item of items) {
    const key = (item.service ?? "").trim() || "Sin tipo";
    const amount =
      item.subtotal ??
      (item.unitPrice !== undefined ? item.quantity * item.unitPrice : 0);
    const prev = map.get(key);
    if (prev) {
      prev.quantity += item.quantity;
      prev.amount += amount;
    } else {
      map.set(key, { workType: key, quantity: item.quantity, amount });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.workType.localeCompare(b.workType, "es"),
  );
}

/**
 * Resumen global de producción del pedido por tipo de trabajo (cantidad + importe).
 *
 * @param props - Filas agregadas.
 */
export function OrderWorkTypeSummary(props: OrderWorkTypeSummaryProps) {
  const {
    rows,
    exchangeRate = 0,
    primary = "USD",
    title = "Producción por tipo de trabajo",
    caption,
  } = props;
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-base-300 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {caption && <p className="mb-2 text-xs text-base-content/60">{caption}</p>}
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Tipo de trabajo</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">{moneyHeading("Importe", primary)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.workType}>
                <td>{row.workType}</td>
                <td className="text-right">{row.quantity}</td>
                <td className="text-right font-medium">
                  <DualMoneyText amountCup={row.amount} rate={exchangeRate} primary={primary} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
