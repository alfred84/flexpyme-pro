//! Key-value settings for company profile (invoices, print header).

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfoDto {
    pub file_name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
    pub kind: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupOverviewDto {
    pub db_path: String,
    pub backup_dir: String,
    pub interval_days: i64,
    pub last_scheduled_backup_at: Option<String>,
    pub backups: Vec<BackupInfoDto>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RestoreDatabaseDto {
    pub restored_path: String,
    pub safety_backup_path: String,
}

const BACKUP_INTERVAL_DAYS_KEY: &str = "backup_interval_days";
const LAST_SCHEDULED_BACKUP_AT_KEY: &str = "last_scheduled_backup_at";
const USD_EXCHANGE_RATE_KEY: &str = "usd_exchange_rate";
const DEFAULT_BACKUP_INTERVAL_DAYS: i64 = 5;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeRateHistoryDto {
    pub id: i64,
    pub rate: f64,
    pub effective_at: String,
    pub source: String,
    pub previous_rate: Option<f64>,
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
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(|e| e.to_string())?;
        map.insert(key, value);
    }
    Ok(map)
}

fn unix_now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn unix_secs_from_system_time(value: SystemTime) -> u64 {
    value
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn civil_from_days(days_since_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if month <= 2 { 1 } else { 0 };
    (year as i32, month as u32, day as u32)
}

fn utc_parts_from_unix_secs(secs: u64) -> (i32, u32, u32, u32, u32, u32) {
    let days = (secs / 86_400) as i64;
    let seconds_of_day = secs % 86_400;
    let (year, month, day) = civil_from_days(days);
    let hour = (seconds_of_day / 3_600) as u32;
    let minute = ((seconds_of_day % 3_600) / 60) as u32;
    let second = (seconds_of_day % 60) as u32;
    (year, month, day, hour, minute, second)
}

fn backup_timestamp() -> String {
    let (year, month, day, hour, minute, second) = utc_parts_from_unix_secs(unix_now_secs());
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        year, month, day, hour, minute, second
    )
}

fn iso_utc_from_unix_secs(secs: u64) -> String {
    let (year, month, day, hour, minute, second) = utc_parts_from_unix_secs(secs);
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02} UTC",
        year, month, day, hour, minute, second
    )
}

fn backup_dir_for_db(db_path: &Path) -> PathBuf {
    db_path
        .parent()
        .map(|p| p.join("backups"))
        .unwrap_or_else(|| PathBuf::from("backups"))
}

fn normalize_backup_interval(value: i64) -> i64 {
    value.clamp(1, 365)
}

fn backup_interval_days(conn: &rusqlite::Connection) -> i64 {
    let stored = read_setting(conn, BACKUP_INTERVAL_DAYS_KEY);
    let parsed = stored
        .parse::<i64>()
        .unwrap_or(DEFAULT_BACKUP_INTERVAL_DAYS);
    normalize_backup_interval(parsed)
}

fn last_scheduled_backup_at(conn: &rusqlite::Connection) -> Option<u64> {
    read_setting(conn, LAST_SCHEDULED_BACKUP_AT_KEY)
        .parse::<u64>()
        .ok()
}

fn backup_kind_from_name(file_name: &str) -> String {
    if file_name.contains("scheduled") {
        "programado".to_string()
    } else if file_name.contains("pre-restore") {
        "pre-restauración".to_string()
    } else {
        "manual".to_string()
    }
}

fn backup_info_from_path(path: PathBuf) -> Option<(BackupInfoDto, u64)> {
    let metadata = fs::metadata(&path).ok()?;
    if !metadata.is_file() {
        return None;
    }
    let file_name = path.file_name()?.to_string_lossy().to_string();
    if !file_name.ends_with(".db") || !file_name.starts_with("flexpyme-backup-") {
        return None;
    }
    let modified = metadata
        .modified()
        .ok()
        .map(unix_secs_from_system_time)
        .unwrap_or(0);
    Some((
        BackupInfoDto {
            file_name: file_name.clone(),
            path: path.to_string_lossy().to_string(),
            created_at: iso_utc_from_unix_secs(modified),
            size_bytes: metadata.len(),
            kind: backup_kind_from_name(&file_name),
        },
        modified,
    ))
}

