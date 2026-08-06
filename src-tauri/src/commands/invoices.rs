//! Invoice commands: list, detail, create with line items (SQLite transactions).

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::commands::categories::category_display_name;
use crate::commands::cashier::{
    apply_client_credit_to_invoice_in_tx, apply_invoice_payment_in_tx, record_advance_payment_in_tx,
    AdvancePaymentPayload, InitialPaymentPayload,
};
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
    /// Moneda de cobro del pedido (`CUP` | `USD`), si se definió.
    pub payment_currency: Option<String>,
    /// Tasa USD→CUP guardada en el pedido (si hubo cobro/anticipo en USD).
    pub exchange_rate_snapshot: Option<f64>,
    pub can_edit: bool,
    pub can_cancel: bool,
    /// True si alguna línea abierta tiene material en déficit.
    pub resource_missing: bool,
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
    pub resource_missing: bool,
    pub cancelled_at: Option<String>,
    pub cancelled_reason: Option<String>,
}

/// Invoice line with joined labels.
#[derive(Debug, Serialize, Deserialize, Clone)]
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
    pub completed_quantity: i64,
    pub resource_missing: bool,
    pub resource_note: Option<String>,
    pub production_line_status: String,
    pub materials: Vec<InvoiceItemMaterialDto>,
    pub assignments: Vec<InvoiceItemAssignmentDto>,
}

/// Empleado asignado a una l?nea de pedido.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItemAssignmentDto {
    pub employee_id: i64,
    pub employee_name: String,
    pub custom_unit_cost: Option<f64>,
}

/// Asignaci?n entrante al crear/editar pedido.
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItemAssignmentInput {
    pub employee_id: i64,
    pub custom_unit_cost: Option<f64>,
}

/// Material fijado en una l?nea de pedido.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItemMaterialDto {
    pub inventory_item_id: i64,
    pub quantity_per_unit: f64,
    pub source: String,
    pub recipe_id: Option<i64>,
}

/// Full invoice payload returned to the UI.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceDetailDto {
    pub invoice: InvoiceHeaderDto,
    pub items: Vec<InvoiceItemDto>,
    pub can_edit: bool,
    pub can_cancel: bool,
    pub edit_block_reason: Option<String>,
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
    pub materials: Option<Vec<crate::commands::inventory::InvoiceItemMaterialInput>>,
    #[serde(default)]
    pub assignments: Option<Vec<InvoiceItemAssignmentInput>>,
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
    /// Detalle opcional del anticipo (método, moneda, denominaciones).
    pub advance_payment_detail: Option<AdvancePaymentPayload>,
    /// Aplicar saldo a favor del cliente al crear el pedido (default true).
    #[serde(default)]
    pub apply_client_credit: Option<bool>,
    pub initial_payment: Option<InitialPaymentPayload>,
    pub items: Vec<CreateInvoiceItemPayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceResponse {
    pub id: i64,
    pub invoice_number: String,
}

/// Payload para editar un pedido (sin cambiar cobros ya registrados).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvoicePayload {
    pub id: i64,
    pub client_id: i64,
    pub date: String,
    pub notes: Option<String>,
    pub items: Vec<CreateInvoiceItemPayload>,
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

