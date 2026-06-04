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
    pub invoices_paid_count: i64,
    pub invoices_partial_count: i64,
    pub invoices_pending_count: i64,
    pub average_invoice_amount: f64,
    pub collection_rate: f64,
    pub clients_with_receivables_count: i64,
    pub production_total_cost: f64,
    pub production_paid: f64,
    pub production_pending: f64,
    pub production_batches_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopDebtorDto {
    pub client_id: i64,
    pub client_code: String,
    pub client_name: String,
    pub balance: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryIncomeDto {
    pub category: String,
    pub label: String,
    pub total: f64,
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
        "SELECT COUNT(*),
                COALESCE(SUM(total),0), COALESCE(SUM(paid),0), COALESCE(SUM(balance),0),
                COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)
         FROM invoices {}",
        invoice_where
    );

    let (
        invoices_count,
        total_billed,
        total_paid,
        total_pending,
        invoices_paid_count,
        invoices_partial_count,
        invoices_pending_count,
    ): (i64, f64, f64, f64, i64, i64, i64) = if let (Some(f), Some(t)) = (from.clone(), to.clone()) {
        conn.query_row(&invoice_sql, params![f, t], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })
        .map_err(|e| e.to_string())?
    } else {
        conn.query_row(&invoice_sql, [], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })
        .map_err(|e| e.to_string())?
    };

    let average_invoice_amount = if invoices_count > 0 {
        total_billed / (invoices_count as f64)
    } else {
        0.0
    };
    let collection_rate = if total_billed > 1e-9 {
        (total_paid / total_billed).min(1.0)
    } else {
        0.0
    };

    let clients_with_receivables_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL AND balance > 0",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let production_where = if from.is_some() && to.is_some() {
        "WHERE date >= ?1 AND date <= ?2"
    } else {
        ""
    };
    let production_sql = format!(
        "SELECT COALESCE(SUM(total_cost),0), COALESCE(SUM(paid),0), COUNT(*)
         FROM production_batches {}",
        production_where
    );

    let (production_total_cost, production_paid, production_batches_count): (f64, f64, i64) =
        if let (Some(f), Some(t)) = (from, to) {
            conn.query_row(&production_sql, params![f, t], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?
        } else {
            conn.query_row(&production_sql, [], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
                .map_err(|e| e.to_string())?
        };
    let production_pending = (production_total_cost - production_paid).max(0.0);

    Ok(ReportsSummaryDto {
        invoices_count,
        total_billed,
        total_paid,
        total_pending,
        invoices_paid_count,
        invoices_partial_count,
        invoices_pending_count,
        average_invoice_amount,
        collection_rate,
        clients_with_receivables_count,
        production_total_cost,
        production_paid,
        production_pending,
        production_batches_count,
    })
}

/// Total facturado por categoría de producto en un rango de fechas (para el gráfico del dashboard).
#[tauri::command]
pub fn reports_income_by_category(args: ReportsRangeArgs) -> Result<Vec<CategoryIncomeDto>, String> {
    let conn = db::open_connection()?;
    let (from, to) = normalize_range(args);

    let where_clause = if from.is_some() && to.is_some() {
        "WHERE i.deleted_at IS NULL AND i.date >= ?1 AND i.date <= ?2"
    } else {
        "WHERE i.deleted_at IS NULL"
    };
    let sql = format!(
        "SELECT pc.name, COALESCE(pc.label_es, pc.name), COALESCE(SUM(ii.subtotal), 0) AS total
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         JOIN product_categories pc ON pc.id = ii.category_id
         {}
         GROUP BY pc.id
         HAVING total > 0
         ORDER BY total DESC",
        where_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let map_row = |row: &rusqlite::Row| {
        Ok(CategoryIncomeDto {
            category: row.get(0)?,
            label: row.get(1)?,
            total: row.get(2)?,
        })
    };
    let rows = if let (Some(f), Some(t)) = (from, to) {
        stmt.query_map(params![f, t], map_row).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>()
    } else {
        stmt.query_map([], map_row).map_err(|e| e.to_string())?.collect::<Result<Vec<_>, _>>()
    };
    rows.map_err(|e| e.to_string())
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
