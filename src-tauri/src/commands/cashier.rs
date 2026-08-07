//! Cash register: dual-currency receive/change, update invoice and client balances.

use std::collections::HashMap;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Bill/coin face values (CUP).
pub const DENOMINATIONS: &[i64] = &[5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1];
/// Bill face values (USD).
pub const USD_DENOMINATIONS: &[i64] = &[100, 50, 20, 10, 5, 2, 1];

const EPS: f64 = 1e-6;

fn sync_legacy_status(production: &str, payment: &str, balance_equiv: f64, paid_equiv: f64) -> String {
    if payment == "cobrado" || balance_equiv <= EPS {
        "paid".to_string()
    } else if paid_equiv > 1e-6 {
        "partial".to_string()
    } else if production == "listo" {
        "partial".to_string()
    } else {
        "pending".to_string()
    }
}

fn cup_equiv(usd: f64, cup: f64, rate: f64) -> f64 {
    cup + if rate > EPS { usd * rate } else { 0.0 }
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
    pub amount_received_usd: f64,
    pub change_given_usd: f64,
    pub date: String,
    pub denomination_breakdown: Option<String>,
}

/// Cobro inicial al crear un pedido (sin invoiceId).
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InitialPaymentPayload {
    pub counts: Option<HashMap<String, i64>>,
    pub usd_counts: Option<HashMap<String, i64>>,
    pub amount_cup: Option<f64>,
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub transfer_concept: Option<String>,
    pub change_counts: Option<HashMap<String, i64>>,
    pub change_usd_counts: Option<HashMap<String, i64>>,
    #[serde(default)]
    pub overpayment_disposition: Option<String>,
    #[serde(default)]
    pub apply_client_credit: Option<bool>,
}

impl InitialPaymentPayload {
    /// Builds a cashier payload once the invoice id is known.
    pub fn into_register(self, invoice_id: i64) -> CashierRegisterPayload {
        CashierRegisterPayload {
            invoice_id,
            counts: self.counts,
            usd_counts: self.usd_counts,
            amount_cup: self.amount_cup,
            amount_usd: self.amount_usd,
            exchange_rate: self.exchange_rate,
            transfer_concept: self.transfer_concept,
            change_counts: self.change_counts,
            change_usd_counts: self.change_usd_counts,
            overpayment_disposition: self.overpayment_disposition,
            apply_client_credit: self.apply_client_credit,
        }
    }
}

/// Detalle de pago anticipado al crear el pedido.
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdvancePaymentPayload {
    pub payment_method: String,
    pub payment_currency: Option<String>,
    pub counts: Option<HashMap<String, i64>>,
    pub usd_counts: Option<HashMap<String, i64>>,
    pub amount_cup: Option<f64>,
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub transfer_concept: Option<String>,
    pub change_counts: Option<HashMap<String, i64>>,
    pub change_usd_counts: Option<HashMap<String, i64>>,
    #[serde(default)]
    pub overpayment_disposition: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashierRegisterPayload {
    pub invoice_id: i64,
    pub counts: Option<HashMap<String, i64>>,
    pub usd_counts: Option<HashMap<String, i64>>,
    pub amount_cup: Option<f64>,
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub transfer_concept: Option<String>,
    pub change_counts: Option<HashMap<String, i64>>,
    pub change_usd_counts: Option<HashMap<String, i64>>,
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
    pub amount_received_usd: f64,
    pub change_given: f64,
    pub change_given_usd: f64,
    pub amount_applied: f64,
    pub amount_applied_usd: f64,
    pub credit_applied: f64,
    pub credit_added: f64,
    pub invoice_new_balance: f64,
    pub invoice_new_balance_usd: f64,
    pub invoice_status: String,
    pub payment_status: String,
}

/// Resultado de registrar un anticipo en caja.
#[derive(Debug)]
pub struct AdvancePaymentResult {
    pub advance_cup: f64,
    pub advance_usd: f64,
    pub credit_added: f64,
    pub change_given: f64,
    pub change_given_usd: f64,
}

fn sum_from_counts(counts: &HashMap<String, i64>, allowed: &[i64]) -> Result<f64, String> {
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
            .map_err(|_| format!("Denominación inválida: {}", k))?;
        if !allowed.contains(&d) {
            return Err(format!("Denominación no admitida: {}", k));
        }
        sum += (d as f64) * (n as f64);
    }
    Ok(sum)
}

