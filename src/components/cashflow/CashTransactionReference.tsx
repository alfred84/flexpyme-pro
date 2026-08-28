import { Link } from "@tanstack/react-router";

interface CashTransactionReferenceProps {
  referenceType: string | null;
  referenceId: number | null;
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
        Pedido #{referenceId}
      </Link>
    );
  }

  if (referenceType === "venta_material") {
    return <span>Venta de material</span>;
  }

  if (!referenceType) {
    return <span>—</span>;
  }

  return <span className="capitalize">{referenceType}</span>;
}