fn list_recent_backups() -> Result<Vec<BackupInfoDto>, String> {
    let db_path = db::resolve_db_path()?;
    let backups_dir = backup_dir_for_db(&db_path);
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    let mut entries = fs::read_dir(&backups_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| backup_info_from_path(entry.path()))
        .collect::<Vec<_>>();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    Ok(entries.into_iter().take(5).map(|entry| entry.0).collect())
}

fn create_backup(kind: &str) -> Result<PathBuf, String> {
    let db_path = db::resolve_db_path()?;
    if !db_path.exists() {
        return Err("No existe una base de datos activa para respaldar".to_string());
    }
    let backups_dir = backup_dir_for_db(&db_path);
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    let target = backups_dir.join(format!(
        "flexpyme-backup-{}-{}.db",
        kind,
        backup_timestamp()
    ));
    fs::copy(&db_path, &target).map_err(|e| format!("No se pudo crear el respaldo: {}", e))?;
    Ok(target)
}

fn run_scheduled_backup_if_due(
    conn: &rusqlite::Connection,
) -> Result<Option<BackupInfoDto>, String> {
    let interval_days = backup_interval_days(conn);
    let now = unix_now_secs();
    let due = last_scheduled_backup_at(conn)
        .map(|last| now.saturating_sub(last) >= (interval_days as u64) * 86_400)
        .unwrap_or(true);
    if !due {
        return Ok(None);
    }
    let path = create_backup("scheduled")?;
    upsert_setting(conn, LAST_SCHEDULED_BACKUP_AT_KEY, &now.to_string())?;
    Ok(backup_info_from_path(path).map(|entry| entry.0))
}

fn backup_overview(conn: &rusqlite::Connection) -> Result<BackupOverviewDto, String> {
    let db_path = db::resolve_db_path()?;
    let backups_dir = backup_dir_for_db(&db_path);
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    Ok(BackupOverviewDto {
        db_path: db_path.to_string_lossy().to_string(),
        backup_dir: backups_dir.to_string_lossy().to_string(),
        interval_days: backup_interval_days(conn),
        last_scheduled_backup_at: last_scheduled_backup_at(conn).map(iso_utc_from_unix_secs),
        backups: list_recent_backups()?,
    })
}

/// Creates a timestamped manual backup copy of the SQLite database file.
#[tauri::command]
pub fn settings_backup_database() -> Result<String, String> {
    create_backup("manual").map(|path| path.to_string_lossy().to_string())
}

/// Returns backup configuration plus the five most recent backups.
#[tauri::command]
pub fn settings_get_backup_overview() -> Result<BackupOverviewDto, String> {
    let conn = db::open_connection()?;
    let _ = run_scheduled_backup_if_due(&conn)?;
    backup_overview(&conn)
}

/// Persists the automatic backup interval in days.
#[tauri::command]
pub fn settings_set_backup_interval_days(days: i64) -> Result<BackupOverviewDto, String> {
    let conn = db::open_connection()?;
    let normalized = normalize_backup_interval(days);
    upsert_setting(&conn, BACKUP_INTERVAL_DAYS_KEY, &normalized.to_string())?;
    backup_overview(&conn)
}

/// Creates a scheduled backup when the configured interval has elapsed.
#[tauri::command]
pub fn settings_run_scheduled_backup_if_due() -> Result<Option<BackupInfoDto>, String> {
    let conn = db::open_connection()?;
    run_scheduled_backup_if_due(&conn)
}

