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
          <label className="form-control">
            <span className="label-text text-xs">Cliente</span>
            <select
              id="inv-client"
              className="select select-bordered select-sm"
              value={clientId ? String(clientId) : ""}
              onChange={(e) => onClientChange(e.target.value === "" ? 0 : Number(e.target.value))}
            >
              <option value="">— Seleccionar —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
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
