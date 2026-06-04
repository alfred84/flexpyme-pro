//! General cash-flow commands (CUP/USD) backed by SQLite.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Current cash balance split by currency.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashBalanceDto {
    pub balance_cup: f64,
    pub balance_usd: f64,
    pub total_income_cup: f64,
    pub total_expense_cup: f64,
}

/// Cash transaction row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashTransactionDto {
    pub id: i64,
    pub transaction_type: String,
    pub concept: String,
    pub reference_type: Option<String>,
    pub amount_cup: f64,
    pub amount_usd: f64,
    pub exchange_rate: f64,
    pub payment_method: String,
    pub date: String,
}

/// One point of the 30-day cash-flow series.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashDailyPointDto {
    pub date: String,
    pub net_cup: f64,
}

/// Payload for creating a manual cash transaction.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTransactionPayload {
    pub transaction_type: String,
    pub concept: String,
    pub reference_type: Option<String>,
    pub amount_cup: f64,
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub payment_method: String,
    pub denomination_breakdown: Option<String>,
}

/// Optional filters for listing cash transactions.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashFilters {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub transaction_type: Option<String>,
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

/// Returns the current cash balance in CUP and USD.
#[tauri::command]
pub fn cash_balance() -> Result<CashBalanceDto, String> {
    let conn = db::open_connection()?;
    let (income_cup, expense_cup, income_usd, expense_usd): (f64, f64, f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_cup ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount_cup ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_usd ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount_usd ELSE 0 END), 0)
             FROM cash_transactions",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| e.to_string())?;

    Ok(CashBalanceDto {
        balance_cup: income_cup - expense_cup,
        balance_usd: income_usd - expense_usd,
        total_income_cup: income_cup,
        total_expense_cup: expense_cup,
    })
}

/// Lists cash transactions with optional filters (most recent first).
#[tauri::command]
pub fn cash_transactions_list(filters: Option<CashFilters>) -> Result<Vec<CashTransactionDto>, String> {
    let conn = db::open_connection()?;
    let filters = filters.unwrap_or(CashFilters {
        date_from: None,
        date_to: None,
        transaction_type: None,
    });

    let mut clauses: Vec<String> = Vec::new();
    let mut args: Vec<String> = Vec::new();
    if let Some(from) = normalize_optional(filters.date_from) {
        clauses.push(format!("date >= ?{}", args.len() + 1));
        args.push(from);
    }
    if let Some(to) = normalize_optional(filters.date_to) {
        clauses.push(format!("date <= ?{}", args.len() + 1));
        args.push(to);
    }
    if let Some(t) = normalize_optional(filters.transaction_type) {
        clauses.push(format!("type = ?{}", args.len() + 1));
        args.push(t);
    }

    let where_clause = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    let sql = format!(
        "SELECT id, type, concept, reference_type, amount_cup, amount_usd, exchange_rate, payment_method, date
         FROM cash_transactions {}
         ORDER BY date DESC, id DESC",
        where_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a as &dyn rusqlite::ToSql).collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(CashTransactionDto {
                id: row.get(0)?,
                transaction_type: row.get(1)?,
                concept: row.get(2)?,
                reference_type: row.get(3)?,
                amount_cup: row.get(4)?,
                amount_usd: row.get(5)?,
                exchange_rate: row.get(6)?,
                payment_method: row.get(7)?,
                date: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Net cash flow per day over the last 30 days (for the dashboard chart).
#[tauri::command]
pub fn cash_daily_series() -> Result<Vec<CashDailyPointDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT date(date) AS d,
                    COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_cup ELSE -amount_cup END), 0)
             FROM cash_transactions
             WHERE date(date) >= date('now', '-30 days')
             GROUP BY d
             ORDER BY d",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CashDailyPointDto {
                date: row.get(0)?,
                net_cup: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a manual cash transaction (ingreso/egreso).
#[tauri::command]
pub fn cash_transaction_create(payload: CreateTransactionPayload) -> Result<i64, String> {
    let transaction_type = payload.transaction_type.trim().to_lowercase();
    if transaction_type != "ingreso" && transaction_type != "egreso" {
        return Err("Tipo de transacción inválido".to_string());
    }
    let concept = payload.concept.trim().to_string();
    if concept.is_empty() {
        return Err("El concepto es obligatorio".to_string());
    }
    if payload.amount_cup <= 0.0 {
        return Err("El importe en CUP debe ser mayor que cero".to_string());
    }

    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
        params![
            transaction_type,
            concept,
            normalize_optional(payload.reference_type),
            payload.amount_cup,
            payload.amount_usd.unwrap_or(0.0),
            payload.exchange_rate.unwrap_or(0.0),
            payload.payment_method.trim(),
            normalize_optional(payload.denomination_breakdown)
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}
