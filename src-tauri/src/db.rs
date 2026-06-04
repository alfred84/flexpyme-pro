//! Shared database configuration helpers.
//!
//! - **Debug (`tauri dev`)**: la BD sigue en `<repo>/.local/flexpyme.db` para alinear con `pnpm db:migrate`.
//! - **Release**: la BD vive en el directorio local de datos de la app (p. ej. `%LOCALAPPDATA%\\com.flexpyme.pro\\`
//!   en Windows), estable sin depender del cwd del proceso.

use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

use rusqlite::{params, Connection};
use serde_json::Value;
use tauri::{AppHandle, Manager};

/// Canonical SQLite database file used by desktop runtime and scripts (solo perfil debug / workspace).
pub const SQLITE_DB_PATH: &str = ".local/flexpyme.db";

static RELEASE_DB_PATH: OnceLock<PathBuf> = OnceLock::new();
static CUSTOM_DB_PATH: OnceLock<PathBuf> = OnceLock::new();

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

fn read_db_path_from_config_file(config_file: &PathBuf) -> Option<PathBuf> {
    let content = fs::read_to_string(config_file).ok()?;
    let json: Value = serde_json::from_str(&content).ok()?;
    let path_str = json.get("db_path")?.as_str()?;
    let custom = PathBuf::from(path_str);
    if custom.exists() {
        Some(custom)
    } else {
        None
    }
}

/// Loads custom DB path from `db_location.json` if present (app config or workspace `.local`).
pub fn init_db_path_from_app(app: &AppHandle) -> Result<(), String> {
    if CUSTOM_DB_PATH.get().is_some() {
        return Ok(());
    }
    if let Ok(config_dir) = app.path().app_config_dir() {
        let config_file = config_dir.join("db_location.json");
        if let Some(path) = read_db_path_from_config_file(&config_file) {
            let _ = CUSTOM_DB_PATH.set(path);
            return Ok(());
        }
    }
    #[cfg(debug_assertions)]
    {
        let local_config = workspace_root_dir()?.join(".local/db_location.json");
        if let Some(path) = read_db_path_from_config_file(&local_config) {
            let _ = CUSTOM_DB_PATH.set(path);
        }
    }
    Ok(())
}

/// Resolves the database path for Tauri commands that have an app handle.
pub fn get_db_path(app: &AppHandle) -> PathBuf {
    if let Some(path) = CUSTOM_DB_PATH.get() {
        return path.clone();
    }
    let _ = init_db_path_from_app(app);
    if let Some(path) = CUSTOM_DB_PATH.get() {
        return path.clone();
    }
    resolve_db_path().unwrap_or_else(|_| PathBuf::from(SQLITE_DB_PATH))
}

/// Resolves the canonical SQLite path to an absolute path.
pub fn resolve_db_path() -> Result<PathBuf, String> {
    if let Some(path) = CUSTOM_DB_PATH.get() {
        return Ok(path.clone());
    }
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

/// Persists a new database location and switches the active connection path.
pub fn move_database_to(app: &AppHandle, new_path: String) -> Result<String, String> {
    let source = resolve_db_path()?;
    let dest = PathBuf::from(new_path.trim());
    if dest == source {
        return Ok(dest.to_string_lossy().to_string());
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&source, &dest).map_err(|e| format!("No se pudo copiar la base de datos: {}", e))?;
    let verify = Connection::open(&dest).map_err(|e| format!("Copia inválida: {}", e))?;
    let _: i64 = verify
        .query_row("SELECT COUNT(*) FROM sqlite_master", [], |row| row.get(0))
        .map_err(|e| format!("Copia inválida: {}", e))?;
    drop(verify);

    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_file = config_dir.join("db_location.json");
    let json = serde_json::json!({ "db_path": dest.to_string_lossy() });
    fs::write(&config_file, serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    #[cfg(debug_assertions)]
    {
        let local_config = workspace_root_dir()?.join(".local/db_location.json");
        if let Some(parent) = local_config.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&local_config, serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    }

    let _ = CUSTOM_DB_PATH.set(dest.clone());
    fs::remove_file(&source).ok();
    Ok(dest.to_string_lossy().to_string())
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
