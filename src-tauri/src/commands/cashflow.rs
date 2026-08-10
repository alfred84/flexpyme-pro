//! General cash-flow commands (CUP/USD) backed by SQLite.
//! Cajeros físicos independientes: `amount_cup` y `amount_usd` no se mezclan por conversión.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

const EPS: f64 = 1e-6;

/// Current cash balance split by currency.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashBalanceDto {
    pub balance_cup: f64,
    pub balance_usd: f64,
    pub total_income_cup: f64,
    pub total_expense_cup: f64,
    pub total_income_usd: f64,
    pub total_expense_usd: f64,
}

/// Cash transaction row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashTransactionDto {
    pub id: i64,
    pub transaction_type: String,
    pub concept: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<i64>,
    pub amount_cup: f64,
    pub amount_usd: f64,
    pub exchange_rate: f64,
    pub payment_method: String,
    pub date: String,
}

/// One point of the 30-day cash-flow series (net per currency).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashDailyPointDto {
    pub date: String,
    pub net_cup: f64,
    pub net_usd: f64,
}

/// Net cash flow for the current day and the last 30 days.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashNetSummaryDto {
    pub net_today_cup: f64,
    pub net_today_usd: f64,
    pub net_30_days_cup: f64,
    pub net_30_days_usd: f64,
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
    /// Subcadena de concepto (case-insensitive).
    pub concept: Option<String>,
    /// `cup` | `usd` | `mixto` | vacío = todas.
    pub currency: Option<String>,
    pub payment_method: Option<String>,
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

/// Returns the current cash balance in CUP and USD (physical drawers).
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
        total_income_usd: income_usd,
        total_expense_usd: expense_usd,
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
        concept: None,
        currency: None,
        payment_method: None,
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
    if let Some(concept) = normalize_optional(filters.concept) {
        clauses.push(format!("LOWER(concept) LIKE '%' || LOWER(?{}) || '%'", args.len() + 1));
        args.push(concept);
    }
    if let Some(method) = normalize_optional(filters.payment_method) {
        clauses.push(format!("LOWER(payment_method) = LOWER(?{})", args.len() + 1));
        args.push(method);
    }
    if let Some(currency) = normalize_optional(filters.currency) {
        match currency.to_lowercase().as_str() {
            "cup" => clauses.push(
                "amount_cup > 0.000001 AND amount_usd <= 0.000001".to_string(),
            ),
            "usd" => clauses.push(
                "amount_usd > 0.000001 AND amount_cup <= 0.000001".to_string(),
            ),
            "mixto" => {
                clauses.push("amount_cup > 0.000001 AND amount_usd > 0.000001".to_string())
            }
            _ => {}
        }
    }

    let where_clause = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    let sql = format!(
        "SELECT id, type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate, payment_method, date
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
                reference_id: row.get(4)?,
                amount_cup: row.get(5)?,
                amount_usd: row.get(6)?,
                exchange_rate: row.get(7)?,
                payment_method: row.get(8)?,
                date: row.get(9)?,
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
                    COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_cup ELSE -amount_cup END), 0),
                    COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_usd ELSE -amount_usd END), 0)
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
                net_usd: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Net cash flow for the current day and the rolling last 30 days.
#[tauri::command]
pub fn cash_net_summary() -> Result<CashNetSummaryDto, String> {
    let conn = db::open_connection()?;
    let (net_today_cup, net_today_usd): (f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_cup ELSE -amount_cup END), 0),
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_usd ELSE -amount_usd END), 0)
             FROM cash_transactions
             WHERE date(date) = date('now', 'localtime')",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let (net_30_days_cup, net_30_days_usd): (f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_cup ELSE -amount_cup END), 0),
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_usd ELSE -amount_usd END), 0)
             FROM cash_transactions
             WHERE date(date) >= date('now', 'localtime', '-30 days')",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    Ok(CashNetSummaryDto {
        net_today_cup,
        net_today_usd,
        net_30_days_cup,
        net_30_days_usd,
    })
}

/// Creates a manual cash transaction (ingreso/egreso) in one physical currency drawer.
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
    let amount_cup = payload.amount_cup.max(0.0);
    let amount_usd = payload.amount_usd.unwrap_or(0.0).max(0.0);
    if amount_cup <= EPS && amount_usd <= EPS {
        return Err("Indica un importe en CUP o en USD mayor que cero".to_string());
    }
    let exchange_rate = payload.exchange_rate.unwrap_or(0.0).max(0.0);
    if amount_usd > EPS && exchange_rate <= EPS {
        return Err("Indica una tasa USD→CUP válida para movimientos en USD".to_string());
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
            amount_cup,
            amount_usd,
            exchange_rate,
            payload.payment_method.trim(),
            normalize_optional(payload.denomination_breakdown)
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}
