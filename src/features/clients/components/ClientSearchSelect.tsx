import { SearchSelect, type SearchSelectOption } from "@/components/common/SearchSelect";

/** Opción mínima para el selector de clientes. */
export interface ClientSearchOption {
  id: number;
  code: string;
  name: string;
}

interface ClientSearchSelectProps {
  /** Id del input (asociación con label). */
  id?: string;
  /** Cliente seleccionado (`0` = ninguno). */
  value: number;
  /** Lista de clientes activos. */
  clients: ClientSearchOption[];
  /** Callback al elegir o limpiar cliente. */
  onChange: (clientId: number) => void;
  /** Texto cuando no hay selección. */
  placeholder?: string;
  /** Deshabilita interacción. */
  disabled?: boolean;
  /** Máximo de resultados visibles tras filtrar. */
  maxResults?: number;
}

/**
 * Selector de cliente con búsqueda (combobox) para listas largas.
 *
 * @param props - Valor, opciones y callbacks.
 * @returns Combobox de cliente.
 */
export function ClientSearchSelect(props: ClientSearchSelectProps) {
  const {
    id,
    value,
    clients,
    onChange,
    placeholder = "Buscar o seleccionar cliente…",
    disabled = false,
    maxResults,
  } = props;

  const options: SearchSelectOption[] = clients.map((client) => ({
    value: String(client.id),
    label: `${client.code} — ${client.name}`,
    searchText: `${client.code} ${client.name}`,
  }));

  return (
    <SearchSelect
      id={id}
      value={value > 0 ? String(value) : ""}
      options={options}
      onChange={(next) => onChange(next === "" ? 0 : Number(next))}
      placeholder={placeholder}
      disabled={disabled}
      allowClear
      clearLabel="Quitar cliente"
      maxResults={maxResults}
    />
  );
}
