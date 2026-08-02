/**
 * Client record returned from Tauri SQLite commands.
 */
export interface ClientDto {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  /** Deuda abierta (suma de saldos de pedidos). */
  balance: number;
  /** Saldo a favor disponible. */
  creditBalance: number;
  /** Suma de totales de todos los pedidos del cliente. */
  totalHistorical: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pedido en el historial de trabajos de un cliente.
 */
export interface ClientWorkHistoryRow {
  id: number;
  invoiceNumber: string;
  date: string;
  total: number;
  paid: number;
  balance: number;
  productionStatus: string;
  paymentStatus: string;
}

/**
 * Historial de pedidos y total acumulado de un cliente.
 */
export interface ClientWorkHistoryDto {
  invoices: ClientWorkHistoryRow[];
  totalHistorical: number;
}

/**
 * Cliente con eliminación lógica, para el modal de restauración.
 */
export interface DeletedClientDto {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  balance: number;
  creditBalance: number;
  deletedAt: string;
}

/**
 * Payload for creating a client.
 */
export interface CreateClientPayload {
  code: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

/**
 * Payload for updating a client.
 */
export interface UpdateClientPayload extends CreateClientPayload {
  id: number;
}
