//! Production batch commands: list and create.

use std::collections::BTreeMap;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::commands::normalize_token;
use crate::db;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchListDto {
    pub id: i64,
    pub r#type: String,
    pub date: String,
    pub worker_name: Option<String>,
    pub total_cost: f64,
    pub paid: f64,
    pub pending: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionItemPayload {
    pub client_id: i64,
    pub format_id: Option<i64>,
    pub category: String,
    pub quantity: i64,
    pub unit_cost: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionBatchPayload {
    pub r#type: String,
    pub date: String,
    pub worker_name: Option<String>,
    pub paid: f64,
    pub notes: Option<String>,
    pub items: Vec<CreateProductionItemPayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionBatchResponse {
    pub id: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchHeaderDto {
    pub id: i64,
    pub r#type: String,
    pub date: String,
    pub worker_name: Option<String>,
    pub total_cost: f64,
    pub paid: f64,
    pub pending: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchLineDto {
    pub id: i64,
    pub client_id: i64,
    pub client_code: String,
    pub client_name: String,
    pub format_id: Option<i64>,
    pub format_label: Option<String>,
    pub category: String,
    pub quantity: i64,
    pub unit_cost: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchDetailDto {
    pub batch: ProductionBatchHeaderDto,
    pub items: Vec<ProductionBatchLineDto>,
}

/// Batch header row for CSV / report range export (no line items).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchInRangeDto {
    pub id: i64,
    pub r#type: String,
    pub date: String,
    pub worker_name: Option<String>,
    pub total_cost: f64,
    pub paid: f64,
    pub pending: f64,
    pub notes: Option<String>,
}

/// One production line with batch context (for range export).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionLineInRangeDto {
    pub batch_id: i64,
    pub batch_date: String,
    pub batch_type: String,
    pub worker_name: Option<String>,
    pub line_id: i64,
    pub client_code: String,
    pub client_name: String,
    pub format_label: Option<String>,
    pub category: String,
    pub quantity: i64,
    pub unit_cost: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionRangeExportDto {
    pub batches: Vec<ProductionBatchInRangeDto>,
    pub lines: Vec<ProductionLineInRangeDto>,
}

/// One format row within an area of the monthly production report.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionFormatRowDto {
    pub format_label: String,
    pub pedido_qty: i64,
    pub realizado_qty: i64,
    pub pendiente_qty: i64,
    /// Importe de venta en CUP (libro: `subtotal`).
    pub pedido_amount: f64,
    /// Importe de venta en USD (`unit_price_usd × cantidad`).
    pub pedido_amount_usd: f64,
    pub salario_amount: f64,
}

/// Aggregated report for one area (Impresión, Laminado, Enmarcado...).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionAreaReportDto {
    pub area: String,
    pub rows: Vec<ProductionFormatRowDto>,
    pub pedido_qty: i64,
    pub realizado_qty: i64,
    pub pendiente_qty: i64,
    /// Importe de venta en CUP (libro).
    pub pedido_amount: f64,
    /// Importe de venta en USD.
    pub pedido_amount_usd: f64,
    pub salario_amount: f64,
    /// Margen CUP: factura CUP − salario CUP.
    pub diferencia: f64,
}

/// Realizado quantity for one day and area (daily production control).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionDailyDto {
    pub date: String,
    pub area: String,
    pub realizado_qty: i64,
}

/// Production report: areas with format rows and a daily series for a date range.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionReportDto {
    /// Mes `YYYY-MM` cuando el rango es un mes calendario; vacío en otro caso.
    pub month: String,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub areas: Vec<ProductionAreaReportDto>,
    pub daily: Vec<ProductionDailyDto>,
}

/// Rango opcional para el reporte de producción (`None` = histórico completo).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionReportArgs {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

#[derive(Default)]
struct FormatAgg {
    pedido_qty: i64,
    realizado_qty: i64,
    pedido_amount: f64,
    pedido_amount_usd: f64,
    salario_amount: f64,
}

#[derive(Default)]
struct AreaAgg {
    display: String,
    formats: BTreeMap<String, FormatAgg>,
}

fn normalize_optional_iso(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.len() >= 10 {
            Some(t[..10].to_string())
        } else if t.is_empty() {
            None
        } else {
            None
        }
    })
}

fn last_day_of_month_iso(year_month: &str) -> Result<String, String> {
    let y: i32 = year_month[0..4]
        .parse()
        .map_err(|_| "Mes inválido (formato YYYY-MM)".to_string())?;
    let m: u32 = year_month[5..7]
        .parse()
        .map_err(|_| "Mes inválido (formato YYYY-MM)".to_string())?;
    let last = days_in_month(y, m)?;
    Ok(format!("{:04}-{:02}-{:02}", y, m, last))
}

