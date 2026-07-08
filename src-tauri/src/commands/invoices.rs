//! Invoice commands: list, detail, create with line items (SQLite transactions).

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::commands::categories::category_display_name;
use crate::commands::cashier::{apply_invoice_payment_in_tx, record_advance_payment_in_tx, InitialPaymentPayload};
use crate::commands::inventory::deduct_inventory_for_invoice;
use crate::db;

const EPS: f64 = 1e-6;

/// Row for invoice list screens.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceListDto {
    pub id: i64,
    pub invoice_number: String,
    pub client_id: i64,
    pub client_name: String,
    pub date: String,
    pub total: f64,
    pub paid: f64,
    pub balance: f64,
    pub status: String,
    pub production_status: String,
    pub payment_status: String,
}

/// Invoice header for detail view.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceHeaderDto {
    pub id: i64,
    pub invoice_number: String,
    pub client_id: i64,
    pub client_name: String,
    pub date: String,
    pub subtotal: f64,
    pub advance_payment: f64,
    pub previous_debt: f64,
    pub total: f64,
    pub paid: f64,
    pub balance: f64,
    pub status: String,
    pub production_status: String,
    pub payment_status: String,
    pub payment_method: Option<String>,
    pub payment_currency: Option<String>,
    pub exchange_rate_snapshot: Option<f64>,
    pub amount_usd: f64,
    pub amount_cup: f64,
    pub notes: Option<String>,
    pub cancelled_at: Option<String>,
    pub cancelled_reason: Option<String>,
}

/// Invoice line with joined labels.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItemDto {
    pub id: i64,
    pub category_id: i64,
    pub category_name: String,
    pub format_id: Option<i64>,
    pub format_label: Option<String>,
    pub finish: Option<String>,
    pub service: Option<String>,
    pub quantity: i64,
    pub unit_price: f64,
    pub subtotal: f64,
}

