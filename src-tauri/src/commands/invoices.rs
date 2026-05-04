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
            "SELECT i.id, i.invoice_number, i.client_id, c.name, i.date, i.total, i.paid, i.balance, i.status
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
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Loads invoice header and line items.
#[tauri::command]
pub fn invoices_get_detail(id: i64) -> Result<InvoiceDetailDto, String> {
    let conn = db::open_connection()?;
    let header = conn
        .query_row(
            "SELECT i.id, i.invoice_number, i.client_id, c.name, i.date, i.subtotal, i.advance_payment, i.previous_debt,
                    i.total, i.paid, i.balance, i.status, i.notes
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
                    notes: row.get(12)?,
                })
            },
        )
        .map_err(|_| "Factura no encontrada".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT ii.id, ii.category_id, pc.name, ii.format_id, f.label, ii.finish, ii.service, ii.quantity, ii.unit_price, ii.subtotal
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

    let invoice_number = next_invoice_number(&tx, &year)?;
    let status = compute_invoice_status(balance, payload.paid);
    let notes = trim_notes(payload.notes);

    let new_balance = previous_debt + subtotal - payload.advance_payment - payload.paid;

    tx.execute(
        "INSERT INTO invoices (invoice_number, client_id, date, subtotal, advance_payment, previous_debt, total, paid, balance, status, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
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
        tx.execute(
            "INSERT INTO invoice_items (invoice_id, category_id, format_id, finish, service, quantity, unit_price, subtotal)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                invoice_id,
                item.category_id,
                item.format_id,
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
