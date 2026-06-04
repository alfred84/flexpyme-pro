//! CRUD for configurable employee roles.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Employee role row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeRoleDto {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRolePayload {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRolePayload {
    pub name: String,
    pub description: Option<String>,
}

fn trim_opt(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

/// Lists employee roles; optionally only active ones.
#[tauri::command]
pub fn get_employee_roles(active_only: Option<bool>) -> Result<Vec<EmployeeRoleDto>, String> {
    let conn = db::open_connection()?;
    let only = active_only.unwrap_or(false);
    let sql = if only {
        "SELECT id, name, description, is_active FROM employee_roles WHERE is_active = 1 ORDER BY name COLLATE NOCASE"
    } else {
        "SELECT id, name, description, is_active FROM employee_roles ORDER BY is_active DESC, name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(EmployeeRoleDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i64>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a new employee role.
#[tauri::command]
pub fn create_employee_role(payload: CreateRolePayload) -> Result<EmployeeRoleDto, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre del rol es obligatorio".to_string());
    }
    let description = trim_opt(payload.description);
    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO employee_roles (name, description, is_active, updated_at) VALUES (?1, ?2, 1, datetime('now'))",
        params![name, description],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe un rol con ese nombre".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    Ok(EmployeeRoleDto {
        id,
        name,
        description,
        is_active: true,
    })
}

/// Updates role name and description.
#[tauri::command]
pub fn update_employee_role(id: i64, payload: UpdateRolePayload) -> Result<EmployeeRoleDto, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre del rol es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE employee_roles SET name = ?1, description = ?2, updated_at = datetime('now') WHERE id = ?3",
            params![name, trim_opt(payload.description), id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Rol no encontrado".to_string());
    }
    conn.query_row(
        "SELECT id, name, description, is_active FROM employee_roles WHERE id = ?1",
        params![id],
        |row| {
            Ok(EmployeeRoleDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i64>(3)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Deactivates a role if no active employees are assigned.
#[tauri::command]
pub fn deactivate_employee_role(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let active_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM employees WHERE role_id = ?1 AND is_active = 1 AND deleted_at IS NULL",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if active_count > 0 {
        return Err(format!(
            "Este rol tiene {} empleado(s) activo(s). Reasigna sus roles antes de desactivarlo.",
            active_count
        ));
    }
    let updated = conn
        .execute(
            "UPDATE employee_roles SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Rol no encontrado".to_string());
    }
    Ok(())
}
