//! Shared database configuration helpers.

use std::fs;
use std::path::PathBuf;

use rusqlite::{params, Connection};

/// Canonical SQLite database file used by desktop runtime and scripts.
pub const SQLITE_DB_PATH: &str = ".local/flexpyme.db";

fn workspace_root_dir() -> Result<PathBuf, String> {
    let current = std::env::current_dir().map_err(|err| err.to_string())?;
    if current
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case("src-tauri"))
        .unwrap_or(false)
    {
        current
            .parent()
            .map(|p| p.to_path_buf())
            .ok_or_else(|| "No se pudo resolver la carpeta raiz del workspace".to_string())
    } else {
        Ok(current)
    }
}

/// Resolves the canonical SQLite path to an absolute path.
pub fn resolve_db_path() -> Result<PathBuf, String> {
    Ok(workspace_root_dir()?.join(SQLITE_DB_PATH))
}

fn migrate_legacy_db_if_needed(db_path: &PathBuf) -> Result<(), String> {
    if db_path.exists() {
        return Ok(());
    }

    let root = workspace_root_dir()?;
    let legacy_candidates = [root.join("src-tauri/flexpyme.db"), root.join("src-tauri/src-tauri/flexpyme.db")];
    if let Some(source) = legacy_candidates.iter().find(|p| p.exists()) {
        fs::copy(source, db_path).map_err(|err| {
            format!(
                "No se pudo migrar la base de datos legacy desde {} hacia {}: {}",
                source.to_string_lossy(),
                db_path.to_string_lossy(),
                err
            )
        })?;
    }
    Ok(())
}

/// Opens a shared SQLite connection for Tauri commands.
pub fn open_connection() -> Result<Connection, String> {
    let db_path = resolve_db_path()?;

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    migrate_legacy_db_if_needed(&db_path)?;

    Connection::open(&db_path).map_err(|err| err.to_string())
}

/// Ensures the SQLite file exists (schema is applied by Drizzle migrations / seed).
pub fn ensure_database_ready() -> Result<String, String> {
    let db_path = resolve_db_path()?;
    let conn = open_connection()?;
    let has_clients_table: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            params!["clients"],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if has_clients_table == 0 {
        return Err(format!(
            "Base de datos sin esquema (tabla clients no encontrada): {}",
            db_path.to_string_lossy()
        ));
    }
    Ok(db_path.to_string_lossy().to_string())
}
