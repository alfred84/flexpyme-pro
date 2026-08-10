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
    /// Deuda abierta equivalente CUP (espejo contable; suma de `invoices.balance`).
    pub balance: f64,
    /// Deuda abierta en USD (suma de `invoices.balance_usd` de pedidos no anulados).
    pub balance_usd: f64,
    /// Deuda abierta en CUP (parte CUP pendiente, sin restar crédito).
    pub balance_cup: f64,
    pub credit_balance: f64,
    /// Suma de totales CUP de todos los pedidos (legado / equivalente).
    pub total_historical: f64,
    /// Total histórico a cobrar en USD (`Σ due_usd`).
    pub total_historical_usd: f64,
    /// Total histórico a cobrar en CUP (`Σ due_cup`).
    pub total_historical_cup: f64,
    pub created_at: String,
    pub updated_at: String,
}

/// Invoice row for a client's work history panel.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientWorkHistoryRow {
    pub id: i64,
    pub invoice_number: String,
    pub date: String,
    pub total: f64,
    pub total_usd: f64,
    pub paid: f64,
    pub paid_usd: f64,
    pub balance: f64,
    pub balance_usd: f64,
    pub due_usd: f64,
    pub due_cup: f64,
    pub production_status: String,
    pub payment_status: String,
    pub payment_currency: Option<String>,
    pub exchange_rate_snapshot: Option<f64>,
}

/// Work history list and aggregate total for one client.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientWorkHistoryDto {
    pub invoices: Vec<ClientWorkHistoryRow>,
    pub total_historical: f64,
    pub total_historical_usd: f64,
    pub total_historical_cup: f64,
}

const CLIENT_SELECT: &str = "SELECT c.id, c.code, c.name, c.phone, c.address, c.notes, c.balance,
    COALESCE((
        SELECT SUM(COALESCE(i.balance_usd, 0)) FROM invoices i
        WHERE i.client_id = c.id AND i.deleted_at IS NULL AND i.cancelled_at IS NULL
    ), 0),
    COALESCE((
        SELECT SUM(CASE
            WHEN COALESCE(i.balance, 0)
                - COALESCE(i.balance_usd, 0) * COALESCE(i.exchange_rate_snapshot, 0) > 0
            THEN COALESCE(i.balance, 0)
                - COALESCE(i.balance_usd, 0) * COALESCE(i.exchange_rate_snapshot, 0)
            ELSE 0
        END) FROM invoices i
        WHERE i.client_id = c.id AND i.deleted_at IS NULL AND i.cancelled_at IS NULL
    ), 0),
    COALESCE(c.credit_balance, 0),
    COALESCE((
        SELECT SUM(i.total) FROM invoices i
        WHERE i.client_id = c.id AND i.deleted_at IS NULL
    ), 0),
    COALESCE((
        SELECT SUM(COALESCE(i.due_usd, 0)) FROM invoices i
        WHERE i.client_id = c.id AND i.deleted_at IS NULL
    ), 0),
    COALESCE((
        SELECT SUM(COALESCE(i.due_cup, CASE
            WHEN LOWER(COALESCE(i.payment_currency, 'cup')) = 'usd' THEN 0
            ELSE i.total
        END)) FROM invoices i
        WHERE i.client_id = c.id AND i.deleted_at IS NULL
    ), 0),
    c.created_at, c.updated_at";

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

