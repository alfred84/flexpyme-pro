//! Other operating expenses (lunch, transport, etc.). Each expense creates a
//! matching cash egress so it affects the daily/monthly cash flow.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// One "other expense" row for list and detail screens.
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
    pub denomination_breakdown: Option<String>,
    pub notes: Option<String>,
    pub cash_transaction_id: Option<i64>,
    pub created_at: String,
}

/// Net expense totals for the current day and month (physical drawers).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtherExpenseSummaryDto {
    pub today_cup: f64,
    pub month_cup: f64,
    pub today_usd: f64,
    pub month_usd: f64,
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

/// Payload for updating an existing "other expense".
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOtherExpensePayload {
    pub id: i64,
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

fn map_expense_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<OtherExpenseDto> {
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
        denomination_breakdown: row.get(9)?,
        notes: row.get(10)?,
        cash_transaction_id: row.get(11)?,
        created_at: row.get(12)?,
    })
}

const EXPENSE_SELECT: &str = "SELECT oe.id, oe.date, oe.concept, oe.expense_type, oe.employee_id, e.name,
                    oe.amount_cup, oe.amount_usd, oe.payment_method, oe.denomination_breakdown,
                    oe.notes, oe.cash_transaction_id, oe.created_at
             FROM other_expenses oe
             LEFT JOIN employees e ON e.id = oe.employee_id";

/// Lists other expenses, most recent first.
#[tauri::command]
pub fn other_expenses_list() -> Result<Vec<OtherExpenseDto>, String> {
    let conn = db::open_connection()?;
    let sql = format!("{EXPENSE_SELECT} ORDER BY oe.date DESC, oe.id DESC");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_expense_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Loads a single other expense by id.
#[tauri::command]
pub fn other_expense_get_by_id(id: i64) -> Result<OtherExpenseDto, String> {
    let conn = db::open_connection()?;
    let sql = format!("{EXPENSE_SELECT} WHERE oe.id = ?1");
    conn.query_row(&sql, params![id], map_expense_row)
        .map_err(|_| "Gasto no encontrado".to_string())
}

/// Net "other expense" totals for the current day and month (CUP and USD).
#[tauri::command]
pub fn other_expenses_summary() -> Result<OtherExpenseSummaryDto, String> {
    let conn = db::open_connection()?;
    let (today_cup, today_usd): (f64, f64) = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_cup), 0), COALESCE(SUM(amount_usd), 0)
             FROM other_expenses
             WHERE date(date) = date('now', 'localtime')",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let (month_cup, month_usd): (f64, f64) = conn
        .query_row(
            "SELECT COALESCE(SUM(amount_cup), 0), COALESCE(SUM(amount_usd), 0)
             FROM other_expenses
             WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    Ok(OtherExpenseSummaryDto {
        today_cup,
        month_cup,
        today_usd,
        month_usd,
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

/// Updates an "other expense" and keeps its linked cash egress in sync.
#[tauri::command]
pub fn other_expense_update(payload: UpdateOtherExpensePayload) -> Result<(), String> {
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

    let cash_id: Option<i64> = tx
        .query_row(
            "SELECT cash_transaction_id FROM other_expenses WHERE id = ?1",
            params![payload.id],
            |row| row.get(0),
        )
        .map_err(|_| "Gasto no encontrado".to_string())?;

    let updated = tx
        .execute(
            "UPDATE other_expenses
             SET date = ?1, concept = ?2, expense_type = ?3, employee_id = ?4,
                 amount_cup = ?5, amount_usd = ?6, payment_method = ?7,
                 denomination_breakdown = ?8, notes = ?9
             WHERE id = ?10",
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
                payload.id
            ],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Gasto no encontrado".to_string());
    }

    if let Some(cash_id) = cash_id {
        tx.execute(
            "UPDATE cash_transactions
             SET concept = ?1, amount_cup = ?2, amount_usd = ?3, payment_method = ?4,
                 denomination_breakdown = ?5, date = ?6
             WHERE id = ?7",
            params![
                format!("{} ({})", concept, expense_type),
                payload.amount_cup,
                amount_usd,
                payment_method,
                denomination,
                date,
                cash_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
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
