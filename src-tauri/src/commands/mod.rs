pub mod cashflow;
pub mod cashier;
pub mod categories;
pub mod clients;
pub mod employee_roles;
pub mod employees;
pub mod formats;
pub mod finishes;
pub mod work_types;
pub mod units;
pub mod stock;
pub mod inventory;
pub mod invoices;
pub mod other_expenses;
pub mod expense_types;
pub mod production;
pub mod products;
pub mod reports;
pub mod settings;

use crate::db;
use serde::Serialize;

/// Normaliza un texto para comparar servicios/áreas: minúsculas y sin acentos.
///
/// Espeja `serviceMatchesWorkType` del frontend para que las áreas de pedido
/// (`invoice_items.service`) y de trabajo (`production_batch_items.category`)
/// se agrupen de forma consistente.
pub fn normalize_token(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            other => other,
        })
        .collect()
}

/// Indica si dos tokens de área/servicio se corresponden (igualdad o inclusión).
pub fn area_tokens_match(a: &str, b: &str) -> bool {
    let na = normalize_token(a);
    let nb = normalize_token(b);
    if na.is_empty() || nb.is_empty() {
        return false;
    }
    na == nb || na.contains(&nb) || nb.contains(&na)
}

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
