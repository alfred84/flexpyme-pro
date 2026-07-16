//! Cash register: count cash by denomination, record session, update invoice and client balance.

use std::collections::HashMap;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Bill/coin face values (CUP).
pub const DENOMINATIONS: &[i64] = &[5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1];

const EPS: f64 = 1e-6;

fn sync_legacy_status(production: &str, payment: &str, balance: f64, paid: f64) -> String {
    if payment == "cobrado" || balance <= EPS {
        "paid".to_string()
    } else if paid > 1e-6 {
        "partial".to_string()
    } else if production == "listo" {
        "partial".to_string()
    } else {
        "pending".to_string()
    }
}

/// One saved cash session row.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashSessionDto {
    pub id: i64,
    pub invoice_id: i64,
    pub total_amount: f64,
    pub amount_received: f64,
    pub change_given: f64,
    pub date: String,
    pub denomination_breakdown: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InitialPaymentPayload {
    /// Map of denomination string (e.g. "1000") to count — solo efectivo CUP con conteo.
    pub counts: Option<HashMap<String, i64>>,
    /// Monto directo en CUP (transferencia o efectivo sin desglose).
    pub amount_cup: Option<f64>,
    /// Monto en USD si el cobro es en dólares.
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub transfer_concept: Option<String>,
    /// Desglose de billetes CUP entregados como vuelto (denominación -> cantidad).
    pub change_counts: Option<HashMap<String, i64>>,
}

