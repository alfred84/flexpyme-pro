//! CRUD for configurable expense types (Otros gastos module).

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Expense type catalog row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseTypeDto {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
    pub sort_order: i64,
}

/// Payload for creating an expense type.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExpenseTypePayload {
    pub name: String,
}

/// Payload for renaming an expense type.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExpenseTypePayload {
    pub name: String,
}

fn load_expense_type(conn: &rusqlite::Connection, id: i64) -> Result<ExpenseTypeDto, String> {
    conn.query_row(
        "SELECT id, name, is_active, sort_order FROM expense_types WHERE id = ?1",
        params![id],
        |row| {
            Ok(ExpenseTypeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                is_active: row.get::<_, i64>(2)? != 0,
                sort_order: row.get(3)?,
            })
        },
    )
    .map_err(|_| "Tipo de gasto no encontrado".to_string())
}

/// Lists expense types; optionally only active ones (for the expense form select).
#[tauri::command]
pub fn expense_types_list(active_only: Option<bool>) -> Result<Vec<ExpenseTypeDto>, String> {
    let conn = db::open_connection()?;
    let only = active_only.unwrap_or(false);
    let sql = if only {
        "SELECT id, name, is_active, sort_order FROM expense_types
         WHERE is_active = 1
         ORDER BY sort_order, name COLLATE NOCASE"
    } else {
        "SELECT id, name, is_active, sort_order FROM expense_types
         ORDER BY is_active DESC, sort_order, name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ExpenseTypeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                is_active: row.get::<_, i64>(2)? != 0,
                sort_order: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Creates a new active expense type.
#[tauri::command]
pub fn expense_type_create(payload: CreateExpenseTypePayload) -> Result<ExpenseTypeDto, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre del tipo es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let next_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM expense_types WHERE sort_order < 99",
            [],
            |row| row.get(0),
        )
        .unwrap_or(1);
    conn.execute(
        "INSERT INTO expense_types (name, is_active, sort_order, updated_at)
         VALUES (?1, 1, ?2, datetime('now'))",
        params![name, next_order],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe un tipo de gasto con ese nombre".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    load_expense_type(&conn, id)
}

/// Renames an expense type. Historical expenses keep their snapshot name.
#[tauri::command]
pub fn expense_type_update(
    id: i64,
    payload: UpdateExpenseTypePayload,
) -> Result<ExpenseTypeDto, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre del tipo es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE expense_types SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![name, id],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                "Ya existe un tipo de gasto con ese nombre".to_string()
            } else {
                e.to_string()
            }
        })?;
    if updated == 0 {
        return Err("Tipo de gasto no encontrado".to_string());
    }
    load_expense_type(&conn, id)
}

/// Deactivates an expense type (hidden from the form select).
#[tauri::command]
pub fn expense_type_deactivate(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE expense_types SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Tipo de gasto no encontrado".to_string());
    }
    Ok(())
}

/// Reactivates a previously deactivated expense type.
#[tauri::command]
pub fn expense_type_reactivate(id: i64) -> Result<ExpenseTypeDto, String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE expense_types SET is_active = 1, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Tipo de gasto no encontrado".to_string());
    }
    load_expense_type(&conn, id)
}
