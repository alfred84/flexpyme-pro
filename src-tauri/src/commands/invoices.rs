//! Invoice commands: list, detail, create with line items (SQLite transactions).

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

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
    let conn = db::open_connection()?;
    let (balance, paid, payment_status): (f64, f64, String) = conn
        .query_row(
            "SELECT balance, paid, payment_status FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;
    let legacy = sync_legacy_status(&status, &payment_status, balance, paid);
    conn.execute(
        "UPDATE invoices SET production_status = ?1, status = ?2 WHERE id = ?3",
        params![status, legacy, id],
    )
    .map_err(|e| e.to_string())?;
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
                    i.exchange_rate_snapshot, i.amount_usd, i.amount_cup, i.notes
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
                })
            },
        )
        .map_err(|_| "Factura no encontrada".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT ii.id, ii.category_id, pc.name, ii.format_id,
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

    let total = subtotal + previous_debt - payload.advance_payment;
    let balance = total - payload.paid;
    if total < -1e-6 {
        return Err("El total calculado no puede ser negativo".to_string());
    }
    if payload.paid - total > 1e-6 {
        return Err("El pagado no puede ser mayor que el total".to_string());
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
    let status = compute_invoice_status(balance, payload.paid);
    let production_status = "en_produccion";
    let payment_status = if balance <= 1e-6 { "cobrado" } else { "pendiente" };
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

    let new_balance = previous_debt + subtotal - payload.advance_payment - payload.paid;

    tx.execute(
        "INSERT INTO invoices (invoice_number, client_id, date, subtotal, advance_payment, previous_debt, total, paid, balance, status,
         production_status, payment_status, payment_method, payment_currency, exchange_rate_snapshot, amount_usd, amount_cup, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
        params![
            invoice_number,
            payload.client_id,
            date_trim,
            subtotal,
            payload.advance_payment,
            previous_debt,
            total,
            payload.paid,
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
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, category_id, format_id, format_label_snapshot, finish, service, quantity, unit_price, subtotal)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                invoice_id,
                item.category_id,
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