/// Resuelve montos recibidos en CUP y USD (pueden ser simultáneos).
fn resolve_dual_received(
    payment_method: &str,
    counts: &Option<HashMap<String, i64>>,
    usd_counts: &Option<HashMap<String, i64>>,
    amount_cup: Option<f64>,
    amount_usd: Option<f64>,
    exchange_rate: Option<f64>,
) -> Result<(f64, f64, f64, String), String> {
    let method = payment_method.trim().to_lowercase();
    let rate = exchange_rate.unwrap_or(0.0);

    if method == "transferencia" {
        let cup = amount_cup.unwrap_or(0.0);
        if cup <= EPS {
            return Err("Indica el monto recibido en CUP".to_string());
        }
        return Ok((cup, 0.0, rate, "transferencia".to_string()));
    }

    let mut received_cup = 0.0;
    let mut received_usd = 0.0;

    if let Some(c) = counts {
        received_cup += sum_from_counts(c, DENOMINATIONS)?;
    }
    if let Some(c) = usd_counts {
        received_usd += sum_from_counts(c, USD_DENOMINATIONS)?;
    }
    if amount_cup.unwrap_or(0.0) > EPS && received_cup <= EPS {
        received_cup = amount_cup.unwrap_or(0.0);
    }
    if amount_usd.unwrap_or(0.0) > EPS && received_usd <= EPS {
        received_usd = amount_usd.unwrap_or(0.0);
    }

    if received_usd > EPS && rate <= EPS {
        return Err("Indica una tasa USD→CUP válida para el cobro en USD".to_string());
    }
    if received_cup <= EPS && received_usd <= EPS {
        return Err("Indica el monto recibido o el conteo de billetes (CUP y/o USD)".to_string());
    }
    Ok((received_cup, received_usd, rate, "efectivo".to_string()))
}

/// Aplica recibido a deudas duales (misma moneda primero, luego cruce).
fn apply_received_to_balances(
    mut bal_usd: f64,
    mut bal_cup: f64,
    mut recv_usd: f64,
    mut recv_cup: f64,
    rate: f64,
) -> (f64, f64, f64, f64, f64, f64) {
    // Same currency first.
    let apply_usd = recv_usd.min(bal_usd);
    bal_usd -= apply_usd;
    recv_usd -= apply_usd;

    let apply_cup = recv_cup.min(bal_cup);
    bal_cup -= apply_cup;
    recv_cup -= apply_cup;

    // Cross: leftover USD → CUP debt.
    if recv_usd > EPS && bal_cup > EPS && rate > EPS {
        let cup_from_usd = recv_usd * rate;
        let use_cup = cup_from_usd.min(bal_cup);
        let use_usd = use_cup / rate;
        bal_cup -= use_cup;
        recv_usd -= use_usd;
    }
    // Cross: leftover CUP → USD debt.
    if recv_cup > EPS && bal_usd > EPS && rate > EPS {
        let usd_from_cup = recv_cup / rate;
        let use_usd = usd_from_cup.min(bal_usd);
        let use_cup = use_usd * rate;
        bal_usd -= use_usd;
        recv_cup -= use_cup;
    }

    let paid_usd = apply_usd + (if rate > EPS {
        // recompute from original - remaining applied via cross is harder; track differently
        0.0
    } else {
        0.0
    });
    let _ = paid_usd;

    // Return remaining balances and leftover received (excess).
    (bal_usd, bal_cup, recv_usd, recv_cup, apply_usd, apply_cup)
}

