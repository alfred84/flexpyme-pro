/**
 * Badge de estado de producción del pedido.
 *
 * @param status - `en_produccion` | `listo`.
 * @returns Etiqueta visual DaisyUI.
 */
export function ProductionStatusBadge({ status }: { status: string }) {
  const listo = status === "listo";
  return (
    <span className={`badge badge-sm ${listo ? "badge-success" : "badge-warning"}`}>
      {listo ? "Listo" : "En producción"}
    </span>
  );
}

/**
 * Badge de estado de cobro del pedido.
 *
 * @param status - `pendiente` | `cobrado`.
 * @returns Etiqueta visual DaisyUI.
 */
export function PaymentStatusBadge({ status }: { status: string }) {
  const cobrado = status === "cobrado";
  return (
    <span className={`badge badge-sm ${cobrado ? "badge-success" : "badge-warning"}`}>
      {cobrado ? "Cobrado" : "Pendiente"}
    </span>
  );
}
