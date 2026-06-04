//! Shared database configuration helpers.
//!
//! - **Debug (`tauri dev`)**: la BD sigue en `<repo>/.local/flexpyme.db` para alinear con `pnpm db:migrate`.
//! - **Release**: la BD vive en el directorio local de datos de la app (p. ej. `%LOCALAPPDATA%\\com.flexpyme.pro\\`
//!   en Windows), estable sin depender del cwd del proceso.

use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

use rusqlite::{params, Connection};

/// Canonical SQLite database file used by desktop runtime and scripts (solo perfil debug / workspace).
pub const SQLITE_DB_PATH: &str = ".local/flexpyme.db";

static RELEASE_DB_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Solo release: debe llamarse una vez desde `setup` antes de cualquier acceso a la BD.
pub fn set_release_db_path(path: PathBuf) -> Result<(), String> {
    RELEASE_DB_PATH
        .set(path)
        .map_err(|_| "La ruta de base de datos para release ya fue inicializada".to_string())
}

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
    #[cfg(not(debug_assertions))]
    {
        return RELEASE_DB_PATH.get().cloned().ok_or_else(|| {
            "Base de datos no inicializada (release sin set_release_db_path)".to_string()
        });
    }
    #[cfg(debug_assertions)]
    {
        Ok(workspace_root_dir()?.join(SQLITE_DB_PATH))
    }
}

/// Migración inicial embebida (misma semántica que `src/db/migrations/`).
const EMBEDDED_INITIAL_SCHEMA: &str = include_str!("../migrations/0000_vengeful_cerebro.sql");

/// Migración v2 embebida: empleados, inventario, caja general, costos y columnas nuevas.
/// Mantener alineada con `src/db/migrations/0001_aberrant_talon.sql`.
const EMBEDDED_V2_SCHEMA: &str = include_str!("../migrations/0001_aberrant_talon.sql");

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

/// Crea el archivo si no existe, copia legacy si aplica y aplica el esquema SQL si la BD está vacía.
/// Debe ejecutarse al arrancar la app (desde `setup`), después de `set_release_db_path` en release.
pub fn init_database_schema_if_empty() -> Result<(), String> {
    let db_path = resolve_db_path()?;

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    migrate_legacy_db_if_needed(&db_path)?;

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    if !table_exists(&conn, "clients") {
        conn.execute_batch(EMBEDDED_INITIAL_SCHEMA)
            .map_err(|e| format!("No se pudo aplicar el esquema inicial de SQLite: {}", e))?;
    }

    // Aplica la migración v2 solo si las tablas nuevas aún no existen (instalación v1 -> v2).
    if !table_exists(&conn, "employees") {
        conn.execute_batch(EMBEDDED_V2_SCHEMA)
            .map_err(|e| format!("No se pudo aplicar el esquema v2 de SQLite: {}", e))?;
    }
    Ok(())
}

/// Comprueba si existe una tabla con el nombre dado en la base de datos abierta.
fn table_exists(conn: &Connection, table_name: &str) -> bool {
    conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        params![table_name],
        |row| row.get::<_, i64>(0),
    )
    .map(|count| count > 0)
    .unwrap_or(false)
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
