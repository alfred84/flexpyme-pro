//! Reports commands (Phase 7): summary KPIs and top debtors.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Clone, Deserialize)]
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

/// Exports invoices in the date range to CSV via native save dialog.
#[tauri::command]
pub async fn export_orders_csv(
    app: tauri::AppHandle,
    args: ReportsRangeArgs,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let conn = db::open_connection()?;
    let (from, to) = normalize_range(args);
    let sql = if from.is_some() && to.is_some() {
        "SELECT invoice_number, date, total, paid, balance, status, production_status, payment_status
         FROM invoices WHERE deleted_at IS NULL AND date >= ?1 AND date <= ?2 ORDER BY date DESC"
    } else {
        "SELECT invoice_number, date, total, paid, balance, status, production_status, payment_status
         FROM invoices WHERE deleted_at IS NULL ORDER BY date DESC"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows: Vec<(String, String, f64, f64, f64, String, String, String)> = if let (Some(f), Some(t)) =
        (&from, &to)
    {
        stmt.query_map(params![f, t], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
    } else {
        stmt.query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
    };

    let dest = app
        .dialog()
        .file()
        .add_filter("CSV", &["csv"])
        .set_file_name("pedidos.csv")
        .blocking_save_file()
        .ok_or_else(|| "Exportación cancelada".to_string())?;

    let path = dest.into_path().map_err(|e| e.to_string())?;
    let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;
    wtr.write_record([
        "numero",
        "fecha",
        "total",
        "pagado",
        "pendiente",
        "estado",
        "produccion",
        "cobro",
    ])
    .map_err(|e| e.to_string())?;
    for row in rows {
        wtr.write_record([
            row.0,
            row.1,
            row.2.to_string(),
            row.3.to_string(),
            row.4.to_string(),
            row.5,
            row.6,
            row.7,
        ])
        .map_err(|e| e.to_string())?;
    }
    wtr.flush().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Exports summary + invoices to XLSX via native save dialog.
#[tauri::command]
pub async fn export_reports_xlsx(
    app: tauri::AppHandle,
    args: ReportsRangeArgs,
) -> Result<String, String> {
    use rust_xlsxwriter::Workbook;
    use tauri_plugin_dialog::DialogExt;

    let summary = reports_summary(args.clone())?;
    let conn = db::open_connection()?;
    let (from, to) = normalize_range(args);
    let sql = if from.is_some() && to.is_some() {
        "SELECT invoice_number, client_id, date, total, balance FROM invoices
         WHERE deleted_at IS NULL AND date >= ?1 AND date <= ?2 ORDER BY date DESC"
    } else {
        "SELECT invoice_number, client_id, date, total, balance FROM invoices
         WHERE deleted_at IS NULL ORDER BY date DESC"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let invoice_rows: Vec<(String, i64, String, f64, f64)> = if let (Some(f), Some(t)) = (&from, &to) {
        stmt.query_map(params![f, t], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
    } else {
        stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
    };

    let dest = app
        .dialog()
        .file()
        .add_filter("Excel", &["xlsx"])
        .set_file_name("reportes.xlsx")
        .blocking_save_file()
        .ok_or_else(|| "Exportación cancelada".to_string())?;
    let path = dest.into_path().map_err(|e| e.to_string())?;

    let mut workbook = Workbook::new();
    let summary_sheet = workbook.add_worksheet();
    summary_sheet.set_name("Resumen").map_err(|e| e.to_string())?;
    summary_sheet.write_string(0, 0, "Métrica").map_err(|e| e.to_string())?;
    summary_sheet.write_string(0, 1, "Valor").map_err(|e| e.to_string())?;
    let rows = [
        ("Facturas", summary.invoices_count.to_string()),
        ("Total facturado", summary.total_billed.to_string()),
        ("Total cobrado", summary.total_paid.to_string()),
        ("Pendiente", summary.total_pending.to_string()),
    ];
    for (i, (k, v)) in rows.iter().enumerate() {
        let r = (i + 1) as u32;
        summary_sheet.write_string(r, 0, *k).map_err(|e| e.to_string())?;
        summary_sheet.write_string(r, 1, v).map_err(|e| e.to_string())?;
    }

    let inv_sheet = workbook.add_worksheet();
    inv_sheet.set_name("Pedidos").map_err(|e| e.to_string())?;
    inv_sheet.write_string(0, 0, "Numero").map_err(|e| e.to_string())?;
    inv_sheet.write_string(0, 1, "Fecha").map_err(|e| e.to_string())?;
    inv_sheet.write_string(0, 2, "Total").map_err(|e| e.to_string())?;
    inv_sheet.write_string(0, 3, "Pendiente").map_err(|e| e.to_string())?;
    for (i, row) in invoice_rows.iter().enumerate() {
        let r = (i + 1) as u32;
        inv_sheet.write_string(r, 0, &row.0).map_err(|e| e.to_string())?;
        inv_sheet.write_string(r, 1, &row.2).map_err(|e| e.to_string())?;
        inv_sheet.write_number(r, 2, row.3).map_err(|e| e.to_string())?;
        inv_sheet.write_number(r, 3, row.4).map_err(|e| e.to_string())?;
    }

    workbook.save(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Exports a simple text PDF report via native save dialog.
#[tauri::command]
pub async fn export_reports_pdf(
    app: tauri::AppHandle,
    args: ReportsRangeArgs,
) -> Result<String, String> {
    use printpdf::*;
    use tauri_plugin_dialog::DialogExt;

    let summary = reports_summary(args)?;

    let dest = app
        .dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .set_file_name("reportes.pdf")
        .blocking_save_file()
        .ok_or_else(|| "Exportación cancelada".to_string())?;
    let path = dest.into_path().map_err(|e| e.to_string())?;

    let (doc, page1, layer1) =
        PdfDocument::new("Reportes FlexPyme", Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let current_layer = doc.get_page(page1).get_layer(layer1);

    let lines = [
        "FlexPyme Pro - Reporte",
        &format!("Facturas: {}", summary.invoices_count),
        &format!("Total facturado: {:.2} CUP", summary.total_billed),
        &format!("Total cobrado: {:.2} CUP", summary.total_paid),
        &format!("Pendiente: {:.2} CUP", summary.total_pending),
    ];
    let mut y = 280.0_f32;
    for line in lines {
        current_layer.use_text(line, 12.0, Mm(15.0), Mm(y), &font);
        y -= 8.0;
    }

    doc.save(&mut std::io::BufWriter::new(
        std::fs::File::create(&path).map_err(|e| e.to_string())?,
    ))
    .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

/// Exports clients with balance to CSV, XLSX or PDF.
#[tauri::command]
pub async fn export_clients_report(app: tauri::AppHandle, format: String) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let debtors = reports_top_debtors(Some(500))?;
    let fmt = format.trim().to_lowercase();

    if fmt == "csv" {
        let dest = app
            .dialog()
            .file()
            .add_filter("CSV", &["csv"])
            .set_file_name("clientes.csv")
            .blocking_save_file()
            .ok_or_else(|| "Exportación cancelada".to_string())?;
        let path = dest.into_path().map_err(|e| e.to_string())?;
        let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;
        wtr.write_record(["codigo", "nombre", "balance"])
            .map_err(|e| e.to_string())?;
        for d in &debtors {
            wtr.write_record([&d.client_code, &d.client_name, &d.balance.to_string()])
                .map_err(|e| e.to_string())?;
        }
        wtr.flush().map_err(|e| e.to_string())?;
        return Ok(path.to_string_lossy().to_string());
    }

    if fmt == "xlsx" {
        use rust_xlsxwriter::Workbook;
        let dest = app
            .dialog()
            .file()
            .add_filter("Excel", &["xlsx"])
            .set_file_name("clientes.xlsx")
            .blocking_save_file()
            .ok_or_else(|| "Exportación cancelada".to_string())?;
        let path = dest.into_path().map_err(|e| e.to_string())?;
        let mut workbook = Workbook::new();
        let sheet = workbook.add_worksheet();
        sheet.write_string(0, 0, "Codigo").map_err(|e| e.to_string())?;
        sheet.write_string(0, 1, "Nombre").map_err(|e| e.to_string())?;
        sheet.write_string(0, 2, "Balance").map_err(|e| e.to_string())?;
        for (i, d) in debtors.iter().enumerate() {
            let r = (i + 1) as u32;
            sheet.write_string(r, 0, &d.client_code).map_err(|e| e.to_string())?;
            sheet.write_string(r, 1, &d.client_name).map_err(|e| e.to_string())?;
            sheet.write_number(r, 2, d.balance).map_err(|e| e.to_string())?;
        }
        workbook.save(&path).map_err(|e| e.to_string())?;
        return Ok(path.to_string_lossy().to_string());
    }

    if fmt == "pdf" {
        use printpdf::*;
        let dest = app
            .dialog()
            .file()
            .add_filter("PDF", &["pdf"])
            .set_file_name("clientes.pdf")
            .blocking_save_file()
            .ok_or_else(|| "Exportación cancelada".to_string())?;
        let path = dest.into_path().map_err(|e| e.to_string())?;
        let (doc, page1, layer1) =
            PdfDocument::new("Clientes", Mm(210.0), Mm(297.0), "Layer 1");
        let font = doc
            .add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| e.to_string())?;
        let layer = doc.get_page(page1).get_layer(layer1);
        let mut y = 280.0_f32;
        layer.use_text("Clientes con saldo", 14.0, Mm(15.0), Mm(y), &font);
        y -= 10.0;
        for d in debtors.iter().take(40) {
            let line = format!("{} - {}: {:.2}", d.client_code, d.client_name, d.balance);
            layer.use_text(&line, 10.0, Mm(15.0), Mm(y), &font);
            y -= 6.0;
            if y < 20.0 {
                break;
            }
        }
        doc.save(&mut std::io::BufWriter::new(
            std::fs::File::create(&path).map_err(|e| e.to_string())?,
        ))
        .map_err(|e| e.to_string())?;
        return Ok(path.to_string_lossy().to_string());
    }

    Err("Formato no soportado. Use csv, xlsx o pdf.".to_string())
}

/// Exports cash transactions in a date range.
#[tauri::command]
pub async fn export_cashflow_report(
    app: tauri::AppHandle,
    format: String,
    date_from: String,
    date_to: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT date, type, concept, amount_cup, amount_usd, payment_method
             FROM cash_transactions
             WHERE date >= ?1 AND date <= ?2
             ORDER BY date DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![date_from, date_to], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let fmt = format.trim().to_lowercase();
    let dest = app
        .dialog()
        .file()
        .add_filter(
            if fmt == "xlsx" { "Excel" } else if fmt == "pdf" { "PDF" } else { "CSV" },
            if fmt == "xlsx" {
                &["xlsx"][..]
            } else if fmt == "pdf" {
                &["pdf"][..]
            } else {
                &["csv"][..]
            },
        )
        .set_file_name(format!("caja.{}", if fmt == "xlsx" { "xlsx" } else if fmt == "pdf" { "pdf" } else { "csv" }))
        .blocking_save_file()
        .ok_or_else(|| "Exportación cancelada".to_string())?;
    let path = dest.into_path().map_err(|e| e.to_string())?;

    if fmt == "xlsx" {
        use rust_xlsxwriter::Workbook;
        let mut workbook = Workbook::new();
        let sheet = workbook.add_worksheet();
        sheet.write_string(0, 0, "Fecha").map_err(|e| e.to_string())?;
        sheet.write_string(0, 1, "Tipo").map_err(|e| e.to_string())?;
        sheet.write_string(0, 2, "Concepto").map_err(|e| e.to_string())?;
        sheet.write_string(0, 3, "CUP").map_err(|e| e.to_string())?;
        for (i, row) in rows.iter().enumerate() {
            let r = (i + 1) as u32;
            sheet.write_string(r, 0, &row.0).map_err(|e| e.to_string())?;
            sheet.write_string(r, 1, &row.1).map_err(|e| e.to_string())?;
            sheet.write_string(r, 2, &row.2).map_err(|e| e.to_string())?;
            sheet.write_number(r, 3, row.3).map_err(|e| e.to_string())?;
        }
        workbook.save(&path).map_err(|e| e.to_string())?;
    } else {
        let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;
        wtr.write_record(["fecha", "tipo", "concepto", "cup", "usd", "metodo"])
            .map_err(|e| e.to_string())?;
        for row in &rows {
            wtr.write_record([
                &row.0,
                &row.1,
                &row.2,
                &row.3.to_string(),
                &row.4.to_string(),
                &row.5,
            ])
            .map_err(|e| e.to_string())?;
        }
        wtr.flush().map_err(|e| e.to_string())?;
    }

    Ok(path.to_string_lossy().to_string())
}
