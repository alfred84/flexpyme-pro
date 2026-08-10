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
  /** Deuda abierta equivalente CUP (espejo contable). */
  balance: number;
  /** Deuda abierta en USD (suma de `balance_usd` de pedidos). */
  balanceUsd: number;
  /** Deuda abierta en CUP (parte CUP pendiente, sin restar crédito). */
  balanceCup: number;
  /** Saldo a favor disponible (CUP). */
  creditBalance: number;
  /** Suma de totales CUP equivalentes de todos los pedidos. */
  totalHistorical: number;
  /** Total histórico declarado a cobrar en USD (`Σ due_usd`). */
  totalHistoricalUsd: number;
  /** Total histórico declarado a cobrar en CUP (`Σ due_cup`). */
  totalHistoricalCup: number;
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
  totalUsd: number;
  paid: number;
  paidUsd: number;
  balance: number;
  balanceUsd: number;
  dueUsd: number;
  dueCup: number;
  productionStatus: string;
  paymentStatus: string;
  /** Moneda de cobro del pedido (`CUP` | `USD` | `mixto`), si se definió. */
  paymentCurrency: string | null;
  /** Tasa USD→CUP del pedido, si aplica. */
  exchangeRateSnapshot: number | null;
}

/**
 * Historial de pedidos y total acumulado de un cliente.
 */
export interface ClientWorkHistoryDto {
  invoices: ClientWorkHistoryRow[];
  totalHistorical: number;
  totalHistoricalUsd: number;
  totalHistoricalCup: number;
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
  balanceUsd: number;
  balanceCup: number;
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
