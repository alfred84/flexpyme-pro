//! Cash register: count cash by denomination, record session, update invoice and client balance.

use std::collections::HashMap;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Bill/coin face values (DOP).
pub const DENOMINATIONS: &[i64] = &[1000, 500, 200, 100, 50, 20, 10, 5];

const EPS: f64 = 1e-6;

fn compute_invoice_status(balance: f64, paid: f64) -> String {
    if balance <= EPS {
        "paid".to_string()
    } else if paid <= EPS {
        "pending".to_string()
    } else {
        "partial".to_string()
    }
}

/// One saved cash session row.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashSessionDto {
    pub id: i64,
    pub invoice_id: i64,
    pub total_amount: f64,
    pub amount_received: f64,
    pub change_given: f64,
    pub date: String,
    pub denomination_breakdown: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashierRegisterPayload {
    pub invoice_id: i64,
    /// Map of denomination string (e.g. "1000") to count.
    pub counts: HashMap<String, i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashierRegisterResponse {
    pub session_id: i64,
    pub amount_received: f64,
    pub change_given: f64,
    pub amount_applied: f64,
    pub invoice_new_balance: f64,
    pub invoice_status: String,
}

fn sum_from_counts(counts: &HashMap<String, i64>) -> Result<f64, String> {
    let mut sum = 0.0_f64;
    for (k, &n) in counts.iter() {
        if n < 0 {
            return Err("Las cantidades no pueden ser negativas".to_string());
        }
        if n == 0 {
            continue;
        }
        let d: i64 = k
            .parse()
            .map_err(|_| format!("Denominacion invalida: {}", k))?;
        if !DENOMINATIONS.contains(&d) {
            return Err(format!("Denominacion no admitida: {}", k));
        }
        sum += (d as f64) * (n as f64);
    }
    Ok(sum)
}

/// Lists cash sessions for an invoice, newest first.
#[tauri::command]
pub fn cashier_sessions_for_invoice(invoice_id: i64) -> Result<Vec<CashSessionDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_id, total_amount, amount_received, change_given, date, denomination_breakdown
             FROM cash_sessions WHERE invoice_id = ?1 ORDER BY id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![invoice_id], |row| {
            Ok(CashSessionDto {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                total_amount: row.get(2)?,
                amount_received: row.get(3)?,
                change_given: row.get(4)?,
                date: row.get(5)?,
                denomination_breakdown: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Registers physical cash: persists `cash_sessions` and applies payment to invoice + client balance.
#[tauri::command]
pub fn cashier_register_payment(
    payload: CashierRegisterPayload,
) -> Result<CashierRegisterResponse, String> {
    let amount_received = sum_from_counts(&payload.counts)?;
    if amount_received <= EPS {
        return Err("Indica al menos un billete o moneda".to_string());
    }

    let breakdown_json =
        serde_json::to_string(&payload.counts).map_err(|e| e.to_string())?;

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (client_id, total, paid, balance): (i64, f64, f64, f64) = tx
        .query_row(
            "SELECT client_id, total, paid, balance FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![payload.invoice_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Factura no encontrada".to_string())?;

    if balance <= EPS {
        return Err("Esta factura no tiene saldo pendiente".to_string());
    }

    let amount_applied = amount_received.min(balance);
    let change_given = (amount_received - balance).max(0.0);

    let new_paid = paid + amount_applied;
    let new_balance = (total - new_paid).max(0.0);
    let status = compute_invoice_status(new_balance, new_paid);

    let client_balance: f64 = tx
        .query_row(
            "SELECT balance FROM clients WHERE id = ?1 AND deleted_at IS NULL",
            params![client_id],
            |row| row.get(0),
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    let new_client_balance = client_balance - amount_applied;
    if new_client_balance < -EPS {
        return Err("Inconsistencia de saldo del cliente".to_string());
    }

    tx.execute(
        "INSERT INTO cash_sessions (invoice_id, total_amount, amount_received, change_given, denomination_breakdown)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![payload.invoice_id, balance, amount_received, change_given, breakdown_json],
    )
    .map_err(|e| e.to_string())?;

    let session_id = tx.last_insert_rowid();

    tx.execute(
        "UPDATE invoices SET paid = ?1, balance = ?2, status = ?3 WHERE id = ?4 AND deleted_at IS NULL",
        params![new_paid, new_balance, status, payload.invoice_id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE clients SET balance = ?1, updated_at = datetime('now') WHERE id = ?2 AND deleted_at IS NULL",
        params![new_client_balance, client_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(CashierRegisterResponse {
        session_id,
        amount_received,
        change_given,
        amount_applied,
        invoice_new_balance: new_balance,
        invoice_status: status,
    })
}