/// Aplica recibido y calcula aplicados + exceso con cruce correcto.
fn settle_dual_payment(
    bal_usd: f64,
    bal_cup: f64,
    recv_usd: f64,
    recv_cup: f64,
    rate: f64,
) -> (f64, f64, f64, f64, f64, f64) {
    let (new_bal_usd, new_bal_cup, excess_usd, excess_cup, _, _) =
        apply_received_to_balances(bal_usd, bal_cup, recv_usd, recv_cup, rate);
    let applied_usd = (bal_usd - new_bal_usd).max(0.0);
    let applied_cup = (bal_cup - new_bal_cup).max(0.0);
    (
        new_bal_usd,
        new_bal_cup,
        excess_usd,
        excess_cup,
        applied_usd,
        applied_cup,
    )
}

fn validate_dual_change(
    excess_cup_equiv: f64,
    change_cup: f64,
    change_usd: f64,
    rate: f64,
    change_counts: &Option<HashMap<String, i64>>,
    change_usd_counts: &Option<HashMap<String, i64>>,
    disposition: &OverpaymentDisposition,
) -> Result<(Option<String>, Option<String>), String> {
    if *disposition == OverpaymentDisposition::Credit || excess_cup_equiv <= 0.5 {
        return Ok((None, None));
    }

    let mut counted_cup = 0.0;
    let mut cup_json = None;
    if let Some(c) = change_counts {
        counted_cup = sum_from_counts(c, DENOMINATIONS)?;
        if counted_cup > EPS {
            cup_json = Some(serde_json::to_string(c).map_err(|e| e.to_string())?);
        }
    } else if change_cup > 0.5 {
        return Err("Desglosa el vuelto en CUP o elige saldo a favor".to_string());
    }

    let mut counted_usd = 0.0;
    let mut usd_json = None;
    if let Some(c) = change_usd_counts {
        counted_usd = sum_from_counts(c, USD_DENOMINATIONS)?;
        if counted_usd > EPS {
            usd_json = Some(serde_json::to_string(c).map_err(|e| e.to_string())?);
        }
    } else if change_usd > 0.5 {
        return Err("Desglosa el vuelto en USD o elige saldo a favor".to_string());
    }

    let change_equiv = cup_equiv(counted_usd.max(change_usd), counted_cup.max(change_cup), rate);
    if change_equiv <= 0.5 && excess_cup_equiv > 0.5 {
        return Err(
            "Hay vuelto por entregar: desglosa billetes CUP y/o USD, o deja saldo a favor"
                .to_string(),
        );
    }
    if (change_equiv - excess_cup_equiv).abs() > 0.5 + rate.max(1.0) * 0.01 {
        return Err(format!(
            "El vuelto ({:.2} CUP equiv.) no coincide con el exceso ({:.2} CUP equiv.).",
            change_equiv, excess_cup_equiv
        ));
    }
    Ok((cup_json, usd_json))
}

