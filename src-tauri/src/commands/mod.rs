pub mod cashier;
pub mod clients;
pub mod employees;
pub mod inventory;
pub mod invoices;
pub mod production;
pub mod products;
pub mod reports;
pub mod settings;

use crate::db;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatusPayload {
    pub status: String,
    pub db_path: String,
}

/// Provides a basic application health check through Tauri invoke.
#[tauri::command]
pub fn healthcheck() -> String {
    "ok".to_string()
}

/// Returns the configured SQLite file location used by Drizzle and seeds.
#[tauri::command]
pub fn db_file_path() -> Result<String, String> {
    let path = db::resolve_db_path()?;
    Ok(path.to_string_lossy().to_string())
}

/// Basic database status command for frontend connectivity checks.
#[tauri::command]
pub fn db_status() -> Result<DbStatusPayload, String> {
    let db_path = db::ensure_database_ready()?;
    Ok(DbStatusPayload {
        status: "ready".to_string(),
        db_path,
    })
}