impl InitialPaymentPayload {
    /// Builds a cashier payload once the invoice id is known.
    pub fn into_register(self, invoice_id: i64) -> CashierRegisterPayload {
        CashierRegisterPayload {
            invoice_id,
            counts: self.counts,
            amount_cup: self.amount_cup,
            amount_usd: self.amount_usd,
            exchange_rate: self.exchange_rate,
            transfer_concept: self.transfer_concept,
            change_counts: self.change_counts,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashierRegisterPayload {
    pub invoice_id: i64,
    /// Map of denomination string (e.g. "1000") to count — solo efectivo CUP con conteo.
    pub counts: Option<HashMap<String, i64>>,
    /// Monto directo en CUP (transferencia o efectivo sin desglose).
    pub amount_cup: Option<f64>,
    /// Monto en USD si el cobro es en dólares.
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub transfer_concept: Option<String>,
    /// Desglose de billetes CUP entregados como vuelto (denominación -> cantidad).
    pub change_counts: Option<HashMap<String, i64>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashierRegisterResponse {
    pub session_id: Option<i64>,
    pub amount_received: f64,
    pub change_given: f64,
    pub amount_applied: f64,
    pub invoice_new_balance: f64,
    pub invoice_status: String,
    pub payment_status: String,
}

fn sum_from_counts(counts: &HashMap<String, i64>) -> Result<f64, String> {
    let mut sum = 0.0_f64;
    for (k, &n) in counts.iter() {
        if n < 0 {
            return Err("Las cantidades no pueden ser negativas".to_string());
        }
        if n == 0 {
            continue;
        }
        let d: i64 = k
            .parse()
            .map_err(|_| format!("Denominacion invalida: {}", k))?;
        if !DENOMINATIONS.contains(&d) {
            return Err(format!("Denominacion no admitida: {}", k));
        }
        sum += (d as f64) * (n as f64);
    }
    Ok(sum)
}

fn resolve_amount_received(
    payment_method: &str,
    payment_currency: &str,
    payload: &CashierRegisterPayload,
) -> Result<(f64, f64, f64, String), String> {
    let method = payment_method.trim().to_lowercase();
    let currency = payment_currency.trim().to_uppercase();

    if method == "transferencia" {
        let cup = payload.amount_cup.unwrap_or(0.0);
        if cup <= EPS {
            return Err("Indica el monto recibido en CUP".to_string());
        }
        return Ok((cup, 0.0, 0.0, "transferencia".to_string()));
    }

    if currency == "USD" {
        let usd = payload.amount_usd.unwrap_or(0.0);
        let rate = payload.exchange_rate.unwrap_or(0.0);
        if usd <= EPS || rate <= EPS {
            return Err("Indica monto USD y tasa de cambio válidos".to_string());
        }
        let cup = usd * rate;
        return Ok((cup, usd, rate, "efectivo".to_string()));
    }

    if let Some(counts) = &payload.counts {
        let from_counts = sum_from_counts(counts)?;
        if from_counts > EPS {
            return Ok((from_counts, 0.0, 0.0, "efectivo".to_string()));
        }
    }
    let cup = payload.amount_cup.unwrap_or(0.0);
    if cup <= EPS {
        return Err("Indica el monto recibido o el conteo de billetes".to_string());
    }
    Ok((cup, 0.0, 0.0, "efectivo".to_string()))
}

/// Records an advance payment as cash income linked to an invoice.
pub fn record_advance_payment_in_tx(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    invoice_number: &str,
    advance_cup: f64,
    payment_method: &str,
) -> Result<(), String> {
    if advance_cup <= EPS {
        return Ok(());
    }
    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES ('ingreso', ?1, 'pedido', ?2, ?3, 0, 0, ?4, NULL, datetime('now'))",
        params![
            format!("Anticipo pedido {}", invoice_number),
            invoice_id,
            advance_cup,
            payment_method
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Applies a payment to an invoice inside an open database transaction.
pub fn apply_invoice_payment_in_tx(
    tx: &rusqlite::Transaction<'_>,
    payload: &CashierRegisterPayload,
) -> Result<CashierRegisterResponse, String> {
    let (
        client_id,
        total,
        paid,
        balance,
        payment_method,
        payment_currency,
        exchange_rate_snapshot,
        production_status,
    ): (i64, f64, f64, f64, Option<String>, Option<String>, Option<f64>, String) = tx
        .query_row(
            "SELECT client_id, total, paid, balance, payment_method, payment_currency,
                    exchange_rate_snapshot, production_status
             FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
            params![payload.invoice_id],
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
        .map_err(|_| "Pedido no encontrado".to_string())?;

    if balance <= EPS {
        return Err("Este pedido no tiene saldo pendiente".to_string());
    }

    let method = payment_method
        .as_deref()
        .unwrap_or("efectivo")
        .to_string();
    let currency = if method == "transferencia" {
        "CUP".to_string()
    } else {
        payment_currency
            .as_deref()
            .unwrap_or("CUP")
            .to_uppercase()
    };

    let (amount_received_cup, amount_usd, exchange_rate, tx_method) =
        resolve_amount_received(&method, &currency, payload)?;

    let amount_applied = amount_received_cup.min(balance);
    let change_given = (amount_received_cup - balance).max(0.0);

    // Validación de vuelto: si hay vuelto y se entregó desglose, debe cuadrar.
    let change_breakdown_json = if let Some(change_counts) = &payload.change_counts {
        let change_sum = sum_from_counts(change_counts)?;
        if change_sum > EPS {
            if (change_sum - change_given).abs() > 0.5 {
                return Err(format!(
                    "El vuelto entregado ({:.2} CUP) no coincide con el vuelto a devolver ({:.2} CUP).",
                    change_sum, change_given
                ));
            }
            Some(serde_json::to_string(change_counts).map_err(|e| e.to_string())?)
        } else {
            None
        }
    } else {
        None
    };

    let new_paid = paid + amount_applied;
    let new_balance = (total - new_paid).max(0.0);
    let payment_status = if new_balance <= EPS {
        "cobrado"
    } else {
        "pendiente"
    };
    let status = sync_legacy_status(&production_status, payment_status, new_balance, new_paid);

    let client_balance: f64 = tx
        .query_row(
            "SELECT balance FROM clients WHERE id = ?1 AND deleted_at IS NULL",
            params![client_id],
            |row| row.get(0),
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    let new_client_balance = client_balance - amount_applied;
    if new_client_balance < -EPS {
        return Err("Inconsistencia de saldo del cliente".to_string());
    }

    let breakdown_json = payload
        .counts
        .as_ref()
        .map(|c| serde_json::to_string(c))
        .transpose()
        .map_err(|e| e.to_string())?;

    let mut session_id: Option<i64> = None;
    if tx_method == "efectivo" && (breakdown_json.is_some() || change_breakdown_json.is_some()) {
        tx.execute(
            "INSERT INTO cash_sessions (invoice_id, total_amount, amount_received, change_given, denomination_breakdown, change_breakdown)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                payload.invoice_id,
                balance,
                amount_received_cup,
                change_given,
                breakdown_json,
                change_breakdown_json
            ],
        )
        .map_err(|e| e.to_string())?;
        session_id = Some(tx.last_insert_rowid());
    }

    let concept = if method == "transferencia" {
        let extra = payload
            .transfer_concept
            .as_ref()
            .map(|c| format!(" · {}", c.trim()))
            .unwrap_or_default();
        format!("Cobro pedido #{} (transferencia){}", payload.invoice_id, extra)
    } else if currency == "USD" {
        format!(
            "Cobro pedido #{} (USD {:.2} @ {:.0})",
            payload.invoice_id, amount_usd, exchange_rate
        )
    } else {
        format!("Cobro pedido #{}", payload.invoice_id)
    };

    let rate_used = if currency == "USD" {
        exchange_rate
    } else {
        exchange_rate_snapshot.unwrap_or(0.0)
    };

    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES ('ingreso', ?1, 'pedido', ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            concept,
            payload.invoice_id,
            amount_applied,
            amount_usd,
            rate_used,
            tx_method,
            breakdown_json
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE invoices SET paid = ?1, balance = ?2, status = ?3, payment_status = ?4
         WHERE id = ?5 AND deleted_at IS NULL",
        params![
            new_paid,
            new_balance,
            status,
            payment_status,
            payload.invoice_id
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE clients SET balance = ?1, updated_at = datetime('now') WHERE id = ?2 AND deleted_at IS NULL",
        params![new_client_balance, client_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(CashierRegisterResponse {
        session_id,
        amount_received: amount_received_cup,
        change_given,
        amount_applied,
        invoice_new_balance: new_balance,
        invoice_status: status,
        payment_status: payment_status.to_string(),
    })
}

/// Lists cash sessions for an invoice, newest first.
#[tauri::command]
pub fn cashier_sessions_for_invoice(invoice_id: i64) -> Result<Vec<CashSessionDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_id, total_amount, amount_received, change_given, date, denomination_breakdown
             FROM cash_sessions WHERE invoice_id = ?1 ORDER BY id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![invoice_id], |row| {
            Ok(CashSessionDto {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                total_amount: row.get(2)?,
                amount_received: row.get(3)?,
                change_given: row.get(4)?,
                date: row.get(5)?,
                denomination_breakdown: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Registers payment: updates invoice, client balance, `cash_transactions` and optional `cash_sessions`.
#[tauri::command]
pub fn cashier_register_payment(
    payload: CashierRegisterPayload,
) -> Result<CashierRegisterResponse, String> {
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let result = apply_invoice_payment_in_tx(&tx, &payload)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(result)
}
