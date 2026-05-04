//! Client CRUD commands backed by SQLite via rusqlite.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Client row returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientDto {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub balance: f64,
    pub created_at: String,
    pub updated_at: String,
}

/// Payload for creating a client.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateClientPayload {
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

/// Payload for updating a client.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClientPayload {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

fn trim_or_empty(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

/// Lists active clients ordered by most recently created first.
#[tauri::command]
pub fn clients_list() -> Result<Vec<ClientDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, code, name, phone, address, notes, balance, created_at, updated_at
             FROM clients
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ClientDto {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                phone: row.get(3)?,
                address: row.get(4)?,
                notes: row.get(5)?,
                balance: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// Loads a single active client by id.
#[tauri::command]
pub fn clients_get_by_id(id: i64) -> Result<ClientDto, String> {
    let conn = db::open_connection()?;
    conn.query_row(
        "SELECT id, code, name, phone, address, notes, balance, created_at, updated_at
         FROM clients
         WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |row| {
            Ok(ClientDto {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                phone: row.get(3)?,
                address: row.get(4)?,
                notes: row.get(5)?,
                balance: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|_| "Cliente no encontrado".to_string())
}

/// Creates a new client row.
#[tauri::command]
pub fn clients_create(payload: CreateClientPayload) -> Result<i64, String> {
    let code = trim_or_empty(&payload.code);
    let name = trim_or_empty(&payload.name);
    if code.is_empty() {
        return Err("El codigo es obligatorio".to_string());
    }
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let phone = normalize_optional(payload.phone);
    let address = normalize_optional(payload.address);
    let notes = normalize_optional(payload.notes);

    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO clients (code, name, phone, address, notes, balance, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, datetime('now'))",
        params![code, name, phone, address, notes],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe un cliente con ese codigo o combinacion nombre/codigo".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok(conn.last_insert_rowid())
}

/// Updates an existing active client.
#[tauri::command]
pub fn clients_update(payload: UpdateClientPayload) -> Result<(), String> {
    let code = trim_or_empty(&payload.code);
    let name = trim_or_empty(&payload.name);
    if code.is_empty() {
        return Err("El codigo es obligatorio".to_string());
    }
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let phone = normalize_optional(payload.phone);
    let address = normalize_optional(payload.address);
    let notes = normalize_optional(payload.notes);

    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE clients
             SET code = ?1, name = ?2, phone = ?3, address = ?4, notes = ?5, updated_at = datetime('now')
             WHERE id = ?6 AND deleted_at IS NULL",
            params![code, name, phone, address, notes, payload.id],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                "Ya existe un cliente con ese codigo o combinacion nombre/codigo".to_string()
            } else {
                e.to_string()
            }
        })?;

    if updated == 0 {
        return Err("Cliente no encontrado".to_string());
    }
    Ok(())
}

/// Soft-deletes a client by setting deleted_at.
#[tauri::command]
pub fn clients_soft_delete(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE clients SET deleted_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Cliente no encontrado".to_string());
    }
    Ok(())
}
