import { invoke } from "@tauri-apps/api/core";
import type { ClientDto, CreateClientPayload, UpdateClientPayload } from "@/types/client";

/**
 * Fetches all active clients from SQLite.
 */
export async function fetchClients(): Promise<ClientDto[]> {
  return invoke<ClientDto[]>("clients_list");
}

/**
 * Loads one client by numeric id.
 */
export async function fetchClientById(id: number): Promise<ClientDto> {
  return invoke<ClientDto>("clients_get_by_id", { id });
}

/**
 * Persists a new client row.
 */
export async function createClient(payload: CreateClientPayload): Promise<number> {
  return invoke<number>("clients_create", { payload });
}

/**
 * Updates an existing client row.
 */
export async function updateClient(payload: UpdateClientPayload): Promise<void> {
  return invoke<void>("clients_update", { payload });
}

/**
 * Soft-deletes a client (sets deleted_at).
 */
export async function softDeleteClient(id: number): Promise<void> {
  return invoke<void>("clients_soft_delete", { id });
}
