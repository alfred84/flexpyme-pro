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
  balance: number;
  createdAt: string;
  updatedAt: string;
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