/// Valida y persiste asignaciones de empleados a una l?nea de pedido.
fn insert_invoice_item_assignments(
    tx: &rusqlite::Transaction<'_>,
    invoice_item_id: i64,
    quantity: i64,
    service: &Option<String>,
    assignments: &[InvoiceItemAssignmentInput],
) -> Result<(), String> {
    if assignments.is_empty() {
        return Ok(());
    }
    if assignments.len() as i64 > quantity {
        return Err(format!(
            "No se pueden asignar m?s de {} empleado(s) para la cantidad de la l?nea",
            quantity
        ));
    }
    let mut seen = std::collections::HashSet::new();
    for a in assignments {
        if !seen.insert(a.employee_id) {
            return Err("Empleado duplicado en la asignaci?n de la l?nea".to_string());
        }
        if let Some(cost) = a.custom_unit_cost {
            if cost < 0.0 {
                return Err("La tarifa personalizada no puede ser negativa".to_string());
            }
        }
        let active: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM employees WHERE id = ?1 AND is_active = 1 AND deleted_at IS NULL",
                params![a.employee_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if active == 0 {
            return Err(format!(
                "El empleado {} no est? activo o no existe",
                a.employee_id
            ));
        }
        if let Some(svc) = service {
            let eligible: i64 = tx
                .query_row(
                    "SELECT COUNT(*) FROM employees e
                     WHERE e.id = ?1 AND e.is_active = 1 AND e.deleted_at IS NULL
                       AND (
                         EXISTS (
                           SELECT 1 FROM role_work_types rwt
                           JOIN work_types wt ON wt.id = rwt.work_type_id
                           WHERE rwt.role_id = e.role_id
                             AND (lower(wt.name) = lower(?2) OR lower(wt.code) = lower(?2))
                         )
                         OR EXISTS (
                           SELECT 1 FROM employee_extra_roles eer
                           JOIN role_work_types rwt2 ON rwt2.role_id = eer.role_id
                           JOIN work_types wt2 ON wt2.id = rwt2.work_type_id
                           WHERE eer.employee_id = e.id
                             AND (lower(wt2.name) = lower(?2) OR lower(wt2.code) = lower(?2))
                         )
                       )",
                    params![a.employee_id, svc],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            if eligible == 0 {
                return Err(format!(
                    "El empleado {} no tiene un rol asociado al tipo de trabajo ?{}?",
                    a.employee_id, svc
                ));
            }
        }
        tx.execute(
            "INSERT INTO invoice_item_assignments (invoice_item_id, employee_id, custom_unit_cost)
             VALUES (?1, ?2, ?3)",
            params![invoice_item_id, a.employee_id, a.custom_unit_cost],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn load_item_assignments(
    conn: &rusqlite::Connection,
    invoice_item_id: i64,
) -> Result<Vec<InvoiceItemAssignmentDto>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT a.employee_id, e.name, a.custom_unit_cost
             FROM invoice_item_assignments a
             JOIN employees e ON e.id = a.employee_id
             WHERE a.invoice_item_id = ?1
             ORDER BY e.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![invoice_item_id], |row| {
            Ok(InvoiceItemAssignmentDto {
                employee_id: row.get(0)?,
                employee_name: row.get(1)?,
                custom_unit_cost: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
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

/// Eval?a si un pedido puede editarse (a?n sin trabajo de producci?n).
fn invoice_editability(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
) -> Result<(bool, Option<String>), String> {
    let (cancelled_at, production_status): (Option<String>, String) = tx
        .query_row(
            "SELECT cancelled_at, production_status FROM invoices
             WHERE id = ?1 AND deleted_at IS NULL",
            params![invoice_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;
    if cancelled_at.is_some() {
        return Ok((false, Some("El pedido est? anulado.".to_string())));
    }
    if production_status == "listo" {
        return Ok((
            false,
            Some("No se puede editar un pedido marcado como listo.".to_string()),
        ));
    }
    let completed: i64 = tx
        .query_row(
            "SELECT COALESCE(SUM(completed_quantity), 0) FROM invoice_items WHERE invoice_id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if completed > 0 {
        return Ok((
            false,
            Some("Ya hay trabajo registrado en l?neas del pedido.".to_string()),
        ));
    }
    let batches: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM production_batch_items WHERE invoice_id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if batches > 0 {
        return Ok((
            false,
            Some("El pedido tiene lotes de trabajo asociados.".to_string()),
        ));
    }
    Ok((true, None))
}

/// Eval?a editabilidad sobre una conexi?n (solo lectura).
fn evaluate_editability_conn(
    conn: &rusqlite::Connection,
    invoice_id: i64,
) -> Result<(bool, Option<String>), String> {
    let (cancelled_at, production_status): (Option<String>, String) = conn
        .query_row(
            "SELECT cancelled_at, production_status FROM invoices
             WHERE id = ?1 AND deleted_at IS NULL",
            params![invoice_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;
    if cancelled_at.is_some() {
        return Ok((false, Some("El pedido est? anulado.".to_string())));
    }
    if production_status == "listo" {
        return Ok((
            false,
            Some("No se puede editar un pedido marcado como listo.".to_string()),
        ));
    }
    let completed: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(completed_quantity), 0) FROM invoice_items WHERE invoice_id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if completed > 0 {
        return Ok((
            false,
            Some("Ya hay trabajo registrado en l?neas del pedido.".to_string()),
        ));
    }
    let batches: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM production_batch_items WHERE invoice_id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if batches > 0 {
        return Ok((
            false,
            Some("El pedido tiene lotes de trabajo asociados.".to_string()),
        ));
    }
    Ok((true, None))
}

fn assert_invoice_editable(tx: &rusqlite::Transaction<'_>, invoice_id: i64) -> Result<(), String> {
    let (ok, reason) = invoice_editability(tx, invoice_id)?;
    if !ok {
        return Err(reason.unwrap_or_else(|| "El pedido no se puede editar".to_string()));
    }
    Ok(())
}

fn recalc_client_balance(tx: &rusqlite::Transaction<'_>, client_id: i64) -> Result<(), String> {
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
    Ok(())
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
                    i.production_status, i.payment_status, i.payment_currency, i.exchange_rate_snapshot,
                    COALESCE((SELECT SUM(completed_quantity) FROM invoice_items WHERE invoice_id = i.id), 0),
                    COALESCE((SELECT COUNT(*) FROM production_batch_items WHERE invoice_id = i.id), 0),
                    i.resource_missing
             FROM invoices i
             JOIN clients c ON c.id = i.client_id
             WHERE i.deleted_at IS NULL AND i.cancelled_at IS NULL
             ORDER BY i.date DESC, i.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let production_status: String = row.get(9)?;
            let payment_status: String = row.get(10)?;
            let balance: f64 = row.get(7)?;
            let completed: i64 = row.get(13)?;
            let batches: i64 = row.get(14)?;
            let can_edit = production_status != "listo" && completed == 0 && batches == 0;
            let can_cancel = !(payment_status == "cobrado" && balance <= EPS);
            Ok(InvoiceListDto {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                client_id: row.get(2)?,
                client_name: row.get(3)?,
                date: row.get(4)?,
                total: row.get(5)?,
                paid: row.get(6)?,
                balance,
                status: row.get(8)?,
                production_status,
                payment_status,
                payment_currency: row.get(11)?,
                exchange_rate_snapshot: row.get(12)?,
                can_edit,
                can_cancel,
                resource_missing: row.get::<_, i64>(15)? != 0,
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
                    i.production_status, i.payment_status, i.payment_currency, i.exchange_rate_snapshot,
                    i.cancelled_at, i.resource_missing
             FROM invoices i
             JOIN clients c ON c.id = i.client_id
             WHERE i.deleted_at IS NULL
             ORDER BY i.date DESC, i.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let payment_status: String = row.get(10)?;
            let balance: f64 = row.get(7)?;
            let cancelled_at: Option<String> = row.get(13)?;
            let can_cancel =
                cancelled_at.is_none() && !(payment_status == "cobrado" && balance <= EPS);
            Ok(InvoiceListDto {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                client_id: row.get(2)?,
                client_name: row.get(3)?,
                date: row.get(4)?,
                total: row.get(5)?,
                paid: row.get(6)?,
                balance,
                status: row.get(8)?,
                production_status: row.get(9)?,
                payment_status,
                payment_currency: row.get(11)?,
                exchange_rate_snapshot: row.get(12)?,
                can_edit: false,
                can_cancel,
                resource_missing: row.get::<_, i64>(14)? != 0,
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
        return Err("Estado de producci?n inv?lido".to_string());
    }
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (balance, paid, payment_status): (f64, f64, String) = tx
        .query_row(
            "SELECT balance, paid, payment_status FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;
    let legacy = sync_legacy_status(&status, &payment_status, balance, paid);

    if status == "listo" {
        // El inventario se descuenta por l?nea concluida (v?a lotes de trabajo),
        // no al marcar todo el pedido listo. Ver `deduct_inventory_for_line`.
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
        return Err("Estado de cobro inv?lido".to_string());
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
                    i.resource_missing, i.cancelled_at, i.cancelled_reason
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
                    resource_missing: row.get::<_, i64>(20)? != 0,
                    cancelled_at: row.get(21)?,
                    cancelled_reason: row.get(22)?,
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
                    ii.finish, ii.service, ii.quantity, ii.unit_price, ii.subtotal, ii.completed_quantity,
                    ii.resource_missing, ii.resource_note,
                    COALESCE(ii.production_line_status, 'en_produccion')
             FROM invoice_items ii
             JOIN product_categories pc ON pc.id = ii.category_id
             LEFT JOIN formats f ON f.id = ii.format_id
             WHERE ii.invoice_id = ?1
             ORDER BY ii.id",
        )
        .map_err(|e| e.to_string())?;
    let mut items = stmt
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
                completed_quantity: row.get(10)?,
                resource_missing: row.get::<_, i64>(11)? != 0,
                resource_note: row.get(12)?,
                production_line_status: row.get(13)?,
                materials: Vec::new(),
                assignments: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for item in &mut items {
        let mut mstmt = conn
            .prepare(
                "SELECT inventory_item_id, quantity_per_unit, COALESCE(source, 'manual'), recipe_id
                 FROM invoice_item_materials WHERE invoice_item_id = ?1 ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        item.materials = mstmt
            .query_map(params![item.id], |row| {
                Ok(InvoiceItemMaterialDto {
                    inventory_item_id: row.get(0)?,
                    quantity_per_unit: row.get(1)?,
                    source: row.get(2)?,
                    recipe_id: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        item.assignments = load_item_assignments(&conn, item.id)?;
    }

    let can_cancel = header.cancelled_at.is_none()
        && !(header.payment_status == "cobrado" && header.balance <= EPS);
    let (can_edit, edit_block_reason) = evaluate_editability_conn(&conn, id)?;

    Ok(InvoiceDetailDto {
        invoice: header,
        items,
        can_edit,
        can_cancel,
        edit_block_reason,
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

    // Anticipo: si hay detalle, el importe real se resuelve tras insertar (desde recibido).
    // Usamos el valor enviado como tope inicial; se corrige tras `record_advance_payment_in_tx`.
    let mut advance_payment = payload.advance_payment.max(0.0);
    if advance_payment > subtotal + EPS && payload.advance_payment_detail.is_none() {
        return Err("El anticipo no puede ser mayor que el subtotal".to_string());
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
    // Tasa USD→CUP del pedido: obligatoria al cobrar en USD; también se guarda en CUP
    // (precios de venta en USD convertidos) para auditoría y listados.
    let exchange_rate = if payment_currency == "USD" {
        if payload.exchange_rate_snapshot <= 0.0 {
            return Err("La tasa de cambio debe ser mayor que cero".to_string());
        }
        payload.exchange_rate_snapshot
    } else if payload.exchange_rate_snapshot > 0.0 {
        payload.exchange_rate_snapshot
    } else {
        0.0
    };

    // Totales provisionales (se ajustan tras el anticipo real).
    let provisional_advance = if payload.advance_payment_detail.is_some() {
        0.0
    } else {
        advance_payment.min(subtotal)
    };
    let total = (subtotal - provisional_advance).max(0.0);
    let balance = total;
    if payload.initial_payment.is_some() && total <= EPS && payload.advance_payment_detail.is_none()
    {
        return Err("No hay saldo pendiente para cobrar en este pedido".to_string());
    }

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
        if let Some(concept) = trim_notes(payload.transfer_concept.clone()) {
            let extra = format!("Ref. transferencia: {}", concept);
            notes = Some(match notes {
                Some(n) => format!("{}\n{}", n, extra),
                None => extra,
            });
        }
    }

    let new_client_debt = previous_debt + subtotal - provisional_advance;

    tx.execute(
        "INSERT INTO invoices (invoice_number, client_id, date, subtotal, advance_payment, previous_debt, total, paid, balance, status,
         production_status, payment_status, payment_method, payment_currency, exchange_rate_snapshot, amount_usd, amount_cup, notes,
         credit_applied, credit_added)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, 0, 0)",
        params![
            invoice_number,
            payload.client_id,
            date_trim,
            subtotal,
            provisional_advance,
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
        let invoice_item_id = tx.last_insert_rowid();
        if let Some(ref materials) = item.materials {
            if !materials.is_empty() {
                crate::commands::inventory::insert_invoice_item_materials(
                    &tx,
                    invoice_item_id,
                    materials,
                )?;
            }
        }
        if let Some(ref assignments) = item.assignments {
            insert_invoice_item_assignments(
                &tx,
                invoice_item_id,
                item.quantity,
                &service,
                assignments,
            )?;
        }
    }

    tx.execute(
        "UPDATE clients SET balance = ?1, updated_at = datetime('now') WHERE id = ?2 AND deleted_at IS NULL",
        params![new_client_debt, payload.client_id],
    )
    .map_err(|e| e.to_string())?;

    let advance_result = record_advance_payment_in_tx(
        &tx,
        invoice_id,
        &invoice_number,
        payload.client_id,
        subtotal,
        payload.advance_payment_detail.as_ref(),
        provisional_advance,
        &payment_method,
    )?;
    advance_payment = advance_result.advance_cup;

    // Ajustar totales del pedido si el anticipo real difiere del provisional.
    if (advance_payment - provisional_advance).abs() > EPS {
        let new_total = (subtotal - advance_payment).max(0.0);
        let new_inv_balance = new_total;
        let new_payment_status = if new_inv_balance <= EPS {
            "cobrado"
        } else {
            "pendiente"
        };
        let new_status = compute_invoice_status(new_inv_balance, 0.0);
        let new_amount_cup = new_total;
        let new_amount_usd = if payment_currency == "USD" && exchange_rate > 0.0 {
            new_amount_cup / exchange_rate
        } else {
            0.0
        };
        tx.execute(
            "UPDATE invoices SET advance_payment = ?1, total = ?2, balance = ?3, status = ?4,
             payment_status = ?5, amount_cup = ?6, amount_usd = ?7 WHERE id = ?8",
            params![
                advance_payment,
                new_total,
                new_inv_balance,
                new_status,
                new_payment_status,
                new_amount_cup,
                new_amount_usd,
                invoice_id
            ],
        )
        .map_err(|e| e.to_string())?;

        let adjusted_debt = previous_debt + subtotal - advance_payment;
        tx.execute(
            "UPDATE clients SET balance = ?1, updated_at = datetime('now') WHERE id = ?2 AND deleted_at IS NULL",
            params![adjusted_debt, payload.client_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let apply_credit = payload.apply_client_credit.unwrap_or(true);
    apply_client_credit_to_invoice_in_tx(&tx, invoice_id, apply_credit)?;

    if let Some(initial_payment) = payload.initial_payment {
        let inv_balance: f64 = tx
            .query_row(
                "SELECT balance FROM invoices WHERE id = ?1",
                params![invoice_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if inv_balance <= EPS {
            return Err("No hay saldo pendiente para cobrar en este pedido".to_string());
        }
        // El crédito ya se aplicó arriba; evitar doble aplicación en el cobro.
        let mut register = initial_payment.into_register(invoice_id);
        register.apply_client_credit = Some(false);
        apply_invoice_payment_in_tx(&tx, &register)?;
    }

    crate::commands::inventory::recompute_invoice_resource_flags(&tx, invoice_id)?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(CreateInvoiceResponse {
        id: invoice_id,
        invoice_number,
    })
}

/// Actualiza cliente, fecha, notas y l?neas de un pedido editable.
#[tauri::command]
pub fn invoices_update(payload: UpdateInvoicePayload) -> Result<InvoiceHeaderDto, String> {
    if payload.items.is_empty() {
        return Err("El pedido debe tener al menos una l?nea".to_string());
    }
    let date_trim = payload.date.trim().to_string();
    if date_trim.len() < 4 {
        return Err("Fecha inv?lida".to_string());
    }
    for item in &payload.items {
        if item.quantity <= 0 {
            return Err("Cada l?nea debe tener cantidad mayor que cero".to_string());
        }
        if item.unit_price < 0.0 {
            return Err("El precio unitario no puede ser negativo".to_string());
        }
    }

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    assert_invoice_editable(&tx, payload.id)?;

    let (old_client_id, advance_payment, previous_debt, paid): (i64, f64, f64, f64) = tx
        .query_row(
            "SELECT client_id, advance_payment, previous_debt, paid
             FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![payload.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;

    let client_exists: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM clients WHERE id = ?1 AND deleted_at IS NULL",
            params![payload.client_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if client_exists == 0 {
        return Err("Cliente no encontrado".to_string());
    }

    let mut subtotal = 0.0_f64;
    for item in &payload.items {
        subtotal += (item.quantity as f64) * item.unit_price;
    }
    let total = subtotal - advance_payment;
    if total < -1e-6 {
        return Err("El total calculado no puede ser negativo".to_string());
    }
    let balance = total - paid;
    if balance < -EPS {
        return Err(
            "El nuevo total es menor que lo ya cobrado. Ajusta las l?neas o registra un ajuste en caja."
                .to_string(),
        );
    }
    let status = compute_invoice_status(balance, paid);
    let payment_status = if balance <= EPS { "cobrado" } else { "pendiente" };
    let notes = trim_notes(payload.notes);

    tx.execute(
        "DELETE FROM invoice_item_materials
         WHERE invoice_item_id IN (SELECT id FROM invoice_items WHERE invoice_id = ?1)",
        params![payload.id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM invoice_item_assignments
         WHERE invoice_item_id IN (SELECT id FROM invoice_items WHERE invoice_id = ?1)",
        params![payload.id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM invoice_items WHERE invoice_id = ?1",
        params![payload.id],
    )
    .map_err(|e| e.to_string())?;

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
                payload.id,
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
        let invoice_item_id = tx.last_insert_rowid();
        if let Some(ref materials) = item.materials {
            if !materials.is_empty() {
                crate::commands::inventory::insert_invoice_item_materials(
                    &tx,
                    invoice_item_id,
                    materials,
                )?;
            }
        }
        if let Some(ref assignments) = item.assignments {
            insert_invoice_item_assignments(
                &tx,
                invoice_item_id,
                item.quantity,
                &service,
                assignments,
            )?;
        }
    }

    tx.execute(
        "UPDATE invoices
         SET client_id = ?1, date = ?2, subtotal = ?3, total = ?4, balance = ?5, status = ?6,
             payment_status = ?7, notes = ?8, amount_cup = ?9
         WHERE id = ?10",
        params![
            payload.client_id,
            date_trim,
            subtotal,
            total,
            balance,
            status,
            payment_status,
            notes,
            total.max(0.0),
            payload.id
        ],
    )
    .map_err(|e| e.to_string())?;

    let _ = previous_debt; // preserved on header; client balance recalculated from invoice balances
    recalc_client_balance(&tx, old_client_id)?;
    if old_client_id != payload.client_id {
        recalc_client_balance(&tx, payload.client_id)?;
    }

    crate::commands::inventory::recompute_invoice_resource_flags(&tx, payload.id)?;

    tx.commit().map_err(|e| e.to_string())?;
    invoices_get_detail(payload.id).map(|d| d.invoice)
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
        .ok_or_else(|| "Exportaci?n cancelada".to_string())?;
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
        params![EPS],
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
        return Err("El motivo de anulaci?n es obligatorio".to_string());
    }
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let (
        invoice_number,
        payment_status,
        balance,
        _paid,
        cancelled_at,
        credit_applied,
        credit_added,
        client_id,
    ): (
        String,
        String,
        f64,
        f64,
        Option<String>,
        f64,
        f64,
        i64,
    ) = tx
        .query_row(
            "SELECT invoice_number, payment_status, balance, paid, cancelled_at,
                    COALESCE(credit_applied, 0), COALESCE(credit_added, 0), client_id
             FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![invoice_id],
            |row| {
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
            },
        )
        .map_err(|_| "Factura no encontrada".to_string())?;
    if cancelled_at.is_some() {
        return Err("La factura ya está anulada".to_string());
    }
    if payment_status == "cobrado" && balance <= EPS {
        return Err("No se puede anular una factura totalmente cobrada".to_string());
    }

    let credit_balance: f64 = tx
        .query_row(
            "SELECT COALESCE(credit_balance, 0) FROM clients WHERE id = ?1",
            params![client_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if credit_added > EPS && credit_added > credit_balance + EPS {
        return Err(
            "No se puede anular: el saldo a favor generado por este pedido ya se usó en otra operación"
                .to_string(),
        );
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

    crate::commands::inventory::reverse_inventory_for_cancelled_invoice(
        &tx,
        invoice_id,
        &invoice_number,
    )?;

    tx.execute(
        "UPDATE invoices SET status = 'anulada', payment_status = 'pendiente', paid = 0, balance = 0,
         credit_applied = 0, credit_added = 0,
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

    // Quitar crédito generado por este pedido y restaurar el que se había aplicado.
    let new_credit = (credit_balance - credit_added + credit_applied).max(0.0);

    tx.execute(
        "UPDATE clients SET balance = ?1, credit_balance = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![new_client_balance, new_credit, client_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    invoices_get_detail(invoice_id).map(|d| d.invoice)
}

/// Fila de trabajador al marcar una linea como listo.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkListoWorkerPayload {
    pub employee_id: i64,
    pub quantity: i64,
    pub unit_cost: f64,
}

/// Payload para marcar una linea de pedido como listo (crea lotes).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkInvoiceItemListoPayload {
    pub invoice_item_id: i64,
    pub date: String,
    pub workers: Vec<MarkListoWorkerPayload>,
}

fn resolve_work_type_for_service(
    tx: &rusqlite::Transaction<'_>,
    service: &str,
) -> Result<(i64, String, String), String> {
    tx.query_row(
        "SELECT id, code, name FROM work_types
         WHERE is_active = 1
           AND (lower(name) = lower(?1) OR lower(code) = lower(?1))
         LIMIT 1",
        params![service],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .map_err(|_| format!("No se encontro el tipo de trabajo '{}' en el catalogo", service))
}

fn sync_invoice_production_status_from_lines(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
) -> Result<(), String> {
    let pending: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM invoice_items
             WHERE invoice_id = ?1
               AND COALESCE(production_line_status, 'en_produccion') != 'listo'",
            params![invoice_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if pending == 0 {
        tx.execute(
            "UPDATE invoices
             SET production_status = 'listo', production_completed_at = datetime('now')
             WHERE id = ?1 AND cancelled_at IS NULL",
            params![invoice_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn default_unit_cost_for_item(
    conn: &rusqlite::Connection,
    service: &str,
    format_id: Option<i64>,
) -> f64 {
    conn.query_row(
        "SELECT cl.unit_cost FROM cost_list cl
         JOIN work_types wt ON (cl.work_type = wt.code OR lower(cl.work_type) = lower(wt.name))
         WHERE wt.is_active = 1 AND cl.is_active = 1
           AND (lower(wt.name) = lower(?1) OR lower(wt.code) = lower(?1))
           AND (cl.format_id = ?2 OR (?2 IS NULL AND cl.format_id IS NULL))
         ORDER BY cl.id DESC LIMIT 1",
        params![service, format_id],
        |row| row.get(0),
    )
    .unwrap_or(0.0)
}

/// Marca una linea como listo creando un lote por cada trabajador confirmado.
#[tauri::command]
pub fn invoice_item_mark_listo(payload: MarkInvoiceItemListoPayload) -> Result<InvoiceDetailDto, String> {
    if payload.workers.is_empty() {
        return Err("Debes indicar al menos un empleado para marcar listo".to_string());
    }
    let date = payload.date.trim().to_string();
    if date.len() < 4 {
        return Err("Fecha invalida".to_string());
    }
    let total_qty: i64 = payload.workers.iter().map(|w| w.quantity).sum();
    if total_qty <= 0 {
        return Err("La cantidad total debe ser mayor que cero".to_string());
    }

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (invoice_id, client_id, service, quantity, completed, format_id, category_id, finish, status, invoice_number): (
        i64, i64, Option<String>, i64, i64, Option<i64>, i64, Option<String>, String, String,
    ) = tx
        .query_row(
            "SELECT ii.invoice_id, i.client_id, ii.service, ii.quantity, ii.completed_quantity,
                    ii.format_id, ii.category_id, ii.finish,
                    COALESCE(ii.production_line_status, 'en_produccion'), i.invoice_number
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id
             WHERE ii.id = ?1 AND i.deleted_at IS NULL AND i.cancelled_at IS NULL",
            params![payload.invoice_item_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                ))
            },
        )
        .map_err(|_| "Linea de pedido no encontrada".to_string())?;

    if status == "listo" {
        return Err("Esta linea ya esta marcada como listo".to_string());
    }
    let pending = (quantity - completed).max(0);
    if total_qty > pending {
        return Err(format!(
            "La cantidad asignada ({}) supera lo pendiente ({})",
            total_qty, pending
        ));
    }
    if (payload.workers.len() as i64) > quantity {
        return Err(format!(
            "No se pueden asignar mas de {} empleado(s) para esta linea",
            quantity
        ));
    }

    let shortages = crate::commands::inventory::line_material_shortages_for_quantity(
        &tx,
        payload.invoice_item_id,
        total_qty,
    )?;
    if !shortages.is_empty() {
        return Err(format!(
            "No se puede marcar Listo: falta material ({}). Registra una entrada en Inventario.",
            crate::commands::inventory::format_shortages_message(&shortages)
        ));
    }

    let service_name = service.clone().unwrap_or_default();
    if service_name.trim().is_empty() {
        return Err("La linea no tiene tipo de trabajo".to_string());
    }
    let (work_type_id, work_code, work_name) =
        resolve_work_type_for_service(&tx, service_name.trim())?;

    let mut seen = std::collections::HashSet::new();
    for w in &payload.workers {
        if w.quantity <= 0 {
            return Err("Cada trabajador debe tener cantidad mayor que cero".to_string());
        }
        if w.unit_cost < 0.0 {
            return Err("La tarifa no puede ser negativa".to_string());
        }
        if !seen.insert(w.employee_id) {
            return Err("Empleado duplicado en la confirmacion".to_string());
        }
        let active: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM employees WHERE id = ?1 AND is_active = 1 AND deleted_at IS NULL",
                params![w.employee_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if active == 0 {
            return Err(format!("Empleado {} no activo", w.employee_id));
        }
    }

    for w in &payload.workers {
        // Empleados con salario fijo no acumulan tarifa por producción.
        let unit_cost = if crate::commands::employees::employee_has_fixed_daily_salary(
            &*tx,
            w.employee_id,
        )? {
            0.0
        } else {
            w.unit_cost
        };
        let batch_cost = unit_cost * w.quantity as f64;
        tx.execute(
            "INSERT INTO production_batches (type, work_type_id, work_type_snapshot, date, employee_id, total_cost, paid, status, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 'pendiente', ?7)",
            params![
                work_code,
                work_type_id,
                work_name,
                date,
                w.employee_id,
                batch_cost,
                format!("Pedido {} linea {}", invoice_number, payload.invoice_item_id)
            ],
        )
        .map_err(|e| e.to_string())?;
        let batch_id = tx.last_insert_rowid();
        tx.execute(
            "INSERT INTO production_batch_items
                (batch_id, client_id, format_id, category, quantity, unit_cost, subtotal, invoice_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                batch_id,
                client_id,
                format_id,
                service_name.trim(),
                w.quantity,
                unit_cost,
                batch_cost,
                invoice_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "UPDATE invoice_items
         SET completed_quantity = completed_quantity + ?1,
             completed_at = datetime('now'),
             production_line_status = 'listo'
         WHERE id = ?2",
        params![total_qty, payload.invoice_item_id],
    )
    .map_err(|e| e.to_string())?;

    let service_filter = if service_name.trim().is_empty() {
        None
    } else {
        Some(service_name.as_str())
    };
    crate::commands::inventory::deduct_inventory_for_line(
        &tx,
        invoice_id,
        &invoice_number,
        payload.invoice_item_id,
        category_id,
        service_filter,
        format_id,
        finish.as_deref(),
        total_qty,
    )?;

    tx.execute(
        "UPDATE invoice_items SET resource_missing = 0, resource_note = NULL WHERE id = ?1",
        params![payload.invoice_item_id],
    )
    .map_err(|e| e.to_string())?;
    crate::commands::inventory::recompute_invoice_resource_flags(&tx, invoice_id)?;

    sync_invoice_production_status_from_lines(&tx, invoice_id)?;
    tx.commit().map_err(|e| e.to_string())?;
    invoices_get_detail(invoice_id)
}

/// Marca todas las lineas pendientes como listo (1 unidad por empleado; resto al ultimo).
#[tauri::command]
pub fn invoice_mark_all_listo(invoice_id: i64, date: String) -> Result<InvoiceDetailDto, String> {
    let date = date.trim().to_string();
    if date.len() < 4 {
        return Err("Fecha invalida".to_string());
    }
    let detail = invoices_get_detail(invoice_id)?;
    if detail.invoice.cancelled_at.is_some() {
        return Err("El pedido esta anulado".to_string());
    }
    if detail.invoice.production_status == "listo" {
        return Err("El pedido ya esta listo".to_string());
    }

    let pending_items: Vec<_> = detail
        .items
        .iter()
        .filter(|i| i.production_line_status != "listo")
        .cloned()
        .collect();
    if pending_items.is_empty() {
        return Err("No hay lineas pendientes".to_string());
    }
    for item in &pending_items {
        if item.assignments.is_empty() {
            return Err(format!(
                "La linea '{}' no tiene empleados asignados. Edita el pedido y asignalos antes de marcar listo.",
                item.service.clone().unwrap_or_else(|| format!("#{}", item.id))
            ));
        }
    }

    let conn = db::open_connection()?;
    for item in pending_items {
        let pending = (item.quantity - item.completed_quantity).max(0);
        if pending <= 0 {
            continue;
        }
        let service = item.service.clone().unwrap_or_default();
        let default_cost = default_unit_cost_for_item(&conn, &service, item.format_id);
        let n = item.assignments.len();
        let mut remaining = pending;
        let mut workers: Vec<MarkListoWorkerPayload> = Vec::new();
        for (idx, a) in item.assignments.iter().enumerate() {
            let is_last = idx + 1 == n;
            let qty = if is_last {
                remaining
            } else {
                let q = 1i64.min(remaining);
                remaining -= q;
                q
            };
            if qty <= 0 {
                continue;
            }
            workers.push(MarkListoWorkerPayload {
                employee_id: a.employee_id,
                quantity: qty,
                unit_cost: a.custom_unit_cost.unwrap_or(default_cost),
            });
        }
        if workers.is_empty() {
            return Err(format!("No se pudo repartir cantidad en la linea '{}'", service));
        }
        invoice_item_mark_listo(MarkInvoiceItemListoPayload {
            invoice_item_id: item.id,
            date: date.clone(),
            workers,
        })?;
    }
    invoices_get_detail(invoice_id)
}
