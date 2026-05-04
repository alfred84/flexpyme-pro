//! Reports commands (Phase 7): summary KPIs and top debtors.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportsRangeArgs {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportsSummaryDto {
    pub invoices_count: i64,
    pub total_billed: f64,
    pub total_paid: f64,
    pub total_pending: f64,
    pub production_total_cost: f64,
    pub production_paid: f64,
    pub production_pending: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopDebtorDto {
    pub client_id: i64,
    pub client_code: String,
    pub client_name: String,
    pub balance: f64,
}

fn normalize_range(args: ReportsRangeArgs) -> (Option<String>, Option<String>) {
    let from = args.date_from.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    let to = args.date_to.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    (from, to)
}

#[tauri::command]
pub fn reports_summary(args: ReportsRangeArgs) -> Result<ReportsSummaryDto, String> {
    let conn = db::open_connection()?;
    let (from, to) = normalize_range(args);

    let invoice_where = if from.is_some() && to.is_some() {
        "WHERE deleted_at IS NULL AND date >= ?1 AND date <= ?2"
    } else {
        "WHERE deleted_at IS NULL"
    };
    let invoice_sql = format!(
        "SELECT COUNT(*), COALESCE(SUM(total),0), COALESCE(SUM(paid),0), COALESCE(SUM(balance),0)
         FROM invoices {}",
        invoice_where
    );

    let (invoices_count, total_billed, total_paid, total_pending): (i64, f64, f64, f64) =
        if let (Some(f), Some(t)) = (from.clone(), to.clone()) {
            conn.query_row(&invoice_sql, params![f, t], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?
        } else {
            conn.query_row(&invoice_sql, [], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map_err(|e| e.to_string())?
        };

    let production_where = if from.is_some() && to.is_some() {
        "WHERE date >= ?1 AND date <= ?2"
    } else {
        ""
    };
    let production_sql = format!(
        "SELECT COALESCE(SUM(total_cost),0), COALESCE(SUM(paid),0)
         FROM production_batches {}",
        production_where
    );

    let (production_total_cost, production_paid): (f64, f64) =
        if let (Some(f), Some(t)) = (from, to) {
            conn.query_row(&production_sql, params![f, t], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
        } else {
            conn.query_row(&production_sql, [], |row| Ok((row.get(0)?, row.get(1)?)))
                .map_err(|e| e.to_string())?
        };
    let production_pending = (production_total_cost - production_paid).max(0.0);

    Ok(ReportsSummaryDto {
        invoices_count,
        total_billed,
        total_paid,
        total_pending,
        production_total_cost,
        production_paid,
        production_pending,
    })
}

#[tauri::command]
pub fn reports_top_debtors(limit: Option<i64>) -> Result<Vec<TopDebtorDto>, String> {
    let conn = db::open_connection()?;
    let lim = limit.unwrap_or(10).clamp(1, 100);
    let mut stmt = conn
        .prepare(
            "SELECT id, code, name, balance
             FROM clients
             WHERE deleted_at IS NULL AND balance > 0
             ORDER BY balance DESC, name COLLATE NOCASE
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![lim], |row| {
            Ok(TopDebtorDto {
                client_id: row.get(0)?,
                client_code: row.get(1)?,
                client_name: row.get(2)?,
                balance: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
