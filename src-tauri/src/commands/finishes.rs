//! CRUD for the global finishes catalog (Brillo, 3D, Diamantado…).

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinishDto {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub is_system: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFinishPayload {
    pub name: String,
    pub description: Option<String>,
}

/// Lists finishes; optionally only active.
#[tauri::command]
pub fn get_finishes(active_only: Option<bool>) -> Result<Vec<FinishDto>, String> {
    let conn = db::open_connection()?;
    let sql = if active_only.unwrap_or(false) {
        "SELECT id, name, description, is_active, is_system FROM finishes WHERE is_active = 1 ORDER BY name COLLATE NOCASE"
    } else {
        "SELECT id, name, description, is_active, is_system FROM finishes ORDER BY is_active DESC, name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FinishDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i64>(3)? != 0,
                is_system: row.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a custom finish.
#[tauri::command]
pub fn create_finish(name: String, description: Option<String>) -> Result<FinishDto, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let description = description.and_then(|d| {
        let t = d.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    let conn = db::open_connection()?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM finishes WHERE lower(name) = lower(?1)",
            params![name],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("Ya existe un acabado con ese nombre".to_string());
    }
    conn.execute(
        "INSERT INTO finishes (name, description, is_active, is_system) VALUES (?1, ?2, 1, 0)",
        params![name, description],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(FinishDto {
        id,
        name,
        description,
        is_active: true,
        is_system: false,
    })
}

/// Updates a finish name and description (system finishes included).
#[tauri::command]
pub fn update_finish(id: i64, data: UpdateFinishPayload) -> Result<FinishDto, String> {
    let name = data.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let description = data.description.and_then(|d| {
        let t = d.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    let conn = db::open_connection()?;
    let dup: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM finishes WHERE lower(name) = lower(?1) AND id <> ?2",
            params![name, id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if dup > 0 {
        return Err("Ya existe un acabado con ese nombre".to_string());
    }
    let updated = conn
        .execute(
            "UPDATE finishes SET name = ?1, description = ?2 WHERE id = ?3",
            params![name, description, id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Acabado no encontrado".to_string());
    }
    // Keep category_finishes.finish snapshot in sync for linked rows.
    conn.execute(
        "UPDATE category_finishes SET finish = ?1 WHERE finish_id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, description, is_active, is_system FROM finishes WHERE id = ?1",
        params![id],
        |row| {
            Ok(FinishDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i64>(3)? != 0,
                is_system: row.get::<_, i64>(4)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Deactivates a finish (hidden from new category links and order options).
#[tauri::command]
pub fn deactivate_finish(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute("UPDATE finishes SET is_active = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Acabado no encontrado".to_string());
    }
    Ok(())
}

/// Reactivates a deactivated finish.
#[tauri::command]
pub fn reactivate_finish(id: i64) -> Result<FinishDto, String> {
    let conn = db::open_connection()?;
    conn.execute("UPDATE finishes SET is_active = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, description, is_active, is_system FROM finishes WHERE id = ?1",
        params![id],
        |row| {
            Ok(FinishDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i64>(3)? != 0,
                is_system: row.get::<_, i64>(4)? != 0,
            })
        },
    )
    .map_err(|_| "Acabado no encontrado".to_string())
}