fn map_client_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClientDto> {
    Ok(ClientDto {
        id: row.get(0)?,
        code: row.get(1)?,
        name: row.get(2)?,
        phone: row.get(3)?,
        address: row.get(4)?,
        notes: row.get(5)?,
        balance: row.get(6)?,
        balance_usd: row.get(7)?,
        balance_cup: row.get(8)?,
        credit_balance: row.get(9)?,
        total_historical: row.get(10)?,
        total_historical_usd: row.get(11)?,
        total_historical_cup: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

/// Lists active clients ordered by most recently created first.
#[tauri::command]
pub fn clients_list() -> Result<Vec<ClientDto>, String> {
    let conn = db::open_connection()?;
    let sql = format!(
        "{CLIENT_SELECT}
         FROM clients c
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC, c.id DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], map_client_row)
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
    let sql = format!(
        "{CLIENT_SELECT}
         FROM clients c
         WHERE c.id = ?1 AND c.deleted_at IS NULL"
    );
    conn.query_row(&sql, params![id], map_client_row)
        .map_err(|_| "Cliente no encontrado".to_string())
}

/// Lists all non-deleted invoices for a client and the sum of their totals.
#[tauri::command]
pub fn clients_work_history(client_id: i64) -> Result<ClientWorkHistoryDto, String> {
    let conn = db::open_connection()?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM clients WHERE id = ?1 AND deleted_at IS NULL",
            params![client_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists == 0 {
        return Err("Cliente no encontrado".to_string());
    }

    let (total_historical, total_historical_usd, total_historical_cup): (f64, f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(total), 0),
                COALESCE(SUM(COALESCE(due_usd, 0)), 0),
                COALESCE(SUM(COALESCE(due_cup, CASE
                    WHEN LOWER(COALESCE(payment_currency, 'cup')) = 'usd' THEN 0
                    ELSE total
                END)), 0)
             FROM invoices WHERE client_id = ?1 AND deleted_at IS NULL",
            params![client_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.date, i.total,
                    COALESCE(i.total_usd, 0), i.paid, COALESCE(i.paid_usd, 0),
                    i.balance, COALESCE(i.balance_usd, 0),
                    COALESCE(i.due_usd, 0),
                    COALESCE(i.due_cup, CASE
                        WHEN LOWER(COALESCE(i.payment_currency, 'cup')) = 'usd' THEN 0
                        ELSE i.total
                    END),
                    i.production_status, i.payment_status, i.payment_currency, i.exchange_rate_snapshot
             FROM invoices i
             WHERE i.client_id = ?1 AND i.deleted_at IS NULL
             ORDER BY i.date DESC, i.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![client_id], |row| {
            Ok(ClientWorkHistoryRow {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                date: row.get(2)?,
                total: row.get(3)?,
                total_usd: row.get(4)?,
                paid: row.get(5)?,
                paid_usd: row.get(6)?,
                balance: row.get(7)?,
                balance_usd: row.get(8)?,
                due_usd: row.get(9)?,
                due_cup: row.get(10)?,
                production_status: row.get(11)?,
                payment_status: row.get(12)?,
                payment_currency: row.get(13)?,
                exchange_rate_snapshot: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut invoices = Vec::new();
    for r in rows {
        invoices.push(r.map_err(|e| e.to_string())?);
    }

    Ok(ClientWorkHistoryDto {
        invoices,
        total_historical,
        total_historical_usd,
        total_historical_cup,
    })
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

/// Soft-deleted client row for the restore modal.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedClientDto {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub balance: f64,
    pub balance_usd: f64,
    pub balance_cup: f64,
    pub credit_balance: f64,
    pub deleted_at: String,
}

/// Lists soft-deleted clients ordered by most recently deleted first.
#[tauri::command]
pub fn clients_list_deleted() -> Result<Vec<DeletedClientDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.code, c.name, c.phone, c.balance,
                    COALESCE((
                        SELECT SUM(COALESCE(i.balance_usd, 0)) FROM invoices i
                        WHERE i.client_id = c.id AND i.deleted_at IS NULL AND i.cancelled_at IS NULL
                    ), 0),
                    COALESCE((
                        SELECT SUM(CASE
                            WHEN COALESCE(i.balance, 0)
                                - COALESCE(i.balance_usd, 0) * COALESCE(i.exchange_rate_snapshot, 0) > 0
                            THEN COALESCE(i.balance, 0)
                                - COALESCE(i.balance_usd, 0) * COALESCE(i.exchange_rate_snapshot, 0)
                            ELSE 0
                        END) FROM invoices i
                        WHERE i.client_id = c.id AND i.deleted_at IS NULL AND i.cancelled_at IS NULL
                    ), 0),
                    COALESCE(c.credit_balance, 0), c.deleted_at
             FROM clients c
             WHERE c.deleted_at IS NOT NULL
             ORDER BY c.deleted_at DESC, c.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(DeletedClientDto {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                phone: row.get(3)?,
                balance: row.get(4)?,
                balance_usd: row.get(5)?,
                balance_cup: row.get(6)?,
                credit_balance: row.get(7)?,
                deleted_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// Restores a soft-deleted client by clearing deleted_at.
#[tauri::command]
pub fn clients_restore(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE clients SET deleted_at = NULL, updated_at = datetime('now')
             WHERE id = ?1 AND deleted_at IS NOT NULL",
            params![id],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Cliente eliminado no encontrado".to_string());
    }
    Ok(())
}