/// Aplica crédito CUP del cliente solo contra `balance_cup`.
pub fn apply_client_credit_to_invoice_in_tx(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    apply: bool,
) -> Result<f64, String> {
    if !apply {
        return Ok(0.0);
    }

    let (
        client_id,
        total,
        paid,
        _balance,
        balance_cup,
        balance_usd,
        paid_usd,
        rate,
        production_status,
        credit_applied_prev,
    ): (i64, f64, f64, f64, f64, f64, f64, f64, String, f64) = tx
        .query_row(
            "SELECT client_id, total, paid, balance,
                    COALESCE(due_cup, balance), COALESCE(balance_usd, 0), COALESCE(paid_usd, 0),
                    COALESCE(exchange_rate_snapshot, 0), production_status,
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
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                ))
            },
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;

    // Prefer balance_cup column if present (migration); fallback due_cup was wrong — use COALESCE(balance - balance_usd*rate)
    let bal_cup: f64 = tx
        .query_row(
            "SELECT COALESCE(balance - COALESCE(balance_usd,0) * COALESCE(exchange_rate_snapshot,0), balance)
             FROM invoices WHERE id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .unwrap_or(balance_cup);
    let bal_cup = bal_cup.max(0.0);
    let _ = (balance_cup, paid_usd);

    if bal_cup <= EPS {
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

    let credit_to_apply = credit_balance.min(bal_cup);
    if credit_to_apply <= EPS {
        return Ok(0.0);
    }

    let new_bal_cup = (bal_cup - credit_to_apply).max(0.0);
    let new_paid = paid + credit_to_apply;
    let new_balance = cup_equiv(balance_usd, new_bal_cup, rate);
    let payment_status = if new_balance <= EPS {
        "cobrado"
    } else {
        "pendiente"
    };
    let status = sync_legacy_status(&production_status, payment_status, new_balance, new_paid);

    tx.execute(
        "UPDATE invoices SET paid = ?1, balance = ?2, status = ?3, payment_status = ?4,
         credit_applied = ?5,
         due_cup = CASE WHEN due_cup > 0 THEN MAX(0, due_cup - ?6) ELSE due_cup END
         WHERE id = ?7 AND deleted_at IS NULL",
        params![
            new_paid,
            new_balance,
            status,
            payment_status,
            credit_applied_prev + credit_to_apply,
            credit_to_apply,
            invoice_id
        ],
    )
    .map_err(|e| e.to_string())?;

    // Also reduce mirror: store remaining cup in amount_cup for UI if needed — update balance fields
    let _ = total;
    let _ = client_balance;

    tx.execute(
        "UPDATE clients SET balance = MAX(0, balance - ?1), credit_balance = COALESCE(credit_balance, 0) - ?1,
         updated_at = datetime('now')
         WHERE id = ?2 AND deleted_at IS NULL",
        params![credit_to_apply, client_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(credit_to_apply)
}

/// Lee saldos duales del pedido.
/// Retorna: client_id, total, paid, balance, total_usd, paid_usd, bal_usd, bal_cup, rate,
/// payment_method, production_status, credit_added.
fn invoice_dual_balances(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
) -> Result<(i64, f64, f64, f64, f64, f64, f64, f64, f64, Option<String>, String, f64), String> {
    tx.query_row(
        "SELECT client_id, total, paid, balance,
                COALESCE(total_usd, 0), COALESCE(paid_usd, 0), COALESCE(balance_usd, 0),
                payment_method, production_status, COALESCE(credit_added, 0),
                COALESCE(exchange_rate_snapshot, 0)
         FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
        params![invoice_id],
        |row| {
            let balance: f64 = row.get(3)?;
            let balance_usd: f64 = row.get(6)?;
            let rate: f64 = row.get(10)?;
            let bal_cup = (balance - balance_usd * rate.max(0.0)).max(0.0);
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                balance,
                row.get(4)?,
                row.get(5)?,
                balance_usd,
                bal_cup,
                rate,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
            ))
        },
    )
    .map_err(|_| "Pedido no encontrado".to_string())
}

/// Records an advance payment as cash income linked to an invoice.
pub fn record_advance_payment_in_tx(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    invoice_number: &str,
    client_id: i64,
    subtotal_cup: f64,
    detail: Option<&AdvancePaymentPayload>,
    legacy_advance_cup: f64,
    legacy_payment_method: &str,
) -> Result<AdvancePaymentResult, String> {
    let Some(detail) = detail else {
        if legacy_advance_cup <= EPS {
            return Ok(AdvancePaymentResult {
                advance_cup: 0.0,
                advance_usd: 0.0,
                credit_added: 0.0,
                change_given: 0.0,
                change_given_usd: 0.0,
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
            advance_usd: 0.0,
            credit_added: 0.0,
            change_given: 0.0,
            change_given_usd: 0.0,
        });
    };

    let method = detail.payment_method.trim().to_lowercase();
    if method != "efectivo" && method != "transferencia" {
        return Err("Método de pago del anticipo inválido".to_string());
    }

    let (received_cup, received_usd, rate, tx_method) = resolve_dual_received(
        &method,
        &detail.counts,
        &detail.usd_counts,
        detail.amount_cup,
        detail.amount_usd,
        detail.exchange_rate,
    )?;

    let received_equiv = cup_equiv(received_usd, received_cup, rate);
    if received_equiv <= EPS {
        return Ok(AdvancePaymentResult {
            advance_cup: 0.0,
            advance_usd: 0.0,
            credit_added: 0.0,
            change_given: 0.0,
            change_given_usd: 0.0,
        });
    }

    let advance_equiv = received_equiv.min(subtotal_cup);
    let excess_equiv = (received_equiv - subtotal_cup).max(0.0);
    let disposition = OverpaymentDisposition::parse(detail.overpayment_disposition.as_deref());

    // Pro-rate advance between currencies by received share.
    let (_advance_cup, advance_usd) = if received_equiv > EPS {
        let share_cup = received_cup / received_equiv;
        let share_usd = (received_usd * rate) / received_equiv;
        (advance_equiv * share_cup, if rate > EPS {
            (advance_equiv * share_usd) / rate
        } else {
            0.0
        })
    } else {
        (0.0, 0.0)
    };

    let (change_given, change_given_usd, credit_added) = if excess_equiv > EPS {
        match disposition {
            OverpaymentDisposition::Change => {
                // Prefer returning excess in the currencies received.
                let mut rem = excess_equiv;
                let mut ch_usd = 0.0;
                if received_usd > EPS && rate > EPS {
                    let max_usd_change = (received_usd - advance_usd).max(0.0);
                    let want = (rem / rate).min(max_usd_change);
                    ch_usd = want;
                    rem -= want * rate;
                }
                let ch_cup = rem.max(0.0);
                (ch_cup, ch_usd, 0.0)
            }
            OverpaymentDisposition::Credit => (0.0, 0.0, excess_equiv),
        }
    } else {
        (0.0, 0.0, 0.0)
    };

    let (change_cup_json, change_usd_json) = validate_dual_change(
        excess_equiv,
        change_given,
        change_given_usd,
        rate,
        &detail.change_counts,
        &detail.change_usd_counts,
        &disposition,
    )?;

    let net_cup = (received_cup - change_given).max(0.0);
    let net_usd = (received_usd - change_given_usd).max(0.0);
    let cash_ingreso_cup = if credit_added > EPS {
        received_cup
    } else {
        net_cup
    };
    let cash_ingreso_usd = if credit_added > EPS {
        received_usd
    } else {
        net_usd
    };

    let breakdown_json = detail
        .counts
        .as_ref()
        .map(|c| serde_json::to_string(c))
        .transpose()
        .map_err(|e| e.to_string())?;
    let breakdown_usd_json = detail
        .usd_counts
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
    } else if cash_ingreso_usd > EPS && cash_ingreso_cup > EPS {
        format!(
            "Anticipo pedido {} (mixto USD {:.2} + CUP {:.2} @ {:.0})",
            invoice_number, cash_ingreso_usd, cash_ingreso_cup, rate
        )
    } else if cash_ingreso_usd > EPS {
        format!(
            "Anticipo pedido {} (USD {:.2} @ {:.0})",
            invoice_number, cash_ingreso_usd, rate
        )
    } else {
        format!("Anticipo pedido {}", invoice_number)
    };

    if tx_method == "efectivo"
        && (breakdown_json.is_some()
            || breakdown_usd_json.is_some()
            || change_cup_json.is_some()
            || change_usd_json.is_some())
    {
        tx.execute(
            "INSERT INTO cash_sessions (
                invoice_id, total_amount, amount_received, change_given,
                amount_received_usd, change_given_usd,
                denomination_breakdown, change_breakdown,
                denomination_breakdown_usd, change_breakdown_usd
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                invoice_id,
                advance_equiv,
                received_cup,
                change_given,
                received_usd,
                change_given_usd,
                breakdown_json,
                change_cup_json,
                breakdown_usd_json,
                change_usd_json
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
            cash_ingreso_cup,
            cash_ingreso_usd,
            rate,
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
        advance_cup: advance_equiv,
        advance_usd,
        credit_added,
        change_given,
        change_given_usd,
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
        _total,
        paid,
        _balance,
        _total_usd,
        paid_usd,
        bal_usd,
        bal_cup,
        rate_snap,
        payment_method,
        production_status,
        credit_added_prev,
    ) = invoice_dual_balances(tx, payload.invoice_id)?;

    let rate = payload.exchange_rate.unwrap_or(rate_snap).max(rate_snap);
    let method = payment_method
        .as_deref()
        .unwrap_or("efectivo")
        .to_string();

    let has_cash_intent = payload.amount_cup.unwrap_or(0.0) > EPS
        || payload.amount_usd.unwrap_or(0.0) > EPS
        || payload
            .counts
            .as_ref()
            .map(|c| c.values().any(|&n| n > 0))
            .unwrap_or(false)
        || payload
            .usd_counts
            .as_ref()
            .map(|c| c.values().any(|&n| n > 0))
            .unwrap_or(false);

    if !has_cash_intent {
        if credit_applied <= EPS && cup_equiv(bal_usd, bal_cup, rate) <= EPS {
            return Err("Este pedido no tiene saldo pendiente".to_string());
        }
        if credit_applied <= EPS {
            return Err("Indica el monto recibido o el conteo de billetes".to_string());
        }
        let new_balance = cup_equiv(bal_usd, bal_cup, rate);
        let payment_status = if new_balance <= EPS {
            "cobrado"
        } else {
            "pendiente"
        };
        let status = sync_legacy_status(&production_status, payment_status, new_balance, paid);
        return Ok(CashierRegisterResponse {
            session_id: None,
            amount_received: 0.0,
            amount_received_usd: 0.0,
            change_given: 0.0,
            change_given_usd: 0.0,
            amount_applied: credit_applied,
            amount_applied_usd: 0.0,
            credit_applied,
            credit_added: 0.0,
            invoice_new_balance: new_balance,
            invoice_new_balance_usd: bal_usd,
            invoice_status: status,
            payment_status: payment_status.to_string(),
        });
    }

    if cup_equiv(bal_usd, bal_cup, rate) <= EPS {
        return Err("Este pedido no tiene saldo pendiente".to_string());
    }

    let (received_cup, received_usd, recv_rate, tx_method) = resolve_dual_received(
        &method,
        &payload.counts,
        &payload.usd_counts,
        payload.amount_cup,
        payload.amount_usd,
        if rate > EPS { Some(rate) } else { payload.exchange_rate },
    )?;
    let rate = if recv_rate > EPS { recv_rate } else { rate };

    let (new_bal_usd, new_bal_cup, excess_usd, excess_cup, applied_usd, applied_cup) =
        settle_dual_payment(bal_usd, bal_cup, received_usd, received_cup, rate);

    let excess_equiv = cup_equiv(excess_usd, excess_cup, rate);
    let disposition = OverpaymentDisposition::parse(payload.overpayment_disposition.as_deref());

    let (change_given, change_given_usd, credit_added) = if excess_equiv > EPS {
        match disposition {
            OverpaymentDisposition::Change => (excess_cup, excess_usd, 0.0),
            OverpaymentDisposition::Credit => (0.0, 0.0, excess_equiv),
        }
    } else {
        (0.0, 0.0, 0.0)
    };

    let (change_cup_json, change_usd_json) = validate_dual_change(
        excess_equiv,
        change_given,
        change_given_usd,
        rate,
        &payload.change_counts,
        &payload.change_usd_counts,
        &disposition,
    )?;

    let applied_equiv = cup_equiv(applied_usd, applied_cup, rate);
    let new_paid = paid + applied_equiv;
    let new_paid_usd = paid_usd + applied_usd;
    let new_balance = cup_equiv(new_bal_usd, new_bal_cup, rate);
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

    let new_client_balance = (client_balance - applied_equiv).max(0.0);
    let new_credit_balance = credit_balance + credit_added;

    let breakdown_json = payload
        .counts
        .as_ref()
        .map(|c| serde_json::to_string(c))
        .transpose()
        .map_err(|e| e.to_string())?;
    let breakdown_usd_json = payload
        .usd_counts
        .as_ref()
        .map(|c| serde_json::to_string(c))
        .transpose()
        .map_err(|e| e.to_string())?;

    let mut session_id: Option<i64> = None;
    if tx_method == "efectivo"
        && (breakdown_json.is_some()
            || breakdown_usd_json.is_some()
            || change_cup_json.is_some()
            || change_usd_json.is_some())
    {
        tx.execute(
            "INSERT INTO cash_sessions (
                invoice_id, total_amount, amount_received, change_given,
                amount_received_usd, change_given_usd,
                denomination_breakdown, change_breakdown,
                denomination_breakdown_usd, change_breakdown_usd
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                payload.invoice_id,
                applied_equiv,
                received_cup,
                change_given,
                received_usd,
                change_given_usd,
                breakdown_json,
                change_cup_json,
                breakdown_usd_json,
                change_usd_json
            ],
        )
        .map_err(|e| e.to_string())?;
        session_id = Some(tx.last_insert_rowid());
    }

    let net_cup = if credit_added > EPS {
        received_cup
    } else {
        (received_cup - change_given).max(0.0)
    };
    let net_usd = if credit_added > EPS {
        received_usd
    } else {
        (received_usd - change_given_usd).max(0.0)
    };

    let concept = if method == "transferencia" {
        let extra = payload
            .transfer_concept
            .as_ref()
            .map(|c| format!(" · {}", c.trim()))
            .unwrap_or_default();
        format!("Cobro pedido #{} (transferencia){}", payload.invoice_id, extra)
    } else if net_usd > EPS && net_cup > EPS {
        format!(
            "Cobro pedido #{} (mixto USD {:.2} + CUP {:.2} @ {:.0})",
            payload.invoice_id, net_usd, net_cup, rate
        )
    } else if net_usd > EPS {
        format!(
            "Cobro pedido #{} (USD {:.2} @ {:.0})",
            payload.invoice_id, net_usd, rate
        )
    } else {
        format!("Cobro pedido #{}", payload.invoice_id)
    };

    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES ('ingreso', ?1, 'pedido', ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            concept,
            payload.invoice_id,
            net_cup,
            net_usd,
            rate,
            tx_method,
            breakdown_json
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE invoices SET paid = ?1, balance = ?2, status = ?3, payment_status = ?4,
         credit_added = ?5, paid_usd = ?6, balance_usd = ?7, amount_cup = ?2, amount_usd = ?7
         WHERE id = ?8 AND deleted_at IS NULL",
        params![
            new_paid,
            new_balance,
            status,
            payment_status,
            credit_added_prev + credit_added,
            new_paid_usd,
            new_bal_usd,
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
        amount_received: received_cup,
        amount_received_usd: received_usd,
        change_given,
        change_given_usd,
        amount_applied: applied_equiv + credit_applied,
        amount_applied_usd: applied_usd,
        credit_applied,
        credit_added,
        invoice_new_balance: new_balance,
        invoice_new_balance_usd: new_bal_usd,
        invoice_status: status,
        payment_status: payment_status.to_string(),
    })
}

/// Lists cash sessions for an invoice, newest first.
#[tauri::command]
pub fn cashier_sessions_for_invoice(invoice_id: i64) -> Result<Vec<CashSessionDto>, String> {
    let conn = db::open_connection()?;
    let has_usd = conn
        .prepare("SELECT amount_received_usd FROM cash_sessions LIMIT 0")
        .is_ok();
    if has_usd {
        let mut stmt = conn
            .prepare(
                "SELECT id, invoice_id, total_amount, amount_received, change_given,
                        COALESCE(amount_received_usd, 0), COALESCE(change_given_usd, 0),
                        date, denomination_breakdown
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
                    amount_received_usd: row.get(5)?,
                    change_given_usd: row.get(6)?,
                    date: row.get(7)?,
                    denomination_breakdown: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        return rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string());
    }
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
                amount_received_usd: 0.0,
                change_given_usd: 0.0,
                date: row.get(5)?,
                denomination_breakdown: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Registers payment: updates invoice, client balance, cash_transactions and optional cash_sessions.
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
