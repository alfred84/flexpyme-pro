import { ClientSearchSelect } from "@/features/clients/components/ClientSearchSelect";

interface OrderHeaderSectionProps {
  clientId: number;
  date: string;
  notes: string;
  clients: { id: number; code: string; name: string }[];
  onClientChange: (clientId: number) => void;
  onDateChange: (date: string) => void;
  onNotesChange: (notes: string) => void;
}

/**
 * Panel compacto de encabezado del pedido (cliente, fecha, notas).
 *
 * @param props - Valores y callbacks del encabezado.
 * @returns Bloque de encabezado.
 */
export function OrderHeaderSection(props: OrderHeaderSectionProps) {
  const { clientId, date, notes, clients, onClientChange, onDateChange, onNotesChange } = props;

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-3">
        <h2 className="card-title text-sm">Encabezado</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="form-control">
            <label htmlFor="inv-client" className="label-text text-xs">
              Cliente
            </label>
            <ClientSearchSelect
              id="inv-client"
              value={clientId}
              clients={clients}
              onChange={onClientChange}
            />
          </div>
          <label className="form-control">
            <span className="label-text text-xs">Fecha</span>
            <input
              id="inv-date"
              type="date"
              className="input input-bordered input-sm"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </label>
        </div>
        <label className="form-control">
          <span className="label-text text-xs">Notas</span>
          <input
            id="inv-notes"
            type="text"
            className="input input-bordered input-sm"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Opcional"
          />
        </label>
      </div>
    </div>
  );
}
