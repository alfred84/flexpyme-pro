//! CRUD for work types used in production batches.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTypeDto {
    pub id: i64,
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub is_system: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkTypePayload {
    pub name: String,
    pub description: Option<String>,
}

fn slugify(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .replace(' ', "_")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect()
}

/// Lists work types.
#[tauri::command]
pub fn get_work_types(active_only: Option<bool>) -> Result<Vec<WorkTypeDto>, String> {
    let conn = db::open_connection()?;
    let sql = if active_only.unwrap_or(false) {
        "SELECT id, name, code, description, is_active, is_system FROM work_types WHERE is_active = 1 ORDER BY name"
    } else {
        "SELECT id, name, code, description, is_active, is_system FROM work_types ORDER BY is_active DESC, name"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(WorkTypeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                description: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
                is_system: row.get::<_, i64>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a custom work type.
#[tauri::command]
pub fn create_work_type(name: String, description: Option<String>) -> Result<WorkTypeDto, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let code = slugify(&name);
    if code.is_empty() {
        return Err("El nombre no genera un código válido".to_string());
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
    conn.execute(
        "INSERT INTO work_types (name, code, description, is_active, is_system) VALUES (?1, ?2, ?3, 1, 0)",
        params![name, code, description],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe un tipo de trabajo con ese nombre o código".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    Ok(WorkTypeDto {
        id,
        name,
        code,
        description,
        is_active: true,
        is_system: false,
    })
}

/// Updates a work type name and description (system types included; `code` stays immutable).
#[tauri::command]
pub fn update_work_type(id: i64, data: UpdateWorkTypePayload) -> Result<WorkTypeDto, String> {
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
    let updated = conn
        .execute(
            "UPDATE work_types SET name = ?1, description = ?2 WHERE id = ?3",
            params![name, description, id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Tipo no encontrado".to_string());
    }
    conn.query_row(
        "SELECT id, name, code, description, is_active, is_system FROM work_types WHERE id = ?1",
        params![id],
        |row| {
            Ok(WorkTypeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                description: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
                is_system: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Deactivates a work type (hidden from new category links and order options).
#[tauri::command]
pub fn deactivate_work_type(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute("UPDATE work_types SET is_active = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Tipo no encontrado".to_string());
    }
    Ok(())
}

/// Reactivates a deactivated work type.
#[tauri::command]
pub fn reactivate_work_type(id: i64) -> Result<WorkTypeDto, String> {
    let conn = db::open_connection()?;
    conn.execute("UPDATE work_types SET is_active = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, code, description, is_active, is_system FROM work_types WHERE id = ?1",
        params![id],
        |row| {
            Ok(WorkTypeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                description: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
                is_system: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .map_err(|_| "Tipo no encontrado".to_string())
}
