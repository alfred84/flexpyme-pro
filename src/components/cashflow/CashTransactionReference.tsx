import { Link } from "@tanstack/react-router";

interface CashTransactionReferenceProps {
  referenceType: string | null;
  referenceId: number | null;
}

/**
 * Etiqueta de texto de la referencia de una transacción de caja.
 *
 * @param referenceType - Tipo de origen (`pedido`, `venta_material`, …).
 * @param referenceId - Id del origen, si aplica.
 * @returns Texto para tablas y exportes.
 */
export function cashTransactionReferenceLabel(
  referenceType: string | null,
  referenceId: number | null,
): string {
  if (referenceType === "pedido" && referenceId != null) {
    return `Pedido #${referenceId}`;
  }
  if (referenceType === "venta_material") {
    return "Venta de material";
  }
  if (!referenceType) {
    return "";
  }
  return referenceType;
}

/**
 * Enlace contextual desde una transacción de caja hacia su origen (pedido, etc.).
 *
 * @param props - Tipo e id de referencia de la transacción.
 * @returns Enlace o texto plano según el tipo de referencia.
 */
export function CashTransactionReference(props: CashTransactionReferenceProps) {
  const { referenceType, referenceId } = props;

  if (referenceType === "pedido" && referenceId != null) {
    return (
      <Link className="link link-primary text-xs" to="/pedidos/$invoiceId" params={{ invoiceId: String(referenceId) }}>
        {cashTransactionReferenceLabel(referenceType, referenceId)}
      </Link>
    );
  }

  const label = cashTransactionReferenceLabel(referenceType, referenceId);
  if (!label) {
    return <span>—</span>;
  }

  if (referenceType === "venta_material") {
    return <span>{label}</span>;
  }

  return <span className="capitalize">{label}</span>;
}
