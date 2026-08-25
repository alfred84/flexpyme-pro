/**
 * Clave de agrupación del producto terminado en un pedido.
 *
 * @param item - Ítem de factura.
 * @returns Clave estable categoría|formato|acabado|cantidad.
 */
export function invoiceProductGroupKey(item: {
  categoryId: number;
  formatId: number | null;
  finish: string | null;
  quantity: number;
}): string {
  return [
    item.categoryId,
    item.formatId ?? "null",
    (item.finish ?? "").trim().toLowerCase(),
    item.quantity,
  ].join("|");
}

/**
 * Agrupa ítems del pedido por producto terminado, conservando el orden de aparición.
 *
 * @param items - Líneas del detalle.
 * @returns Grupos; cada grupo son los tipos de trabajo de un mismo producto.
 */
export function groupInvoiceItemsByProduct<T extends {
  categoryId: number;
  formatId: number | null;
  finish: string | null;
  quantity: number;
}>(items: readonly T[]): T[][] {
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = invoiceProductGroupKey(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      order.push(key);
      map.set(key, [item]);
    }
  }
  return order.map((key) => map.get(key) ?? []);
}

function itemCarriesCharge(item: {
  unitPrice: number;
  unitPriceUsd?: number | null;
}): boolean {
  return (item.unitPrice ?? 0) > 0 || (item.unitPriceUsd ?? 0) > 0;
}

/**
 * Precio unitario CUP del producto (una vez por grupo).
 *
 * @param group - Tipos de trabajo del mismo producto.
 * @returns Precio único; si hay importes distintos (legado), la suma.
 */
export function invoiceProductGroupUnitPrice(
  group: readonly { unitPrice: number; unitPriceUsd?: number | null }[],
): number {
  const charged = group.filter(itemCarriesCharge);
  const cups = (charged.length > 0 ? charged : group).map((item) => item.unitPrice ?? 0);
  const positive = cups.filter((c) => c > 0);
  if (positive.length === 0) {
    return 0;
  }
  const first = positive[0] ?? 0;
  const allEqual = positive.every((c) => Math.abs(c - first) < 0.0001);
  return allEqual ? first : positive.reduce((sum, c) => sum + c, 0);
}

/**
 * Subtotal CUP del producto (suma de ítems del grupo; en el modelo actual
 * solo uno lleva cobro).
 *
 * @param group - Tipos de trabajo del mismo producto.
 * @returns Subtotal en CUP.
 */
export function invoiceProductGroupSubtotal(
  group: readonly { subtotal: number }[],
): number {
  return group.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
}

/**
 * Indica si un ítem de pedido es un tipo de trabajo incluido en el producto
 * (el cobro va en otro ítem del mismo formato/acabado/cantidad).
 *
 * @param item - Ítem a evaluar.
 * @param items - Todos los ítems del pedido.
 * @returns `true` si el precio se cobra en un hermano del mismo producto.
 */
export function invoiceItemIsIncludedInProductCharge(
  item: {
    id: number;
    categoryId: number;
    formatId: number | null;
    finish: string | null;
    quantity: number;
    unitPrice: number;
    unitPriceUsd?: number | null;
  },
  items: readonly {
    id: number;
    categoryId: number;
    formatId: number | null;
    finish: string | null;
    quantity: number;
    unitPrice: number;
    unitPriceUsd?: number | null;
  }[],
): boolean {
  const carriesCharge = (row: (typeof items)[number]): boolean => itemCarriesCharge(row);
  if (carriesCharge(item)) {
    return false;
  }
  const finish = (item.finish ?? "").trim().toLowerCase();
  return items.some(
    (other) =>
      other.id !== item.id &&
      other.categoryId === item.categoryId &&
      other.formatId === item.formatId &&
      (other.finish ?? "").trim().toLowerCase() === finish &&
      other.quantity === item.quantity &&
      carriesCharge(other),
  );
}
