import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { InventoryMovementsSection } from "@/features/inventory/components/InventoryMovementsSection";

/**
 * Movimientos globales de inventario: periodo, tabla y exporte Excel/PDF.
 *
 * @returns Página de movimientos de inventario.
 */
export function InventoryMovementsPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Link to="/inventario" className="btn btn-ghost btn-sm gap-2 px-0">
          <ArrowLeft className="h-4 w-4" />
          Inventario
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ArrowLeftRight className="h-6 w-6" /> Movimientos de inventario
        </h1>
        <p className="max-w-3xl text-sm text-base-content/70">
          Entradas y salidas de materiales. Filtra por día actual, mes actual o todo el histórico.
          Las ventas aparecen como método Venta. Excel y PDF usan el periodo activo.
        </p>
      </div>
      <InventoryMovementsSection hideHeading />
    </section>
  );
}
