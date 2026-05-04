//! Key-value settings for company profile (invoices, print header).

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompanySettingsDto {
    pub company_name: String,
    pub company_rnc: String,
    pub company_phone: String,
    pub company_address: String,
}

fn read_setting(conn: &rusqlite::Connection, key: &str) -> String {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .unwrap_or_default()
}

/// Loads company block used on printed invoices.
#[tauri::command]
pub fn settings_get_company() -> Result<CompanySettingsDto, String> {
    let conn = db::open_connection()?;
    Ok(CompanySettingsDto {
        company_name: read_setting(&conn, "company_name"),
        company_rnc: read_setting(&conn, "company_rnc"),
        company_phone: read_setting(&conn, "company_phone"),
        company_address: read_setting(&conn, "company_address"),
    })
}

/// Persists company profile keys (upsert).
#[tauri::command]
pub fn settings_save_company(payload: CompanySettingsDto) -> Result<(), String> {
    let conn = db::open_connection()?;
    let pairs = [
        ("company_name", payload.company_name.trim()),
        ("company_rnc", payload.company_rnc.trim()),
        ("company_phone", payload.company_phone.trim()),
        ("company_address", payload.company_address.trim()),
    ];
    for (key, value) in pairs {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
