//! Stock view: production-ready orders waiting for pickup/collection.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockItemDto {
    pub id: i64,
    pub invoice_number: String,
    pub client_id: i64,
    pub client_name: String,
    pub date: String,
    pub total: f64,
    pub balance: f64,
    pub payment_status: String,
    pub production_completed_at: Option<String>,
    pub days_waiting: i64,
    pub products_summary: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockMetricsDto {
    pub total_listo: i64,
    pub cobrado: i64,
    pub sin_cobrar: i64,
    pub avg_days_waiting: f64,
    pub stale_count: i64,
}

fn products_summary(conn: &rusqlite::Connection, invoice_id: i64) -> Result<String, String> {
    let mut stmt = conn
        .prepare(
            "SELECT COALESCE(ii.category_snapshot, pc.name),
                    COALESCE(ii.format_label_snapshot, f.label, ''),
                    ii.quantity
             FROM invoice_items ii
             JOIN product_categories pc ON pc.id = ii.category_id
             LEFT JOIN formats f ON f.id = ii.format_id
             WHERE ii.invoice_id = ?1
             ORDER BY ii.id
             LIMIT 3",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![invoice_id], |row| {
            let cat: String = row.get(0)?;
            let fmt: String = row.get(1)?;
            let qty: i64 = row.get(2)?;
            let label = if fmt.trim().is_empty() {
                format!("{} {}", qty, cat)
            } else {
                format!("{} {} {}", qty, cat, fmt)
            };
            Ok(label)
        })
        .map_err(|e| e.to_string())?;
    let mut parts = Vec::new();
    for r in rows {
        parts.push(r.map_err(|e| e.to_string())?);
    }
    if parts.is_empty() {
        return Ok("—".to_string());
    }
    Ok(parts.join(", "))
}

fn days_since(conn: &rusqlite::Connection, ts: Option<String>) -> i64 {
    let Some(ts) = ts.filter(|s| !s.trim().is_empty()) else {
        return 0;
    };
    conn.query_row(
        "SELECT CAST((julianday('now') - julianday(?1)) AS INTEGER)",
        params![ts],
        |row| row.get(0),
    )
    .unwrap_or(0)
    .max(0)
}

/// Lists production-ready orders with optional payment filter.
#[tauri::command]
pub fn get_stock_items(payment_status_filter: Option<String>) -> Result<Vec<StockItemDto>, String> {
    let conn = db::open_connection()?;
    let filter = payment_status_filter
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty() && s != "todos");

    let mut sql = String::from(
        "SELECT i.id, i.invoice_number, i.client_id, c.name, i.date, i.total, i.balance,
                i.payment_status, i.production_completed_at
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         WHERE i.deleted_at IS NULL AND i.cancelled_at IS NULL
           AND i.production_status = 'listo'",
    );
    if filter.as_deref() == Some("pendiente") || filter.as_deref() == Some("sin_cobrar") {
        sql.push_str(" AND i.payment_status = 'pendiente'");
    } else if filter.as_deref() == Some("cobrado") || filter.as_deref() == Some("cobrados") {
        sql.push_str(" AND i.payment_status = 'cobrado'");
    }
    sql.push_str(" ORDER BY i.production_completed_at ASC, i.id DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, Option<String>>(8)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        let (
            id,
            invoice_number,
            client_id,
            client_name,
            date,
            total,
            balance,
            payment_status,
            production_completed_at,
        ) = r.map_err(|e| e.to_string())?;
        let days_waiting = days_since(&conn, production_completed_at.clone());
        let products_summary = products_summary(&conn, id)?;
        out.push(StockItemDto {
            id,
            invoice_number,
            client_id,
            client_name,
            date,
            total,
            balance,
            payment_status,
            production_completed_at,
            days_waiting,
            products_summary,
        });
    }
    Ok(out)
}

/// KPI metrics for the stock module dashboard cards.
#[tauri::command]
pub fn get_stock_metrics() -> Result<StockMetricsDto, String> {
    let conn = db::open_connection()?;
    let total_listo: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoices
             WHERE deleted_at IS NULL AND cancelled_at IS NULL AND production_status = 'listo'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let cobrado: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoices
             WHERE deleted_at IS NULL AND cancelled_at IS NULL AND production_status = 'listo' AND payment_status = 'cobrado'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let sin_cobrar: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoices
             WHERE deleted_at IS NULL AND cancelled_at IS NULL AND production_status = 'listo' AND payment_status = 'pendiente'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let avg_days_waiting: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG(julianday('now') - julianday(production_completed_at)), 0)
             FROM invoices
             WHERE deleted_at IS NULL AND cancelled_at IS NULL AND production_status = 'listo'
               AND production_completed_at IS NOT NULL",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let stale_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM invoices
             WHERE deleted_at IS NULL AND cancelled_at IS NULL AND production_status = 'listo'
               AND production_completed_at IS NOT NULL
               AND (julianday('now') - julianday(production_completed_at)) >= 7",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(StockMetricsDto {
        total_listo,
        cobrado,
        sin_cobrar,
        avg_days_waiting,
        stale_count,
    })
}
