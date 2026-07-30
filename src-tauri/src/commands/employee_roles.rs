//! CRUD for configurable employee roles and their work-type associations.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::db;

/// Employee role row with associated work type ids.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeRoleDto {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    /// Tipos de trabajo que este rol puede realizar.
    pub work_type_ids: Vec<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRolePayload {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub work_type_ids: Vec<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRolePayload {
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub work_type_ids: Vec<i64>,
}

/// Empleado elegible para un tipo de trabajo.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeForWorkTypeDto {
    pub id: i64,
    pub name: String,
    pub role_id: Option<i64>,
    pub role: Option<String>,
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

fn load_role_work_type_ids(conn: &Connection, role_id: i64) -> Result<Vec<i64>, String> {
    let mut stmt = conn
        .prepare("SELECT work_type_id FROM role_work_types WHERE role_id = ?1 ORDER BY work_type_id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![role_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn sync_role_work_types(
    conn: &Connection,
    role_id: i64,
    work_type_ids: &[i64],
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM role_work_types WHERE role_id = ?1",
        params![role_id],
    )
    .map_err(|e| e.to_string())?;
    let mut unique = work_type_ids.to_vec();
    unique.sort_unstable();
    unique.dedup();
    for wt_id in unique {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM work_types WHERE id = ?1 AND is_active = 1",
                params![wt_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err(format!("Tipo de trabajo {} no encontrado o inactivo", wt_id));
        }
        conn.execute(
            "INSERT INTO role_work_types (role_id, work_type_id) VALUES (?1, ?2)",
            params![role_id, wt_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn map_role_row(
    conn: &Connection,
    id: i64,
    name: String,
    description: Option<String>,
    is_active: bool,
) -> Result<EmployeeRoleDto, String> {
    Ok(EmployeeRoleDto {
        id,
        name,
        description,
        is_active,
        work_type_ids: load_role_work_type_ids(conn, id)?,
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
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i64>(3)? != 0,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        let (id, name, description, is_active) = row.map_err(|e| e.to_string())?;
        result.push(map_role_row(&conn, id, name, description, is_active)?);
    }
    Ok(result)
}

/// Creates a new employee role with optional work types.
#[tauri::command]
pub fn create_employee_role(payload: CreateRolePayload) -> Result<EmployeeRoleDto, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre del rol es obligatorio".to_string());
    }
    let description = trim_opt(payload.description);
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
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
    let id = tx.last_insert_rowid();
    sync_role_work_types(&tx, id, &payload.work_type_ids)?;
    tx.commit().map_err(|e| e.to_string())?;
    let conn = db::open_connection()?;
    map_role_row(&conn, id, name, description, true)
}

/// Updates role name, description and work types.
#[tauri::command]
pub fn update_employee_role(id: i64, payload: UpdateRolePayload) -> Result<EmployeeRoleDto, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre del rol es obligatorio".to_string());
    }
    let description = trim_opt(payload.description);
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let updated = tx
        .execute(
            "UPDATE employee_roles SET name = ?1, description = ?2, updated_at = datetime('now') WHERE id = ?3",
            params![name, description, id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Rol no encontrado".to_string());
    }
    sync_role_work_types(&tx, id, &payload.work_type_ids)?;
    tx.commit().map_err(|e| e.to_string())?;
    let conn = db::open_connection()?;
    let is_active: bool = conn
        .query_row(
            "SELECT is_active FROM employee_roles WHERE id = ?1",
            params![id],
            |row| Ok(row.get::<_, i64>(0)? != 0),
        )
        .map_err(|e| e.to_string())?;
    map_role_row(&conn, id, name, description, is_active)
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

/// Reactivates a deactivated employee role.
#[tauri::command]
pub fn reactivate_employee_role(id: i64) -> Result<EmployeeRoleDto, String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE employee_roles SET is_active = 1, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Rol no encontrado".to_string());
    }
    conn.query_row(
        "SELECT id, name, description, is_active FROM employee_roles WHERE id = ?1",
        params![id],
        |row| {
            let id = row.get(0)?;
            let name: String = row.get(1)?;
            let description: Option<String> = row.get(2)?;
            let is_active = row.get::<_, i64>(3)? != 0;
            Ok((id, name, description, is_active))
        },
    )
    .map_err(|e| e.to_string())
    .and_then(|(id, name, description, is_active)| {
        map_role_row(&conn, id, name, description, is_active)
    })
}

/// Lists active employees whose primary or secondary role includes the work type.
#[tauri::command]
pub fn employees_for_work_type(work_type_id: i64) -> Result<Vec<EmployeeForWorkTypeDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT e.id, e.name, e.role_id,
                    COALESCE(e.role_snapshot, er.name, e.role) AS role_label
             FROM employees e
             LEFT JOIN employee_roles er ON er.id = e.role_id
             WHERE e.is_active = 1 AND e.deleted_at IS NULL
               AND (
                 EXISTS (
                   SELECT 1 FROM role_work_types rwt
                   WHERE rwt.role_id = e.role_id AND rwt.work_type_id = ?1
                 )
                 OR EXISTS (
                   SELECT 1 FROM employee_extra_roles eer
                   JOIN role_work_types rwt2 ON rwt2.role_id = eer.role_id
                   WHERE eer.employee_id = e.id AND rwt2.work_type_id = ?1
                 )
               )
             ORDER BY e.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![work_type_id], |row| {
            Ok(EmployeeForWorkTypeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                role_id: row.get(2)?,
                role: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Resolves work type by id or by name/code matching (for order line service labels).
#[tauri::command]
pub fn employees_for_work_type_name(
    work_type_name: String,
) -> Result<Vec<EmployeeForWorkTypeDto>, String> {
    let name = work_type_name.trim().to_string();
    if name.is_empty() {
        return Ok(vec![]);
    }
    let conn = db::open_connection()?;
    let work_type_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM work_types
             WHERE is_active = 1
               AND (lower(name) = lower(?1) OR lower(code) = lower(?1))
             LIMIT 1",
            params![name],
            |row| row.get(0),
        )
        .ok();
    match work_type_id {
        Some(id) => employees_for_work_type(id),
        None => Ok(vec![]),
    }
}
