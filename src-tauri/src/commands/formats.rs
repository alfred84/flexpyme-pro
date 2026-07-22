//! CRUD for print formats catalog.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatDto {
    pub id: i64,
    pub label: String,
    pub width_inches: Option<f64>,
    pub height_inches: Option<f64>,
    pub is_active: bool,
    pub is_system: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFormatPayload {
    pub label: String,
    pub width_inches: f64,
    pub height_inches: f64,
}

/// Lists formats; optionally only active. «Sin formato» appears first.
#[tauri::command]
pub fn get_formats(active_only: Option<bool>) -> Result<Vec<FormatDto>, String> {
    let conn = db::open_connection()?;
    let sql = if active_only.unwrap_or(false) {
        "SELECT id, label, width_inches, height_inches, is_active, is_system FROM formats
         WHERE is_active = 1
         ORDER BY CASE WHEN lower(label) = lower('Sin formato') THEN 0 ELSE 1 END, label COLLATE NOCASE"
    } else {
        "SELECT id, label, width_inches, height_inches, is_active, is_system FROM formats
         ORDER BY is_active DESC,
           CASE WHEN lower(label) = lower('Sin formato') THEN 0 ELSE 1 END,
           label COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FormatDto {
                id: row.get(0)?,
                label: row.get(1)?,
                width_inches: row.get(2)?,
                height_inches: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
                is_system: row.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a custom format (dimensions must be greater than zero).
#[tauri::command]
pub fn create_format(label: String, width: f64, height: f64) -> Result<FormatDto, String> {
    let label = label.trim().to_string();
    if label.is_empty() || width <= 0.0 || height <= 0.0 {
        return Err("Etiqueta y dimensiones deben ser válidas (mayores que cero)".to_string());
    }
    if label.eq_ignore_ascii_case("Sin formato") {
        return Err("«Sin formato» es un formato base del sistema".to_string());
    }
    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO formats (label, width_inches, height_inches, is_active, is_system) VALUES (?1, ?2, ?3, 1, 0)",
        params![label, width, height],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe ese formato".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    Ok(FormatDto {
        id,
        label,
        width_inches: Some(width),
        height_inches: Some(height),
        is_active: true,
        is_system: false,
    })
}

/// Updates a format label and dimensions (system formats included; history uses snapshots).
/// «Sin formato» may keep 0×0; other formats require dimensions > 0.
#[tauri::command]
pub fn update_format(id: i64, data: UpdateFormatPayload) -> Result<FormatDto, String> {
    let label = data.label.trim().to_string();
    if label.is_empty() {
        return Err("La etiqueta es obligatoria".to_string());
    }
    if data.width_inches < 0.0 || data.height_inches < 0.0 {
        return Err("Las dimensiones no pueden ser negativas".to_string());
    }
    let conn = db::open_connection()?;
    let (old_label, is_system): (String, i64) = conn
        .query_row(
            "SELECT label, is_system FROM formats WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Formato no encontrado".to_string())?;
    let is_sin_formato = old_label.eq_ignore_ascii_case("Sin formato") && is_system != 0;
    if is_sin_formato && !label.eq_ignore_ascii_case("Sin formato") {
        return Err("No se puede renombrar el formato base «Sin formato»".to_string());
    }
    if !is_sin_formato && (data.width_inches <= 0.0 || data.height_inches <= 0.0) {
        return Err("Etiqueta y dimensiones deben ser válidas (mayores que cero)".to_string());
    }
    let updated = conn
        .execute(
            "UPDATE formats SET label = ?1, width_inches = ?2, height_inches = ?3 WHERE id = ?4",
            params![label, data.width_inches, data.height_inches, id],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                "Ya existe un formato con esa etiqueta".to_string()
            } else {
                e.to_string()
            }
        })?;
    if updated == 0 {
        return Err("Formato no encontrado".to_string());
    }
    conn.query_row(
        "SELECT id, label, width_inches, height_inches, is_active, is_system FROM formats WHERE id = ?1",
        params![id],
        |row| {
            Ok(FormatDto {
                id: row.get(0)?,
                label: row.get(1)?,
                width_inches: row.get(2)?,
                height_inches: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
                is_system: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Deactivates a non-system format.
#[tauri::command]
pub fn deactivate_format(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let is_system: i64 = conn
        .query_row("SELECT is_system FROM formats WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|_| "Formato no encontrado".to_string())?;
    if is_system != 0 {
        return Err("Los formatos del sistema no se pueden desactivar".to_string());
    }
    conn.execute("UPDATE formats SET is_active = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Reactivates a deactivated non-system format.
#[tauri::command]
pub fn reactivate_format(id: i64) -> Result<FormatDto, String> {
    let conn = db::open_connection()?;
    conn.execute("UPDATE formats SET is_active = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, label, width_inches, height_inches, is_active, is_system FROM formats WHERE id = ?1",
        params![id],
        |row| {
            Ok(FormatDto {
                id: row.get(0)?,
                label: row.get(1)?,
                width_inches: row.get(2)?,
                height_inches: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
                is_system: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .map_err(|_| "Formato no encontrado".to_string())
}