/// Validates and restores a compatible SQLite database over the active `flexpyme.db`.
#[tauri::command]
pub fn settings_restore_database(source_path: String) -> Result<RestoreDatabaseDto, String> {
    let source = PathBuf::from(source_path.trim());
    db::validate_database_compatibility(&source)?;

    let db_path = db::resolve_db_path()?;
    if fs::canonicalize(&source).ok() == fs::canonicalize(&db_path).ok() {
        return Err("La base seleccionada ya es la base de datos activa".to_string());
    }

    let safety_backup = create_backup("pre-restore")?;
    let temp_path = db_path.with_extension("restore.tmp");
    fs::copy(&source, &temp_path)
        .map_err(|e| format!("No se pudo preparar la restauración: {}", e))?;
    fs::copy(&temp_path, &db_path)
        .map_err(|e| format!("No se pudo reemplazar la base de datos activa: {}", e))?;
    let _ = fs::remove_file(&temp_path);
    db::validate_database_compatibility(&db_path)?;

    Ok(RestoreDatabaseDto {
        restored_path: db_path.to_string_lossy().to_string(),
        safety_backup_path: safety_backup.to_string_lossy().to_string(),
    })
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

/// Updates the USD→CUP exchange rate and records the change in history when it differs.
#[tauri::command]
pub fn settings_set_exchange_rate(rate: f64, source: Option<String>) -> Result<f64, String> {
    if rate <= 0.0 {
        return Err("La tasa debe ser mayor que cero".to_string());
    }
    let source = source.unwrap_or_else(|| "config".to_string());
    let source = source.trim().to_lowercase();
    if source != "header" && source != "config" {
        return Err("Origen de tasa inválido".to_string());
    }

    let conn = db::open_connection()?;
    let previous_str = read_setting(&conn, USD_EXCHANGE_RATE_KEY);
    let previous_rate = previous_str
        .parse::<f64>()
        .ok()
        .filter(|value| *value > 0.0);
    let changed = previous_rate
        .map(|previous| (previous - rate).abs() > 1e-9)
        .unwrap_or(true);

    if changed {
        conn.execute(
            "INSERT INTO exchange_rate_history (rate, effective_at, source, previous_rate)
             VALUES (?1, datetime('now'), ?2, ?3)",
            params![rate, source, previous_rate],
        )
        .map_err(|e| e.to_string())?;
    }

    upsert_setting(&conn, USD_EXCHANGE_RATE_KEY, &rate.to_string())?;
    Ok(rate)
}

/// Lists recent exchange-rate changes (newest first).
#[tauri::command]
pub fn settings_get_exchange_rate_history(
    limit: Option<i64>,
) -> Result<Vec<ExchangeRateHistoryDto>, String> {
    let conn = db::open_connection()?;
    let limit = limit.unwrap_or(50).clamp(1, 200);
    let mut stmt = conn
        .prepare(
            "SELECT id, rate, effective_at, source, previous_rate
             FROM exchange_rate_history
             ORDER BY effective_at DESC, id DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(ExchangeRateHistoryDto {
                id: row.get(0)?,
                rate: row.get(1)?,
                effective_at: row.get(2)?,
                source: row.get(3)?,
                previous_rate: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
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
    let ext = allowed_logo_ext(source)
        .ok_or_else(|| "Formato no válido. Use PNG, JPG, WEBP o SVG.".to_string())?;
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
    conn.execute(
        "DELETE FROM settings WHERE key = ?1",
        params![LOGO_SETTING_KEY],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM settings WHERE key = ?1",
        params![LOGO_VERSION_KEY],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Returns the current SQLite database file path.
#[tauri::command]
pub fn get_db_location() -> Result<String, String> {
    Ok(db::resolve_db_path()?.to_string_lossy().to_string())
}

/// Opens the folder containing the database in the system file manager.
#[tauri::command]
pub fn open_db_folder() -> Result<(), String> {
    let db_path = db::resolve_db_path()?;
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