fn days_in_month(year: i32, month: u32) -> Result<u32, String> {
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
            if leap {
                29
            } else {
                28
            }
        }
        _ => return Err("Mes inválido".to_string()),
    };
    Ok(days)
}

fn month_label_for_range(from: &Option<String>, to: &Option<String>) -> String {
    match (from, to) {
        (Some(f), Some(t)) if f.len() >= 7 && t.len() >= 7 && f[..7] == t[..7] && f.ends_with("-01") => {
            f[..7].to_string()
        }
        (Some(f), Some(t)) if f.len() >= 7 && t.len() >= 7 && f[..7] == t[..7] => f[..7].to_string(),
        _ => String::new(),
    }
}

/// Reporte de producción por área/formato en un rango (o histórico completo).
///
/// "Realizado" proviene de lotes ligados a pedidos; "Pedido" de las líneas
/// de factura con `service` en el rango.
#[tauri::command]
pub fn production_report(args: ProductionReportArgs) -> Result<ProductionReportDto, String> {
    let date_from = normalize_optional_iso(args.date_from);
    let date_to = normalize_optional_iso(args.date_to);
    let conn = db::open_connection()?;
    let mut areas: BTreeMap<String, AreaAgg> = BTreeMap::new();

    {
        let mut stmt = conn
            .prepare(
                "SELECT ii.service,
                        COALESCE(ii.format_label_snapshot, f.label, '(sin formato)') AS fmt,
                        COALESCE(SUM(ii.quantity), 0),
                        COALESCE(SUM(ii.subtotal), 0),
                        COALESCE(SUM(COALESCE(ii.unit_price_usd, 0) * ii.quantity), 0)
                 FROM invoice_items ii
                 JOIN invoices i ON i.id = ii.invoice_id
                 LEFT JOIN formats f ON f.id = ii.format_id
                 WHERE i.deleted_at IS NULL AND i.cancelled_at IS NULL
                   AND (?1 IS NULL OR substr(i.date, 1, 10) >= ?1)
                   AND (?2 IS NULL OR substr(i.date, 1, 10) <= ?2)
                   AND ii.service IS NOT NULL AND trim(ii.service) <> ''
                 GROUP BY ii.service, fmt",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![date_from, date_to], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, f64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for (service, fmt, qty, amount_cup, amount_usd) in rows {
            let key = normalize_token(&service);
            let area = areas.entry(key).or_default();
            if area.display.is_empty() {
                area.display = service.trim().to_string();
            }
            let f = area.formats.entry(fmt).or_default();
            f.pedido_qty += qty;
            f.pedido_amount += amount_cup;
            f.pedido_amount_usd += amount_usd;
        }
    }

    {
        let mut stmt = conn
            .prepare(
                "SELECT pbi.category,
                        COALESCE(f.label, '(sin formato)') AS fmt,
                        COALESCE(SUM(pbi.quantity), 0),
                        COALESCE(SUM(pbi.subtotal), 0)
                 FROM production_batch_items pbi
                 JOIN production_batches pb ON pb.id = pbi.batch_id
                 LEFT JOIN formats f ON f.id = pbi.format_id
                 WHERE pbi.invoice_id IS NOT NULL
                   AND (?1 IS NULL OR substr(pb.date, 1, 10) >= ?1)
                   AND (?2 IS NULL OR substr(pb.date, 1, 10) <= ?2)
                 GROUP BY pbi.category, fmt",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![date_from, date_to], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, f64>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        for (category, fmt, qty, salario) in rows {
            let key = normalize_token(&category);
            let area = areas.entry(key).or_default();
            if area.display.is_empty() {
                area.display = category.trim().to_string();
            }
            let f = area.formats.entry(fmt).or_default();
            f.realizado_qty += qty;
            f.salario_amount += salario;
        }
    }

    let area_reports = areas
        .into_values()
        .map(|agg| {
            let mut rows = Vec::new();
            let mut a_pedido = 0;
            let mut a_realizado = 0;
            let mut a_amount = 0.0;
            let mut a_amount_usd = 0.0;
            let mut a_salario = 0.0;
            for (fmt, f) in agg.formats {
                let pendiente = (f.pedido_qty - f.realizado_qty).max(0);
                a_pedido += f.pedido_qty;
                a_realizado += f.realizado_qty;
                a_amount += f.pedido_amount;
                a_amount_usd += f.pedido_amount_usd;
                a_salario += f.salario_amount;
                rows.push(ProductionFormatRowDto {
                    format_label: fmt,
                    pedido_qty: f.pedido_qty,
                    realizado_qty: f.realizado_qty,
                    pendiente_qty: pendiente,
                    pedido_amount: f.pedido_amount,
                    pedido_amount_usd: f.pedido_amount_usd,
                    salario_amount: f.salario_amount,
                });
            }
            ProductionAreaReportDto {
                area: agg.display,
                rows,
                pedido_qty: a_pedido,
                realizado_qty: a_realizado,
                pendiente_qty: (a_pedido - a_realizado).max(0),
                pedido_amount: a_amount,
                pedido_amount_usd: a_amount_usd,
                salario_amount: a_salario,
                diferencia: a_amount - a_salario,
            }
        })
        .collect::<Vec<_>>();

    let daily = {
        let mut stmt = conn
            .prepare(
                "SELECT substr(pb.date, 1, 10), pbi.category, COALESCE(SUM(pbi.quantity), 0)
                 FROM production_batch_items pbi
                 JOIN production_batches pb ON pb.id = pbi.batch_id
                 WHERE pbi.invoice_id IS NOT NULL
                   AND (?1 IS NULL OR substr(pb.date, 1, 10) >= ?1)
                   AND (?2 IS NULL OR substr(pb.date, 1, 10) <= ?2)
                 GROUP BY substr(pb.date, 1, 10), pbi.category
                 ORDER BY 1",
            )
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_map(params![date_from, date_to], |row| {
                Ok(ProductionDailyDto {
                    date: row.get(0)?,
                    area: row.get(1)?,
                    realizado_qty: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        result
    };

    Ok(ProductionReportDto {
        month: month_label_for_range(&date_from, &date_to),
        date_from,
        date_to,
        areas: area_reports,
        daily,
    })
}

/// Envoltorio mensual: `YYYY-MM` → primer/último día del mes.
#[tauri::command]
pub fn production_report_monthly(month: String) -> Result<ProductionReportDto, String> {
    let month = month.trim().to_string();
    if month.len() != 7 {
        return Err("Mes inválido (formato YYYY-MM)".to_string());
    }
    let date_from = format!("{}-01", month);
    let date_to = last_day_of_month_iso(&month)?;
    production_report(ProductionReportArgs {
        date_from: Some(date_from),
        date_to: Some(date_to),
    })
}

fn trim_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

#[tauri::command]
pub fn production_list() -> Result<Vec<ProductionBatchListDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, type, date, worker_name, total_cost, paid
             FROM production_batches
             ORDER BY date DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let total_cost: f64 = row.get(4)?;
            let paid: f64 = row.get(5)?;
            Ok(ProductionBatchListDto {
                id: row.get(0)?,
                r#type: row.get(1)?,
                date: row.get(2)?,
                worker_name: row.get(3)?,
                total_cost,
                paid,
                pending: (total_cost - paid).max(0.0),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Loads one production batch with line items (client and format labels).
#[tauri::command]
pub fn production_get_detail(batch_id: i64) -> Result<ProductionBatchDetailDto, String> {
    let conn = db::open_connection()?;
    let header = conn
        .query_row(
            "SELECT id, type, date, worker_name, total_cost, paid, notes
             FROM production_batches WHERE id = ?1",
            params![batch_id],
            |row| {
                let total_cost: f64 = row.get(4)?;
                let paid: f64 = row.get(5)?;
                Ok(ProductionBatchHeaderDto {
                    id: row.get(0)?,
                    r#type: row.get(1)?,
                    date: row.get(2)?,
                    worker_name: row.get(3)?,
                    total_cost,
                    paid,
                    pending: (total_cost - paid).max(0.0),
                    notes: row.get(6)?,
                })
            },
        )
        .map_err(|_| "Lote no encontrado".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT pbi.id, pbi.client_id, c.code, c.name, pbi.format_id, f.label, pbi.category,
                    pbi.quantity, pbi.unit_cost, pbi.subtotal
             FROM production_batch_items pbi
             JOIN clients c ON c.id = pbi.client_id
             LEFT JOIN formats f ON f.id = pbi.format_id
             WHERE pbi.batch_id = ?1
             ORDER BY pbi.id",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![batch_id], |row| {
            Ok(ProductionBatchLineDto {
                id: row.get(0)?,
                client_id: row.get(1)?,
                client_code: row.get(2)?,
                client_name: row.get(3)?,
                format_id: row.get(4)?,
                format_label: row.get(5)?,
                category: row.get(6)?,
                quantity: row.get(7)?,
                unit_cost: row.get(8)?,
                subtotal: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ProductionBatchDetailDto { batch: header, items })
}

/// Batches dated in `[date_from, date_to]` plus all their line items (for report CSV).
#[tauri::command]
pub fn production_export_in_date_range(
    date_from: String,
    date_to: String,
) -> Result<ProductionRangeExportDto, String> {
    let from = date_from.trim();
    let to = date_to.trim();
    if from.is_empty() || to.is_empty() {
        return Err("Rango de fechas incompleto".to_string());
    }

    let conn = db::open_connection()?;

    let mut batches_stmt = conn
        .prepare(
            "SELECT id, type, date, worker_name, total_cost, paid, notes
             FROM production_batches
             WHERE date >= ?1 AND date <= ?2
             ORDER BY date ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let batches = batches_stmt
        .query_map(params![from, to], |row| {
            let total_cost: f64 = row.get(4)?;
            let paid: f64 = row.get(5)?;
            Ok(ProductionBatchInRangeDto {
                id: row.get(0)?,
                r#type: row.get(1)?,
                date: row.get(2)?,
                worker_name: row.get(3)?,
                total_cost,
                paid,
                pending: (total_cost - paid).max(0.0),
                notes: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut lines_stmt = conn
        .prepare(
            "SELECT pb.id, pb.date, pb.type, pb.worker_name, pbi.id, c.code, c.name, f.label,
                    pbi.category, pbi.quantity, pbi.unit_cost, pbi.subtotal
             FROM production_batch_items pbi
             JOIN production_batches pb ON pb.id = pbi.batch_id
             JOIN clients c ON c.id = pbi.client_id
             LEFT JOIN formats f ON f.id = pbi.format_id
             WHERE pb.date >= ?1 AND pb.date <= ?2
             ORDER BY pb.date ASC, pb.id ASC, pbi.id ASC",
        )
        .map_err(|e| e.to_string())?;
    let lines = lines_stmt
        .query_map(params![from, to], |row| {
            Ok(ProductionLineInRangeDto {
                batch_id: row.get(0)?,
                batch_date: row.get(1)?,
                batch_type: row.get(2)?,
                worker_name: row.get(3)?,
                line_id: row.get(4)?,
                client_code: row.get(5)?,
                client_name: row.get(6)?,
                format_label: row.get(7)?,
                category: row.get(8)?,
                quantity: row.get(9)?,
                unit_cost: row.get(10)?,
                subtotal: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ProductionRangeExportDto { batches, lines })
}

#[tauri::command]
pub fn production_create(
    payload: CreateProductionBatchPayload,
) -> Result<CreateProductionBatchResponse, String> {
    if payload.items.is_empty() {
        return Err("El lote debe tener al menos una linea".to_string());
    }
    if payload.paid < 0.0 {
        return Err("El pagado no puede ser negativo".to_string());
    }

    let batch_type = payload.r#type.trim().to_string();
    if batch_type.is_empty() {
        return Err("El tipo de lote es obligatorio".to_string());
    }

    let date = payload.date.trim().to_string();
    if date.is_empty() {
        return Err("La fecha es obligatoria".to_string());
    }

    for item in &payload.items {
        if item.category.trim().is_empty() {
            return Err("Cada linea debe tener categoria".to_string());
        }
        if item.quantity <= 0 {
            return Err("Cada linea debe tener cantidad mayor que cero".to_string());
        }
        if item.unit_cost < 0.0 {
            return Err("El costo unitario no puede ser negativo".to_string());
        }
    }

    let mut total_cost = 0.0_f64;
    for item in &payload.items {
        total_cost += (item.quantity as f64) * item.unit_cost;
    }
    if payload.paid - total_cost > 1e-6 {
        return Err("El pagado no puede ser mayor que el costo total".to_string());
    }

    let worker_name = trim_optional(payload.worker_name);
    let notes = trim_optional(payload.notes);

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO production_batches (type, date, worker_name, total_cost, paid, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![batch_type, date, worker_name, total_cost, payload.paid, notes],
    )
    .map_err(|e| e.to_string())?;
    let batch_id = tx.last_insert_rowid();

    for item in &payload.items {
        let exists: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM clients WHERE id = ?1 AND deleted_at IS NULL",
                params![item.client_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err("Cliente no encontrado en una linea".to_string());
        }

        let subtotal = (item.quantity as f64) * item.unit_cost;
        tx.execute(
            "INSERT INTO production_batch_items (batch_id, client_id, format_id, category, quantity, unit_cost, subtotal)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                batch_id,
                item.client_id,
                item.format_id,
                item.category.trim(),
                item.quantity,
                item.unit_cost,
                subtotal
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(CreateProductionBatchResponse { id: batch_id })
}
