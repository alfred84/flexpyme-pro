//! Other operating expenses (lunch, transport, etc.). Each expense creates a
//! matching cash egress so it affects the daily/monthly cash flow.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// One "other expense" row for list screens.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtherExpenseDto {
    pub id: i64,
    pub date: String,
    pub concept: String,
    pub expense_type: String,
    pub employee_id: Option<i64>,
    pub employee_name: Option<String>,
    pub amount_cup: f64,
    pub amount_usd: f64,
    pub payment_method: String,
    pub notes: Option<String>,
}

/// Net expense totals for the current day and month.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtherExpenseSummaryDto {
    pub today_cup: f64,
    pub month_cup: f64,
}

/// Payload for registering an "other expense".
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOtherExpensePayload {
    pub date: String,
    pub concept: String,
    pub expense_type: String,
    pub employee_id: Option<i64>,
    pub amount_cup: f64,
    pub amount_usd: Option<f64>,
    pub payment_method: String,
    pub denomination_breakdown: Option<String>,
    pub notes: Option<String>,
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

/// Lists other expenses, most recent first.
#[tauri::command]
pub fn other_expenses_list() -> Result<Vec<OtherExpenseDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT oe.id, oe.date, oe.concept, oe.expense_type, oe.employee_id, e.name,
                    oe.amount_cup, oe.amount_usd, oe.payment_method, oe.notes
             FROM other_expenses oe
             LEFT JOIN employees e ON e.id = oe.employee_id
             ORDER BY oe.date DESC, oe.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(OtherExpenseDto {
                id: row.get(0)?,
                date: row.get(1)?,
                concept: row.get(2)?,
                expense_type: row.get(3)?,
                employee_id: row.get(4)?,
                employee_name: row.get(5)?,
                amount_cup: row.get(6)?,
                amount_usd: row.get(7)?,
                payment_method: row.get(8)?,
                notes: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Net "other expense" totals for the current day and month (CUP).
#[tauri::command]
pub fn other_expenses_summary() -> Result<OtherExpenseSummaryDto, String> {
    let conn = db::open_connection()?;
    let today_cup: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_cup), 0) FROM other_expenses
             WHERE date(date) = date('now', 'localtime')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let month_cup: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_cup), 0) FROM other_expenses
             WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(OtherExpenseSummaryDto {
        today_cup,
        month_cup,
    })
}

/// Registers an "other expense" and its matching cash egress in a transaction.
#[tauri::command]
pub fn other_expense_create(payload: CreateOtherExpensePayload) -> Result<i64, String> {
    let date = payload.date.trim().to_string();
    if date.is_empty() {
        return Err("La fecha es obligatoria".to_string());
    }
    let concept = payload.concept.trim().to_string();
    if concept.is_empty() {
        return Err("El concepto es obligatorio".to_string());
    }
    let amount_usd = payload.amount_usd.unwrap_or(0.0);
    if payload.amount_cup <= 0.0 && amount_usd <= 0.0 {
        return Err("El importe debe ser mayor que cero".to_string());
    }
    let expense_type = payload.expense_type.trim().to_string();
    let expense_type = if expense_type.is_empty() {
        "Otros".to_string()
    } else {
        expense_type
    };
    let payment_method = payload.payment_method.trim().to_string();
    let denomination = normalize_optional(payload.denomination_breakdown);
    let notes = normalize_optional(payload.notes);

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES ('egreso', ?1, 'otro_gasto', NULL, ?2, ?3, 0, ?4, ?5, ?6)",
        params![
            format!("{} ({})", concept, expense_type),
            payload.amount_cup,
            amount_usd,
            payment_method,
            denomination,
            date
        ],
    )
    .map_err(|e| e.to_string())?;
    let cash_id = tx.last_insert_rowid();

    tx.execute(
        "INSERT INTO other_expenses
            (date, concept, expense_type, employee_id, amount_cup, amount_usd, payment_method,
             denomination_breakdown, notes, cash_transaction_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            date,
            concept,
            expense_type,
            payload.employee_id,
            payload.amount_cup,
            amount_usd,
            payment_method,
            denomination,
            notes,
            cash_id
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = tx.last_insert_rowid();

    tx.execute(
        "UPDATE cash_transactions SET reference_id = ?1 WHERE id = ?2",
        params![id, cash_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

/// Deletes an "other expense" and its linked cash transaction.
#[tauri::command]
pub fn other_expense_delete(id: i64) -> Result<(), String> {
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let cash_id: Option<i64> = tx
        .query_row(
            "SELECT cash_transaction_id FROM other_expenses WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Gasto no encontrado".to_string())?;
    if let Some(cash_id) = cash_id {
        tx.execute("DELETE FROM cash_transactions WHERE id = ?1", params![cash_id])
            .map_err(|e| e.to_string())?;
    }
    tx.execute("DELETE FROM other_expenses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
