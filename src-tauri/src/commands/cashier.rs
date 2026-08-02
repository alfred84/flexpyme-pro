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

/// Disposition of cash received above the amount due.
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OverpaymentDisposition {
    Change,
    Credit,
}

impl Default for OverpaymentDisposition {
    fn default() -> Self {
        Self::Change
    }
}

impl OverpaymentDisposition {
    fn parse(raw: Option<&str>) -> Self {
        match raw.map(|s| s.trim().to_lowercase()).as_deref() {
            Some("credit") | Some("saldo") | Some("saldo_a_favor") => Self::Credit,
            _ => Self::Change,
        }
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

/// Cobro inicial al crear un pedido (sin invoiceId).
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
    /// `change` | `credit` — qué hacer con el exceso recibido.
    #[serde(default)]
    pub overpayment_disposition: Option<String>,
    /// Si true, aplica saldo a favor del cliente al saldo del pedido antes del cobro.
    #[serde(default)]
    pub apply_client_credit: Option<bool>,
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
            overpayment_disposition: self.overpayment_disposition,
            apply_client_credit: self.apply_client_credit,
        }
    }
}

/// Detalle de pago anticipado al crear el pedido (CUP/USD, efectivo o transferencia).
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdvancePaymentPayload {
    pub payment_method: String,
    pub payment_currency: Option<String>,
    pub counts: Option<HashMap<String, i64>>,
    pub amount_cup: Option<f64>,
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub transfer_concept: Option<String>,
    pub change_counts: Option<HashMap<String, i64>>,
    #[serde(default)]
    pub overpayment_disposition: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashierRegisterPayload {
    pub invoice_id: i64,
    pub counts: Option<HashMap<String, i64>>,
    pub amount_cup: Option<f64>,
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub transfer_concept: Option<String>,
    pub change_counts: Option<HashMap<String, i64>>,
    #[serde(default)]
    pub overpayment_disposition: Option<String>,
    #[serde(default)]
    pub apply_client_credit: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashierRegisterResponse {
    pub session_id: Option<i64>,
    pub amount_received: f64,
    pub change_given: f64,
    pub amount_applied: f64,
    pub credit_applied: f64,
    pub credit_added: f64,
    pub invoice_new_balance: f64,
    pub invoice_status: String,
    pub payment_status: String,
}

/// Resultado de registrar un anticipo en caja.
#[derive(Debug)]
pub struct AdvancePaymentResult {
    pub advance_cup: f64,
    pub credit_added: f64,
    pub change_given: f64,
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

/// Resuelve el importe recibido en CUP a partir de método/moneda y payload de montos.
fn resolve_amount_received(
    payment_method: &str,
    payment_currency: &str,
    counts: &Option<HashMap<String, i64>>,
    amount_cup: Option<f64>,
    amount_usd: Option<f64>,
    exchange_rate: Option<f64>,
) -> Result<(f64, f64, f64, String), String> {
    let method = payment_method.trim().to_lowercase();
    let currency = payment_currency.trim().to_uppercase();

    if method == "transferencia" {
        let cup = amount_cup.unwrap_or(0.0);
        if cup <= EPS {
            return Err("Indica el monto recibido en CUP".to_string());
        }
        return Ok((cup, 0.0, 0.0, "transferencia".to_string()));
    }

    if currency == "USD" {
        let usd = amount_usd.unwrap_or(0.0);
        let rate = exchange_rate.unwrap_or(0.0);
        if usd <= EPS || rate <= EPS {
            return Err("Indica monto USD y tasa de cambio válidos".to_string());
        }
        let cup = usd * rate;
        return Ok((cup, usd, rate, "efectivo".to_string()));
    }

    if let Some(c) = counts {
        let from_counts = sum_from_counts(c)?;
        if from_counts > EPS {
            return Ok((from_counts, 0.0, 0.0, "efectivo".to_string()));
        }
    }
    let cup = amount_cup.unwrap_or(0.0);
    if cup <= EPS {
        return Err("Indica el monto recibido o el conteo de billetes".to_string());
    }
    Ok((cup, 0.0, 0.0, "efectivo".to_string()))
}

fn validate_change_breakdown(
    change_given: f64,
    change_counts: &Option<HashMap<String, i64>>,
    disposition: &OverpaymentDisposition,
) -> Result<Option<String>, String> {
    if change_given <= 0.5 {
        return Ok(None);
    }
    if *disposition == OverpaymentDisposition::Credit {
        return Ok(None);
    }
    let Some(counts) = change_counts else {
        return Err(
            "Hay vuelto por entregar: desglosa los billetes o elige dejar saldo a favor".to_string(),
        );
    };
    let change_sum = sum_from_counts(counts)?;
    if (change_sum - change_given).abs() > 0.5 {
        return Err(format!(
            "El vuelto entregado ({:.2} CUP) no coincide con el vuelto a devolver ({:.2} CUP).",
            change_sum, change_given
        ));
    }
    Ok(Some(
        serde_json::to_string(counts).map_err(|e| e.to_string())?,
    ))
}

/// Aplica crédito disponible del cliente al saldo pendiente del pedido (sin movimiento de caja).
pub fn apply_client_credit_to_invoice_in_tx(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    apply: bool,
) -> Result<f64, String> {
    if !apply {
        return Ok(0.0);
    }

    let (client_id, total, paid, balance, production_status, credit_applied_prev): (
        i64,
        f64,
        f64,
        f64,
        String,
        f64,
    ) = tx
        .query_row(
            "SELECT client_id, total, paid, balance, production_status,
                    COALESCE(credit_applied, 0)
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
                ))
            },
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;

    if balance <= EPS {
        return Ok(0.0);
    }

    let (client_balance, credit_balance): (f64, f64) = tx
        .query_row(
            "SELECT balance, COALESCE(credit_balance, 0) FROM clients
             WHERE id = ?1 AND deleted_at IS NULL",
            params![client_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    let credit_to_apply = credit_balance.min(balance);
    if credit_to_apply <= EPS {
        return Ok(0.0);
    }

    let new_paid = paid + credit_to_apply;
    let new_balance = (total - new_paid).max(0.0);
    let payment_status = if new_balance <= EPS {
        "cobrado"
    } else {
        "pendiente"
    };
    let status = sync_legacy_status(&production_status, payment_status, new_balance, new_paid);
    let new_client_balance = (client_balance - credit_to_apply).max(0.0);
    let new_credit = credit_balance - credit_to_apply;

    tx.execute(
        "UPDATE invoices SET paid = ?1, balance = ?2, status = ?3, payment_status = ?4,
         credit_applied = ?5
         WHERE id = ?6 AND deleted_at IS NULL",
        params![
            new_paid,
            new_balance,
            status,
            payment_status,
            credit_applied_prev + credit_to_apply,
            invoice_id
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE clients SET balance = ?1, credit_balance = ?2, updated_at = datetime('now')
         WHERE id = ?3 AND deleted_at IS NULL",
        params![new_client_balance, new_credit, client_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(credit_to_apply)
}

/// Records an advance payment as cash income linked to an invoice (with denominations / USD).
pub fn record_advance_payment_in_tx(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    invoice_number: &str,
    client_id: i64,
    subtotal: f64,
    detail: Option<&AdvancePaymentPayload>,
    legacy_advance_cup: f64,
    legacy_payment_method: &str,
) -> Result<AdvancePaymentResult, String> {
    // Sin detalle: comportamiento legacy (solo CUP, sin denominaciones).
    let Some(detail) = detail else {
        if legacy_advance_cup <= EPS {
            return Ok(AdvancePaymentResult {
                advance_cup: 0.0,
                credit_added: 0.0,
                change_given: 0.0,
            });
        }
        tx.execute(
            "INSERT INTO cash_transactions
                (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
                 payment_method, denomination_breakdown, date)
             VALUES ('ingreso', ?1, 'pedido', ?2, ?3, 0, 0, ?4, NULL, datetime('now'))",
            params![
                format!("Anticipo pedido {}", invoice_number),
                invoice_id,
                legacy_advance_cup,
                legacy_payment_method
            ],
        )
        .map_err(|e| e.to_string())?;
        return Ok(AdvancePaymentResult {
            advance_cup: legacy_advance_cup,
            credit_added: 0.0,
            change_given: 0.0,
        });
    };

    let method = detail.payment_method.trim().to_lowercase();
    if method != "efectivo" && method != "transferencia" {
        return Err("Método de pago del anticipo inválido".to_string());
    }
    let currency = if method == "transferencia" {
        "CUP".to_string()
    } else {
        detail
            .payment_currency
            .as_deref()
            .unwrap_or("CUP")
            .trim()
            .to_uppercase()
    };

    let (received_cup, amount_usd, exchange_rate, tx_method) = resolve_amount_received(
        &method,
        &currency,
        &detail.counts,
        detail.amount_cup,
        detail.amount_usd,
        detail.exchange_rate,
    )?;

    if received_cup <= EPS {
        return Ok(AdvancePaymentResult {
            advance_cup: 0.0,
            credit_added: 0.0,
            change_given: 0.0,
        });
    }

    let advance_cup = received_cup.min(subtotal);
    let excess = (received_cup - subtotal).max(0.0);
    let disposition = OverpaymentDisposition::parse(detail.overpayment_disposition.as_deref());

    let (change_given, credit_added) = if excess > EPS {
        match disposition {
            OverpaymentDisposition::Change => (excess, 0.0),
            OverpaymentDisposition::Credit => (0.0, excess),
        }
    } else {
        (0.0, 0.0)
    };

    let change_breakdown_json =
        validate_change_breakdown(change_given, &detail.change_counts, &disposition)?;

    // Neto en caja: con vuelto = anticipo; con crédito = recibido completo.
    let cash_ingreso = if credit_added > EPS {
        received_cup
    } else {
        advance_cup
    };

    let breakdown_json = detail
        .counts
        .as_ref()
        .map(|c| serde_json::to_string(c))
        .transpose()
        .map_err(|e| e.to_string())?;

    let concept = if method == "transferencia" {
        let extra = detail
            .transfer_concept
            .as_ref()
            .map(|c| {
                let t = c.trim();
                if t.is_empty() {
                    String::new()
                } else {
                    format!(" · {}", t)
                }
            })
            .unwrap_or_default();
        format!("Anticipo pedido {} (transferencia){}", invoice_number, extra)
    } else if currency == "USD" {
        format!(
            "Anticipo pedido {} (USD {:.2} @ {:.0})",
            invoice_number, amount_usd, exchange_rate
        )
    } else {
        format!("Anticipo pedido {}", invoice_number)
    };

    if tx_method == "efectivo" && (breakdown_json.is_some() || change_breakdown_json.is_some()) {
        tx.execute(
            "INSERT INTO cash_sessions (invoice_id, total_amount, amount_received, change_given, denomination_breakdown, change_breakdown)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                invoice_id,
                advance_cup,
                received_cup,
                change_given,
                breakdown_json,
                change_breakdown_json
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES ('ingreso', ?1, 'pedido', ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            concept,
            invoice_id,
            cash_ingreso,
            amount_usd,
            exchange_rate,
            tx_method,
            breakdown_json
        ],
    )
    .map_err(|e| e.to_string())?;

    if credit_added > EPS {
        tx.execute(
            "UPDATE clients SET credit_balance = COALESCE(credit_balance, 0) + ?1,
             updated_at = datetime('now') WHERE id = ?2 AND deleted_at IS NULL",
            params![credit_added, client_id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE invoices SET credit_added = COALESCE(credit_added, 0) + ?1 WHERE id = ?2",
            params![credit_added, invoice_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(AdvancePaymentResult {
        advance_cup,
        credit_added,
        change_given,
    })
}

/// Applies a payment to an invoice inside an open database transaction.
pub fn apply_invoice_payment_in_tx(
    tx: &rusqlite::Transaction<'_>,
    payload: &CashierRegisterPayload,
) -> Result<CashierRegisterResponse, String> {
    let apply_credit = payload.apply_client_credit.unwrap_or(true);
    let credit_applied = apply_client_credit_to_invoice_in_tx(tx, payload.invoice_id, apply_credit)?;

    let (
        client_id,
        total,
        paid,
        balance,
        payment_method,
        payment_currency,
        exchange_rate_snapshot,
        production_status,
        credit_added_prev,
    ): (
        i64,
        f64,
        f64,
        f64,
        Option<String>,
        Option<String>,
        Option<f64>,
        String,
        f64,
    ) = tx
        .query_row(
            "SELECT client_id, total, paid, balance, payment_method, payment_currency,
                    exchange_rate_snapshot, production_status, COALESCE(credit_added, 0)
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
                    row.get(8)?,
                ))
            },
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;

    // Tras aplicar crédito: si no hay cobro en efectivo/transferencia, terminar aquí.
    let has_cash_intent = payload.amount_cup.unwrap_or(0.0) > EPS
        || payload.amount_usd.unwrap_or(0.0) > EPS
        || payload
            .counts
            .as_ref()
            .map(|c| c.values().any(|&n| n > 0))
            .unwrap_or(false);

    if !has_cash_intent {
        if credit_applied <= EPS && balance <= EPS {
            return Err("Este pedido no tiene saldo pendiente".to_string());
        }
        if credit_applied <= EPS {
            return Err("Indica el monto recibido o el conteo de billetes".to_string());
        }
        let payment_status = if balance <= EPS { "cobrado" } else { "pendiente" };
        let status = sync_legacy_status(&production_status, payment_status, balance, paid);
        return Ok(CashierRegisterResponse {
            session_id: None,
            amount_received: 0.0,
            change_given: 0.0,
            amount_applied: credit_applied,
            credit_applied,
            credit_added: 0.0,
            invoice_new_balance: balance,
            invoice_status: status,
            payment_status: payment_status.to_string(),
        });
    }

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

    let (amount_received_cup, amount_usd, exchange_rate, tx_method) = resolve_amount_received(
        &method,
        &currency,
        &payload.counts,
        payload.amount_cup,
        payload.amount_usd,
        payload.exchange_rate,
    )?;

    let disposition =
        OverpaymentDisposition::parse(payload.overpayment_disposition.as_deref());
    let amount_applied = amount_received_cup.min(balance);
    let excess = (amount_received_cup - balance).max(0.0);
    let (change_given, credit_added) = if excess > EPS {
        match disposition {
            OverpaymentDisposition::Change => (excess, 0.0),
            OverpaymentDisposition::Credit => (0.0, excess),
        }
    } else {
        (0.0, 0.0)
    };

    let change_breakdown_json =
        validate_change_breakdown(change_given, &payload.change_counts, &disposition)?;

    let new_paid = paid + amount_applied;
    let new_balance = (total - new_paid).max(0.0);
    let payment_status = if new_balance <= EPS {
        "cobrado"
    } else {
        "pendiente"
    };
    let status = sync_legacy_status(&production_status, payment_status, new_balance, new_paid);

    let (client_balance, credit_balance): (f64, f64) = tx
        .query_row(
            "SELECT balance, COALESCE(credit_balance, 0) FROM clients
             WHERE id = ?1 AND deleted_at IS NULL",
            params![client_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    let new_client_balance = (client_balance - amount_applied).max(0.0);
    let new_credit_balance = credit_balance + credit_added;

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

    // Con vuelto: ingreso = aplicado (neto). Con crédito: ingreso = recibido completo.
    let cash_ingreso = if credit_added > EPS {
        amount_received_cup
    } else {
        amount_applied
    };

    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES ('ingreso', ?1, 'pedido', ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            concept,
            payload.invoice_id,
            cash_ingreso,
            amount_usd,
            rate_used,
            tx_method,
            breakdown_json
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE invoices SET paid = ?1, balance = ?2, status = ?3, payment_status = ?4,
         credit_added = ?5
         WHERE id = ?6 AND deleted_at IS NULL",
        params![
            new_paid,
            new_balance,
            status,
            payment_status,
            credit_added_prev + credit_added,
            payload.invoice_id
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE clients SET balance = ?1, credit_balance = ?2, updated_at = datetime('now')
         WHERE id = ?3 AND deleted_at IS NULL",
        params![new_client_balance, new_credit_balance, client_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(CashierRegisterResponse {
        session_id,
        amount_received: amount_received_cup,
        change_given,
        amount_applied: amount_applied + credit_applied,
        credit_applied,
        credit_added,
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
