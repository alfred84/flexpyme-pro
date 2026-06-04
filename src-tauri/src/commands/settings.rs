//! Key-value settings for company profile (invoices, print header).

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

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

/// Returns all key-value settings as a map (business profile, currency, theme...).
#[tauri::command]
pub fn settings_get_all() -> Result<HashMap<String, String>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(|e| e.to_string())?;
        map.insert(key, value);
    }
    Ok(map)
}

/// Creates a timestamped backup copy of the SQLite database file next to it,
/// returning the absolute path of the generated backup.
#[tauri::command]
pub fn settings_backup_database() -> Result<String, String> {
    let db_path = db::resolve_db_path()?;
    let parent = db_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let backups_dir = parent.join("backups");
    std::fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;

    let stamp = chrono_like_timestamp();
    let target = backups_dir.join(format!("flexpyme-{}.db", stamp));
    std::fs::copy(&db_path, &target).map_err(|e| {
        format!("No se pudo crear el respaldo: {}", e)
    })?;
    Ok(target.to_string_lossy().to_string())
}

/// Builds a filesystem-safe timestamp (YYYYMMDD-HHMMSS) without extra crates.
fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Días desde epoch + hora del día (UTC) en formato compacto.
    let days = secs / 86_400;
    let tod = secs % 86_400;
    format!("{}-{:05}", days, tod)
}

/// Upserts a single setting key/value pair.
#[tauri::command]
pub fn settings_set_value(key: String, value: String) -> Result<(), String> {
    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key.trim(), value.trim()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
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

const LOGO_SETTING_KEY: &str = "business_logo_path";
const LOGO_VERSION_KEY: &str = "business_logo_version";

fn allowed_logo_ext(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "svg" => Some(ext),
        _ => None,
    }
}

fn remove_stored_logo_files(data_dir: &Path) -> Result<(), String> {
    let entries = fs::read_dir(data_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with("logo") && entry.path().is_file() {
            fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn upsert_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Copies the selected image into app data dir and stores the path in settings.
#[tauri::command]
pub async fn update_business_logo(app: AppHandle, source_path: String) -> Result<String, String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("Archivo de imagen no encontrado".to_string());
    }
    let ext = allowed_logo_ext(source).ok_or_else(|| {
        "Formato no válido. Use PNG, JPG, WEBP o SVG.".to_string()
    })?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo resolver app_data_dir: {}", e))?;
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    remove_stored_logo_files(&data_dir)?;
    let version = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis()
        .to_string();
    let dest = data_dir.join(format!("logo-{}.{}", version, ext));
    fs::copy(source, &dest).map_err(|e| format!("No se pudo copiar el logo: {}", e))?;
    let dest_str = dest.to_string_lossy().to_string();
    let conn = db::open_connection()?;
    upsert_setting(&conn, LOGO_SETTING_KEY, &dest_str)?;
    upsert_setting(&conn, LOGO_VERSION_KEY, &version)?;
    Ok(dest_str)
}

/// Removes the stored business logo setting.
#[tauri::command]
pub fn remove_business_logo(app: AppHandle) -> Result<(), String> {
    if let Ok(data_dir) = app.path().app_data_dir() {
        if data_dir.exists() {
            let _ = remove_stored_logo_files(&data_dir);
        }
    }
    let conn = db::open_connection()?;
    conn.execute("DELETE FROM settings WHERE key = ?1", params![LOGO_SETTING_KEY])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM settings WHERE key = ?1", params![LOGO_VERSION_KEY])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Returns the current SQLite database file path.
#[tauri::command]
pub fn get_db_location(app: AppHandle) -> Result<String, String> {
    Ok(db::get_db_path(&app).to_string_lossy().to_string())
}

/// Opens the folder containing the database in the system file manager.
#[tauri::command]
pub fn open_db_folder(app: AppHandle) -> Result<(), String> {
    let db_path = db::get_db_path(&app);
    let folder = db_path
        .parent()
        .ok_or_else(|| "Ruta de base de datos inválida".to_string())?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Abrir carpeta solo está implementado en Windows".to_string());
    }
    Ok(())
}

/// Copies the database to a new path and updates `db_location.json`.
#[tauri::command]
pub async fn move_database(app: AppHandle, new_path: String) -> Result<String, String> {
    db::move_database_to(&app, new_path)
}