/// Full invoice payload returned to the UI.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceDetailDto {
    pub invoice: InvoiceHeaderDto,
    pub items: Vec<InvoiceItemDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceItemPayload {
    pub category_id: i64,
    pub format_id: Option<i64>,
    pub finish: Option<String>,
    pub service: Option<String>,
    pub quantity: i64,
    pub unit_price: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoicePayload {
    pub client_id: i64,
    pub date: String,
    pub notes: Option<String>,
    pub advance_payment: f64,
    pub paid: f64,
    pub payment_method: String,
    pub payment_currency: String,
    pub exchange_rate_snapshot: f64,
    pub transfer_concept: Option<String>,
    pub initial_payment: Option<InitialPaymentPayload>,
    pub items: Vec<CreateInvoiceItemPayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceResponse {
    pub id: i64,
    pub invoice_number: String,
}

fn trim_notes(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

fn trim_optional(value: &Option<String>) -> Option<String> {
    value.as_ref().and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

fn compute_invoice_status(balance: f64, paid: f64) -> String {
    const EPS: f64 = 1e-6;
    if balance <= EPS {
        "paid".to_string()
    } else if paid <= EPS {
        "pending".to_string()
    } else {
        "partial".to_string()
    }
}

fn next_invoice_number(tx: &rusqlite::Transaction<'_>, year: &str) -> Result<String, String> {
    let pattern = format!("FAC-{}-%", year);
    let count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE ?1 AND deleted_at IS NULL",
            params![pattern],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let seq = count + 1;
    if seq > 999 {
        return Err("Se excedio el limite de numeracion diaria/anual".to_string());
    }
    Ok(format!("FAC-{}-{:03}", year, seq))
}

/// Lists invoices with client name, newest first.
#[tauri::command]
pub fn invoices_list() -> Result<Vec<InvoiceListDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.client_id, c.name, i.date, i.total, i.paid, i.balance, i.status,
                    i.production_status, i.payment_status
             FROM invoices i
             JOIN clients c ON c.id = i.client_id
             WHERE i.deleted_at IS NULL AND i.cancelled_at IS NULL
             ORDER BY i.date DESC, i.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(InvoiceListDto {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                client_id: row.get(2)?,
                client_name: row.get(3)?,
                date: row.get(4)?,
                total: row.get(5)?,
                paid: row.get(6)?,
                balance: row.get(7)?,
                status: row.get(8)?,
                production_status: row.get(9)?,
                payment_status: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Lists invoices for the financial module, including cancelled rows.
#[tauri::command]
pub fn invoices_financial_list() -> Result<Vec<InvoiceListDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.invoice_number, i.client_id, c.name, i.date, i.total, i.paid, i.balance, i.status,
                    i.production_status, i.payment_status
             FROM invoices i
             JOIN clients c ON c.id = i.client_id
             WHERE i.deleted_at IS NULL
             ORDER BY i.date DESC, i.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(InvoiceListDto {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                client_id: row.get(2)?,
                client_name: row.get(3)?,
                date: row.get(4)?,
                total: row.get(5)?,
                paid: row.get(6)?,
                balance: row.get(7)?,
                status: row.get(8)?,
                production_status: row.get(9)?,
                payment_status: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn sync_legacy_status(production: &str, payment: &str, balance: f64, paid: f64) -> String {
    if payment == "cobrado" || balance <= 1e-6 {
        "paid".to_string()
    } else if paid > 1e-6 {
        "partial".to_string()
    } else if production == "listo" {
        "partial".to_string()
    } else {
        "pending".to_string()
    }
}

/// Updates production status of an invoice.
#[tauri::command]
pub fn invoices_update_production_status(id: i64, status: String) -> Result<InvoiceHeaderDto, String> {
    let status = status.trim().to_lowercase();
    if status != "en_produccion" && status != "listo" {
        return Err("Estado de producción inválido".to_string());
    }
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (balance, paid, payment_status, invoice_number): (f64, f64, String, String) = tx
        .query_row(
            "SELECT balance, paid, payment_status, invoice_number FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;
    let legacy = sync_legacy_status(&status, &payment_status, balance, paid);

    if status == "listo" {
        deduct_inventory_for_invoice(&tx, id, &invoice_number)?;
        tx.execute(
            "UPDATE invoices SET production_status = ?1, status = ?2,
             production_completed_at = COALESCE(production_completed_at, datetime('now'))
             WHERE id = ?3",
            params![status, legacy, id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "UPDATE invoices SET production_status = ?1, status = ?2 WHERE id = ?3",
            params![status, legacy, id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    invoices_get_detail(id).map(|d| d.invoice)
}

/// Updates payment status of an invoice.
#[tauri::command]
pub fn invoices_update_payment_status(id: i64, status: String) -> Result<InvoiceHeaderDto, String> {
    let status = status.trim().to_lowercase();
    if status != "pendiente" && status != "cobrado" {
        return Err("Estado de cobro inválido".to_string());
    }
    let conn = db::open_connection()?;
    let (balance, paid, production_status): (f64, f64, String) = conn
        .query_row(
            "SELECT balance, paid, production_status FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;
    let legacy = sync_legacy_status(&production_status, &status, balance, paid);
    conn.execute(
        "UPDATE invoices SET payment_status = ?1, status = ?2 WHERE id = ?3",
        params![status, legacy, id],
    )
    .map_err(|e| e.to_string())?;
    invoices_get_detail(id).map(|d| d.invoice)
}

/// Loads invoice header and line items.
#[tauri::command]
pub fn invoices_get_detail(id: i64) -> Result<InvoiceDetailDto, String> {
    let conn = db::open_connection()?;
    let header = conn
        .query_row(
            "SELECT i.id, i.invoice_number, i.client_id, c.name, i.date, i.subtotal, i.advance_payment, i.previous_debt,
                    i.total, i.paid, i.balance, i.status, i.production_status, i.payment_status,
                    i.payment_method, i.payment_currency,
                    i.exchange_rate_snapshot, i.amount_usd, i.amount_cup, i.notes,
                    i.cancelled_at, i.cancelled_reason
             FROM invoices i
             JOIN clients c ON c.id = i.client_id
             WHERE i.id = ?1 AND i.deleted_at IS NULL",
            params![id],
            |row| {
                Ok(InvoiceHeaderDto {
                    id: row.get(0)?,
                    invoice_number: row.get(1)?,
                    client_id: row.get(2)?,
                    client_name: row.get(3)?,
                    date: row.get(4)?,
                    subtotal: row.get(5)?,
                    advance_payment: row.get(6)?,
                    previous_debt: row.get(7)?,
                    total: row.get(8)?,
                    paid: row.get(9)?,
                    balance: row.get(10)?,
                    status: row.get(11)?,
                    production_status: row.get(12)?,
                    payment_status: row.get(13)?,
                    payment_method: row.get(14)?,
                    payment_currency: row.get(15)?,
                    exchange_rate_snapshot: row.get(16)?,
                    amount_usd: row.get(17)?,
                    amount_cup: row.get(18)?,
                    notes: row.get(19)?,
                    cancelled_at: row.get(20)?,
                    cancelled_reason: row.get(21)?,
                })
            },
        )
        .map_err(|_| "Factura no encontrada".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT ii.id, ii.category_id,
                    COALESCE(ii.category_snapshot, NULLIF(trim(pc.label_es), ''), pc.name),
                    ii.format_id,
                    COALESCE(ii.format_label_snapshot, f.label) AS format_label,
                    ii.finish, ii.service, ii.quantity, ii.unit_price, ii.subtotal
             FROM invoice_items ii
             JOIN product_categories pc ON pc.id = ii.category_id
             LEFT JOIN formats f ON f.id = ii.format_id
             WHERE ii.invoice_id = ?1
             ORDER BY ii.id",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![id], |row| {
            Ok(InvoiceItemDto {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                format_id: row.get(3)?,
                format_label: row.get(4)?,
                finish: row.get(5)?,
                service: row.get(6)?,
                quantity: row.get(7)?,
                unit_price: row.get(8)?,
                subtotal: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(InvoiceDetailDto {
        invoice: header,
        items,
    })
}

/// Creates an invoice with line items and updates the client balance snapshot.
#[tauri::command]
pub fn invoices_create(payload: CreateInvoicePayload) -> Result<CreateInvoiceResponse, String> {
    if payload.items.is_empty() {
        return Err("La factura debe tener al menos una linea".to_string());
    }
    if payload.advance_payment < 0.0 || payload.paid < 0.0 {
        return Err("Anticipado y pagado no pueden ser negativos".to_string());
    }

    let date_trim = payload.date.trim().to_string();
    if date_trim.len() < 4 {
        return Err("Fecha invalida".to_string());
    }
    let year = date_trim[0..4].to_string();

    for item in &payload.items {
        if item.quantity <= 0 {
            return Err("Cada linea debe tener cantidad mayor que cero".to_string());
        }
        if item.unit_price < 0.0 {
            return Err("El precio unitario no puede ser negativo".to_string());
        }
    }

    if payload.paid > EPS && payload.initial_payment.is_none() {
        return Err("Para registrar cobro en caja use initial_payment".to_string());
    }

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let previous_debt: f64 = tx
        .query_row(
            "SELECT balance FROM clients WHERE id = ?1 AND deleted_at IS NULL",
            params![payload.client_id],
            |row| row.get(0),
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    let mut subtotal = 0.0_f64;
    for item in &payload.items {
        let line = (item.quantity as f64) * item.unit_price;
        subtotal += line;
    }

    let total = subtotal - payload.advance_payment;
    let balance = total;
    if total < -1e-6 {
        return Err("El total calculado no puede ser negativo".to_string());
    }
    if payload.initial_payment.is_some() && total <= EPS {
        return Err("No hay saldo pendiente para cobrar en este pedido".to_string());
    }

    let payment_method = payload.payment_method.trim().to_lowercase();
    if payment_method != "efectivo" && payment_method != "transferencia" {
        return Err("Método de pago inválido".to_string());
    }
    let mut payment_currency = payload.payment_currency.trim().to_uppercase();
    if payment_method == "transferencia" {
        payment_currency = "CUP".to_string();
    }
    if payment_currency != "CUP" && payment_currency != "USD" {
        return Err("Moneda de pago inválida".to_string());
    }
    let exchange_rate = if payment_currency == "USD" {
        if payload.exchange_rate_snapshot <= 0.0 {
            return Err("La tasa de cambio debe ser mayor que cero".to_string());
        }
        payload.exchange_rate_snapshot
    } else {
        0.0
    };
    let amount_cup = total.max(0.0);
    let amount_usd = if payment_currency == "USD" && exchange_rate > 0.0 {
        amount_cup / exchange_rate
    } else {
        0.0
    };

    let invoice_number = next_invoice_number(&tx, &year)?;
    let status = compute_invoice_status(balance, 0.0);
    let production_status = "en_produccion";
    let payment_status = if balance <= EPS { "cobrado" } else { "pendiente" };
    let mut notes = trim_notes(payload.notes);
    if payment_method == "transferencia" {
        if let Some(concept) = trim_notes(payload.transfer_concept) {
            let extra = format!("Ref. transferencia: {}", concept);
            notes = Some(match notes {
                Some(n) => format!("{}\n{}", n, extra),
                None => extra,
            });
        }
    }

    let new_balance = previous_debt + subtotal - payload.advance_payment;

    tx.execute(
        "INSERT INTO invoices (invoice_number, client_id, date, subtotal, advance_payment, previous_debt, total, paid, balance, status,
         production_status, payment_status, payment_method, payment_currency, exchange_rate_snapshot, amount_usd, amount_cup, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            invoice_number,
            payload.client_id,
            date_trim,
            subtotal,
            payload.advance_payment,
            previous_debt,
            total,
            balance,
            status,
            production_status,
            payment_status,
            payment_method,
            payment_currency,
            exchange_rate,
            amount_usd,
            amount_cup,
            notes
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Numero de factura duplicado, reintenta".to_string()
        } else {
            e.to_string()
        }
    })?;

    let invoice_id = tx.last_insert_rowid();

    for item in &payload.items {
        let line_subtotal = (item.quantity as f64) * item.unit_price;
        let finish = trim_optional(&item.finish);
        let service = trim_optional(&item.service);
        let format_label: Option<String> = if let Some(fid) = item.format_id {
            tx.query_row(
                "SELECT label FROM formats WHERE id = ?1",
                params![fid],
                |row| row.get(0),
            )
            .ok()
        } else {
            None
        };
        let category_snapshot = category_display_name(&tx, item.category_id)?;
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, category_id, category_snapshot, format_id, format_label_snapshot, finish, service, quantity, unit_price, subtotal)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                invoice_id,
                item.category_id,
                category_snapshot,
                item.format_id,
                format_label,
                finish,
                service,
                item.quantity,
                item.unit_price,
                line_subtotal
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "UPDATE clients SET balance = ?1, updated_at = datetime('now') WHERE id = ?2 AND deleted_at IS NULL",
        params![new_balance, payload.client_id],
    )
    .map_err(|e| e.to_string())?;

    record_advance_payment_in_tx(
        &tx,
        invoice_id,
        &invoice_number,
        payload.advance_payment,
        &payment_method,
    )?;

    if let Some(initial_payment) = payload.initial_payment {
        apply_invoice_payment_in_tx(&tx, &initial_payment.into_register(invoice_id))?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(CreateInvoiceResponse {
        id: invoice_id,
        invoice_number,
    })
}

/// Exports a single invoice as a simple PDF file.
#[tauri::command]
pub async fn export_invoice_pdf(app: tauri::AppHandle, id: i64) -> Result<String, String> {
    use printpdf::*;
    use tauri_plugin_dialog::DialogExt;

    let detail = invoices_get_detail(id)?;
    let inv = detail.invoice;

    let dest = app
        .dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .set_file_name(format!("{}.pdf", inv.invoice_number))
        .blocking_save_file()
        .ok_or_else(|| "Exportación cancelada".to_string())?;
    let path = dest.into_path().map_err(|e| e.to_string())?;

    let (doc, page1, layer1) =
        PdfDocument::new(&inv.invoice_number, Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let layer = doc.get_page(page1).get_layer(layer1);

    let mut y = 280.0_f32;
    let header_lines = [
        format!("PEDIDO {}", inv.invoice_number),
        format!("Cliente: {}", inv.client_name),
        format!("Fecha: {}", inv.date),
        format!("Produccion: {}", inv.production_status),
        format!("Cobro: {}", inv.payment_status),
        format!("Total: {:.2} CUP", inv.total),
        format!("Pagado: {:.2} CUP", inv.paid),
        format!("Pendiente: {:.2} CUP", inv.balance),
    ];
    for line in header_lines {
        layer.use_text(&line, 11.0, Mm(15.0), Mm(y), &font);
        y -= 7.0;
    }
    y -= 5.0;
    layer.use_text("DETALLE", 12.0, Mm(15.0), Mm(y), &font);
    y -= 8.0;
    for item in detail.items.iter().take(25) {
        let label = item
            .format_label
            .as_deref()
            .or(item.service.as_deref())
            .unwrap_or("-");
        let line = format!(
            "{} x{} @ {:.2} = {:.2}",
            label, item.quantity, item.unit_price, item.subtotal
        );
        layer.use_text(&line, 9.0, Mm(15.0), Mm(y), &font);
        y -= 6.0;
        if y < 15.0 {
            break;
        }
    }

    doc.save(&mut std::io::BufWriter::new(
        std::fs::File::create(&path).map_err(|e| e.to_string())?,
    ))
    .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

/// Payment row for invoice financial detail.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoicePaymentHistoryRow {
    pub id: i64,
    pub date: String,
    pub concept: String,
    pub amount_cup: f64,
    pub amount_usd: f64,
    pub payment_method: String,
}

/// KPI metrics for the invoices module.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceMetricsDto {
    pub total_amount: f64,
    pub total_count: i64,
    pub cobradas_amount: f64,
    pub cobradas_count: i64,
    pub parciales_amount: f64,
    pub parciales_count: i64,
    pub pendientes_amount: f64,
    pub pendientes_count: i64,
    pub anuladas_count: i64,
}

/// Returns payment history from cash transactions linked to the invoice.
#[tauri::command]
pub fn get_invoice_payment_history(invoice_id: i64) -> Result<Vec<InvoicePaymentHistoryRow>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, date, concept, amount_cup, amount_usd, payment_method
             FROM cash_transactions
             WHERE reference_type = 'pedido' AND reference_id = ?1 AND type = 'ingreso'
             ORDER BY date DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![invoice_id], |row| {
            Ok(InvoicePaymentHistoryRow {
                id: row.get(0)?,
                date: row.get(1)?,
                concept: row.get(2)?,
                amount_cup: row.get(3)?,
                amount_usd: row.get(4)?,
                payment_method: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Aggregated financial metrics for invoice list KPI cards.
#[tauri::command]
pub fn get_invoice_metrics() -> Result<InvoiceMetricsDto, String> {
    let conn = db::open_connection()?;
    conn.query_row(
        "SELECT
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL THEN total ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL AND balance <= ?1 THEN total ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL AND balance <= ?1 THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL AND balance > ?1 AND paid > ?1 THEN balance ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL AND balance > ?1 AND paid > ?1 THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL AND paid <= ?1 AND balance > ?1 THEN balance ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NULL AND paid <= ?1 AND balance > ?1 THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN cancelled_at IS NOT NULL THEN 1 ELSE 0 END), 0)
         FROM invoices WHERE deleted_at IS NULL",
        params![EPS, EPS, EPS, EPS, EPS, EPS, EPS, EPS],
        |row| {
            Ok(InvoiceMetricsDto {
                total_amount: row.get(0)?,
                total_count: row.get(1)?,
                cobradas_amount: row.get(2)?,
                cobradas_count: row.get(3)?,
                parciales_amount: row.get(4)?,
                parciales_count: row.get(5)?,
                pendientes_amount: row.get(6)?,
                pendientes_count: row.get(7)?,
                anuladas_count: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Cancels an invoice with reason and reverses recorded payments in cash.
#[tauri::command]
pub fn cancel_invoice(invoice_id: i64, reason: String) -> Result<InvoiceHeaderDto, String> {
    let reason = reason.trim().to_string();
    if reason.is_empty() {
        return Err("El motivo de anulación es obligatorio".to_string());
    }
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let (invoice_number, payment_status, balance, _paid, cancelled_at): (
        String,
        String,
        f64,
        f64,
        Option<String>,
    ) = tx
        .query_row(
            "SELECT invoice_number, payment_status, balance, paid, cancelled_at
             FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![invoice_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|_| "Factura no encontrada".to_string())?;
    if cancelled_at.is_some() {
        return Err("La factura ya está anulada".to_string());
    }
    if payment_status == "cobrado" && balance <= EPS {
        return Err("No se puede anular una factura totalmente cobrada".to_string());
    }

    let payments: Vec<(i64, f64, f64, f64, String)> = {
        let mut stmt = tx
            .prepare(
                "SELECT id, amount_cup, amount_usd, exchange_rate, payment_method
                 FROM cash_transactions
                 WHERE reference_type = 'pedido' AND reference_id = ?1 AND type = 'ingreso'",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![invoice_id], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, f64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };

    for (_id, amount_cup, amount_usd, exchange_rate, payment_method) in payments {
        if amount_cup <= EPS && amount_usd <= EPS {
            continue;
        }
        tx.execute(
            "INSERT INTO cash_transactions
                (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate, payment_method, date)
             VALUES ('egreso', ?1, 'pedido', ?2, ?3, ?4, ?5, ?6, datetime('now'))",
            params![
                format!("Reverso anulación {}", invoice_number),
                invoice_id,
                amount_cup,
                amount_usd,
                exchange_rate,
                payment_method
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    let client_id: i64 = tx
        .query_row(
            "SELECT client_id FROM invoices WHERE id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE invoices SET status = 'anulada', payment_status = 'pendiente', paid = 0, balance = 0,
         cancelled_at = datetime('now'), cancelled_reason = ?1
         WHERE id = ?2",
        params![reason, invoice_id],
    )
    .map_err(|e| e.to_string())?;

    let new_client_balance: f64 = tx
        .query_row(
            "SELECT COALESCE(SUM(balance), 0) FROM invoices
             WHERE client_id = ?1 AND deleted_at IS NULL AND cancelled_at IS NULL",
            params![client_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE clients SET balance = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_client_balance, client_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    invoices_get_detail(invoice_id).map(|d| d.invoice)
}

