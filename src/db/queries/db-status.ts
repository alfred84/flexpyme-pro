import { invoke } from "@tauri-apps/api/core";
import type { DbStatusPayload } from "@/types/tauri";

/**
 * Requests backend to ensure SQLite exists and returns readiness payload.
 */
export async function getDbStatus(): Promise<DbStatusPayload> {
  // Allow dashboard to work when opened in plain browser (vite dev URL).
  if (!("__TAURI_INTERNALS__" in window)) {
    return {
      status: "browser-dev",
      dbPath: "No disponible fuera de Tauri",
    };
  }
  return invoke<DbStatusPayload>("db_status");
}

/**
 * Returns absolute database path resolved by Rust backend.
 */
export async function getDbFilePath(): Promise<string> {
  return invoke<string>("db_file_path");
}
