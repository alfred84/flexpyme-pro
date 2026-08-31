//! Control de efectivo: saldo inicial del mes y monitoreo por denominación CUP/USD.

use std::collections::{HashMap, HashSet};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::commands::cashier::{DENOMINATIONS, USD_DENOMINATIONS};
use crate::db;

/// Una fila de denominación en el control de efectivo.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CashControlLineDto {
    pub denomination: i64,
    pub opening_qty: i64,
    pub in_qty: i64,
    pub out_qty: i64,
    pub estimated_qty: i64,
    pub opening_subtotal: f64,
    pub estimated_subtotal: f64,
}

/// Resumen de una moneda (CUP o USD).
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CashControlCurrencyDto {
    pub currency: String,
    pub has_opening: bool,
    pub opening_total: f64,
    pub in_total: f64,
    pub out_total: f64,
    pub estimated_total: f64,
    pub ledger_balance: f64,
    pub lines: Vec<CashControlLineDto>,
}

/// Totales de un día calendario dentro del mes (estimado al cierre).
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CashControlDayDto {
    pub date: String,
    pub in_total_cup: f64,
    pub out_total_cup: f64,
    pub estimated_total_cup: f64,
    pub in_total_usd: f64,
    pub out_total_usd: f64,
    pub estimated_total_usd: f64,
    pub has_movement: bool,
    pub has_declared_opening: bool,
}

/// Vista de control de efectivo para un mes (`YYYY-MM`) y, opcionalmente, un día.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CashControlSummaryDto {
    pub month: String,
    pub selected_day: Option<String>,
    pub opening_updated_at: Option<String>,
    pub notes: Option<String>,
    pub cup: CashControlCurrencyDto,
    pub usd: CashControlCurrencyDto,
    pub day_cup: Option<CashControlCurrencyDto>,
    pub day_usd: Option<CashControlCurrencyDto>,
    pub day_notes: Option<String>,
    pub day_opening_updated_at: Option<String>,
    pub days: Vec<CashControlDayDto>,
}

/// Payload para guardar el conteo inicial del mes.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCashOpeningPayload {
    pub month: String,
    pub counts_cup: HashMap<String, f64>,
    pub counts_usd: HashMap<String, f64>,
    pub notes: Option<String>,
}

/// Payload para guardar el conteo inicial de un día.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCashDayOpeningPayload {
    pub day: String,
    pub counts_cup: HashMap<String, f64>,
    pub counts_usd: HashMap<String, f64>,
    pub notes: Option<String>,
}

fn normalize_month(raw: &str) -> Result<String, String> {
    let month = raw.trim();
    if month.len() == 7
        && month.as_bytes().get(4) == Some(&b'-')
        && month[..4].chars().all(|c| c.is_ascii_digit())
        && month[5..].chars().all(|c| c.is_ascii_digit())
    {
        let mm: u32 = month[5..].parse().unwrap_or(0);
        if (1..=12).contains(&mm) {
            return Ok(month.to_string());
        }
    }
    Err("Mes inválido. Use el formato AAAA-MM.".to_string())
}

fn denoms_for(currency: &str) -> &'static [i64] {
    if currency == "USD" {
        USD_DENOMINATIONS
    } else {
        DENOMINATIONS
    }
}

fn qty_from_map(map: &HashMap<i64, i64>, denom: i64) -> i64 {
    *map.get(&denom).unwrap_or(&0)
}

fn add_qty(map: &mut HashMap<i64, i64>, denom: i64, delta: i64) {
    if delta == 0 {
        return;
    }
    *map.entry(denom).or_insert(0) += delta;
}

fn merge_counts(target: &mut HashMap<i64, i64>, source: &HashMap<i64, i64>, sign: i64) {
    for (denom, qty) in source {
        add_qty(target, *denom, *qty * sign);
    }
}

fn json_qty(value: &serde_json::Value) -> i64 {
    value
        .as_i64()
        .unwrap_or_else(|| value.as_f64().map(|n| n.floor() as i64).unwrap_or(0))
}

fn counts_from_frontend(raw: &HashMap<String, f64>, currency: &str) -> HashMap<i64, i64> {
    let allowed: HashSet<i64> = denoms_for(currency).iter().copied().collect();
    let mut out = HashMap::new();
    for (key, value) in raw {
        let denom: i64 = key.parse().unwrap_or(0);
        if !allowed.contains(&denom) {
            continue;
        }
        let qty = if value.is_finite() && *value > 0.0 {
            value.floor() as i64
        } else {
            0
        };
        if qty > 0 {
            out.insert(denom, qty);
        }
    }
    out
}

fn object_to_counts(
    obj: &serde_json::Map<String, serde_json::Value>,
    allowed: &HashSet<i64>,
) -> HashMap<i64, i64> {
    let mut out = HashMap::new();
    for (key, value) in obj {
        let denom: i64 = key.parse().unwrap_or(0);
        if !allowed.contains(&denom) {
            continue;
        }
        let qty = json_qty(value);
        if qty > 0 {
            out.insert(denom, qty);
        }
    }
    out
}

fn extract_counts_value(value: &serde_json::Value, allowed: &HashSet<i64>) -> HashMap<i64, i64> {
    if let Some(counts) = value.get("counts").and_then(|c| c.as_object()) {
        return object_to_counts(counts, allowed);
    }
    if let Some(obj) = value.as_object() {
        let filtered: serde_json::Map<String, serde_json::Value> = obj
            .iter()
            .filter(|(k, _)| k.parse::<i64>().is_ok())
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        return object_to_counts(&filtered, allowed);
    }
    HashMap::new()
}

/// Infers CUP vs USD for untagged maps using exclusive denominations.
fn infer_untagged_currency(value: &serde_json::Value) -> Option<&'static str> {
    let obj = value.as_object()?;
    let cup_only: HashSet<i64> = [200, 500, 1000, 2000, 5000].into_iter().collect();
    let usd_only: HashSet<i64> = [2].into_iter().collect();
    let mut has_cup_only = false;
    let mut has_usd_only = false;
    let mut has_any = false;
    for (key, val) in obj {
        let Ok(denom) = key.parse::<i64>() else {
            continue;
        };
        if json_qty(val) <= 0 {
            continue;
        }
        has_any = true;
        if cup_only.contains(&denom) {
            has_cup_only = true;
        }
        if usd_only.contains(&denom) {
            has_usd_only = true;
        }
    }
    if !has_any {
        return None;
    }
    if has_cup_only && !has_usd_only {
        return Some("CUP");
    }
    if has_usd_only && !has_cup_only {
        return Some("USD");
    }
    if has_cup_only && has_usd_only {
        return None;
    }
    Some("CUP")
}

fn parse_breakdown_for_currency(
    raw: &str,
    currency: &str,
    untagged_as: Option<&str>,
) -> HashMap<i64, i64> {
    let allowed: HashSet<i64> = denoms_for(currency).iter().copied().collect();
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else {
        return HashMap::new();
    };
    if value.get("mixto").and_then(|m| m.as_bool()) == Some(true) {
        let key = if currency == "USD" { "usd" } else { "cup" };
        if let Some(side) = value.get(key) {
            return extract_counts_value(side, &allowed);
        }
        return HashMap::new();
    }
    if let Some(tagged) = value.get("currency").and_then(|c| c.as_str()) {
        if tagged.to_uppercase() != currency {
            return HashMap::new();
        }
        return extract_counts_value(&value, &allowed);
    }
    if let Some(column_currency) = untagged_as {
        if column_currency != currency {
            return HashMap::new();
        }
        return extract_counts_value(&value, &allowed);
    }
    if let Some(inferred) = infer_untagged_currency(&value) {
        if inferred != currency {
            return HashMap::new();
        }
    }
    extract_counts_value(&value, &allowed)
}

fn serialize_counts(map: &HashMap<i64, i64>, currency: &str) -> Option<String> {
    let mut counts = serde_json::Map::new();
    let mut any = false;
    for denom in denoms_for(currency) {
        let qty = qty_from_map(map, *denom);
        if qty > 0 {
            any = true;
            counts.insert(denom.to_string(), serde_json::json!(qty));
        }
    }
    if !any {
        return None;
    }
    serde_json::to_string(&serde_json::json!({
        "currency": currency,
        "counts": counts
    }))
    .ok()
}

fn parse_stored_opening(raw: Option<&str>, currency: &str) -> HashMap<i64, i64> {
    match raw {
        Some(s) if !s.trim().is_empty() => parse_breakdown_for_currency(s, currency, Some(currency)),
        _ => HashMap::new(),
    }
}

fn total_of(map: &HashMap<i64, i64>, currency: &str) -> f64 {
    denoms_for(currency)
        .iter()
        .map(|d| (*d as f64) * (qty_from_map(map, *d) as f64))
        .sum()
}

fn build_currency(
    currency: &str,
    opening: &HashMap<i64, i64>,
    ins: &HashMap<i64, i64>,
    outs: &HashMap<i64, i64>,
    has_opening: bool,
    ledger_balance: f64,
) -> CashControlCurrencyDto {
    let lines: Vec<CashControlLineDto> = denoms_for(currency)
        .iter()
        .map(|denom| {
            let opening_qty = qty_from_map(opening, *denom);
            let in_qty = qty_from_map(ins, *denom);
            let out_qty = qty_from_map(outs, *denom);
            let estimated_qty = opening_qty + in_qty - out_qty;
            CashControlLineDto {
                denomination: *denom,
                opening_qty,
                in_qty,
                out_qty,
                estimated_qty,
                opening_subtotal: (*denom as f64) * (opening_qty as f64),
                estimated_subtotal: (*denom as f64) * (estimated_qty as f64),
            }
        })
        .collect();
    let opening_total = total_of(opening, currency);
    let in_total = total_of(ins, currency);
    let out_total = total_of(outs, currency);
    CashControlCurrencyDto {
        currency: currency.to_string(),
        has_opening,
        opening_total,
        in_total,
        out_total,
        estimated_total: opening_total + in_total - out_total,
        ledger_balance,
        lines,
    }
}

#[derive(Clone, Default)]
struct DayFlow {
    in_cup: HashMap<i64, i64>,
    out_cup: HashMap<i64, i64>,
    in_usd: HashMap<i64, i64>,
    out_usd: HashMap<i64, i64>,
}

fn month_date_clause(column: &str) -> String {
    format!(
        "date({column}) >= date(?1 || '-01')
         AND date({column}) < date(?1 || '-01', '+1 month')"
    )
}

fn normalize_day(raw: &str) -> Result<String, String> {
    let day = raw.trim();
    if day.len() == 10
        && day.as_bytes().get(4) == Some(&b'-')
        && day.as_bytes().get(7) == Some(&b'-')
        && day[..4].chars().all(|c| c.is_ascii_digit())
        && day[5..7].chars().all(|c| c.is_ascii_digit())
        && day[8..].chars().all(|c| c.is_ascii_digit())
    {
        let mm: u32 = day[5..7].parse().unwrap_or(0);
        let dd: u32 = day[8..].parse().unwrap_or(0);
        if (1..=12).contains(&mm) && (1..=31).contains(&dd) {
            return Ok(day.to_string());
        }
    }
    Err("Fecha inválida. Use el formato AAAA-MM-DD.".to_string())
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
            if leap {
                29
            } else {
                28
            }
        }
        _ => 31,
    }
}

fn dates_in_month(month: &str) -> Vec<String> {
    let year: i32 = month[..4].parse().unwrap_or(2026);
    let mm: u32 = month[5..].parse().unwrap_or(1);
    let last = days_in_month(year, mm);
    (1..=last)
        .map(|d| format!("{}-{:02}", month, d))
        .collect()
}

fn day_flow_mut<'a>(days: &'a mut HashMap<String, DayFlow>, date: &str) -> &'a mut DayFlow {
    days.entry(date.to_string()).or_default()
}

fn apply_net(target: &mut HashMap<i64, i64>, ins: &HashMap<i64, i64>, outs: &HashMap<i64, i64>) {
    merge_counts(target, ins, 1);
    merge_counts(target, outs, -1);
}

fn opening_at_day(
    month_opening: &HashMap<i64, i64>,
    days: &HashMap<String, DayFlow>,
    month: &str,
    day: &str,
    currency: &str,
) -> HashMap<i64, i64> {
    let mut running = month_opening.clone();
    for date in dates_in_month(month) {
        if date.as_str() >= day {
            break;
        }
        if let Some(flow) = days.get(&date) {
            if currency == "USD" {
                apply_net(&mut running, &flow.in_usd, &flow.out_usd);
            } else {
                apply_net(&mut running, &flow.in_cup, &flow.out_cup);
            }
        }
    }
    running
}

fn build_day_rows(
    month: &str,
    opening_cup: &HashMap<i64, i64>,
    opening_usd: &HashMap<i64, i64>,
    days: &HashMap<String, DayFlow>,
    declared: &HashSet<String>,
) -> Vec<CashControlDayDto> {
    let mut run_cup = total_of(opening_cup, "CUP");
    let mut run_usd = total_of(opening_usd, "USD");
    dates_in_month(month)
        .into_iter()
        .map(|date| {
            let empty = DayFlow::default();
            let flow = days.get(&date).unwrap_or(&empty);
            let in_cup = total_of(&flow.in_cup, "CUP");
            let out_cup = total_of(&flow.out_cup, "CUP");
            let in_usd = total_of(&flow.in_usd, "USD");
            let out_usd = total_of(&flow.out_usd, "USD");
            run_cup += in_cup - out_cup;
            run_usd += in_usd - out_usd;
            let has_movement = in_cup.abs() + out_cup.abs() + in_usd.abs() + out_usd.abs() > 0.0;
            let has_declared_opening = declared.contains(&date);
            CashControlDayDto {
                date,
                in_total_cup: in_cup,
                out_total_cup: out_cup,
                estimated_total_cup: run_cup,
                in_total_usd: in_usd,
                out_total_usd: out_usd,
                estimated_total_usd: run_usd,
                has_movement,
                has_declared_opening,
            }
        })
        .collect()
}

/// Resumen de control de efectivo del mes y, si se indica, de un día.
#[tauri::command]
pub fn cash_control_summary(
    month: String,
    day: Option<String>,
) -> Result<CashControlSummaryDto, String> {
    let month = normalize_month(&month)?;
    let selected_day = match day.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(raw) => {
            let normalized = normalize_day(raw)?;
            if !normalized.starts_with(&month) {
                return Err("El día debe pertenecer al mes seleccionado.".to_string());
            }
            let last = dates_in_month(&month).pop().unwrap_or_default();
            if normalized > last {
                return Err("El día no existe en ese mes.".to_string());
            }
            Some(normalized)
        }
        None => None,
    };
    let conn = db::open_connection()?;

    let opening_row: Option<(Option<String>, Option<String>, Option<String>, String)> = conn
        .query_row(
            "SELECT counts_cup, counts_usd, notes, updated_at
             FROM cash_month_openings WHERE month = ?1",
            params![month],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (opening_cup, opening_usd, notes, opening_updated_at, has_opening) = match opening_row {
        Some((cup, usd, notes, updated)) => (
            parse_stored_opening(cup.as_deref(), "CUP"),
            parse_stored_opening(usd.as_deref(), "USD"),
            notes,
            Some(updated),
            true,
        ),
        None => (HashMap::new(), HashMap::new(), None, None, false),
    };

    let mut declared_cup: HashMap<String, HashMap<i64, i64>> = HashMap::new();
    let mut declared_usd: HashMap<String, HashMap<i64, i64>> = HashMap::new();
    let mut declared_days: HashSet<String> = HashSet::new();
    let mut day_notes: Option<String> = None;
    let mut day_opening_updated_at: Option<String> = None;

    {
        let sql = format!(
            "SELECT day, counts_cup, counts_usd, notes, updated_at
             FROM cash_day_openings
             WHERE {}",
            month_date_clause("day")
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![month], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (day_key, cup, usd, notes_row, updated) = row.map_err(|e| e.to_string())?;
            declared_cup.insert(day_key.clone(), parse_stored_opening(cup.as_deref(), "CUP"));
            declared_usd.insert(day_key.clone(), parse_stored_opening(usd.as_deref(), "USD"));
            declared_days.insert(day_key.clone());
            if selected_day.as_deref() == Some(day_key.as_str()) {
                day_notes = notes_row;
                day_opening_updated_at = Some(updated);
            }
        }
    }

    let mut days: HashMap<String, DayFlow> = HashMap::new();
    let mut session_invoices: HashSet<i64> = HashSet::new();

    {
        let sql = format!(
            "SELECT date(date), invoice_id, denomination_breakdown, change_breakdown,
                    denomination_breakdown_usd, change_breakdown_usd
             FROM cash_sessions
             WHERE {}",
            month_date_clause("date")
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![month], |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (raw_date, invoice_id, rec_cup, chg_cup, rec_usd, chg_usd) =
                row.map_err(|e| e.to_string())?;
            session_invoices.insert(invoice_id);
            let Some(date) = raw_date.filter(|d| !d.is_empty()) else {
                continue;
            };
            let flow = day_flow_mut(&mut days, &date);
            if let Some(raw) = rec_cup.as_deref() {
                merge_counts(
                    &mut flow.in_cup,
                    &parse_breakdown_for_currency(raw, "CUP", Some("CUP")),
                    1,
                );
            }
            if let Some(raw) = chg_cup.as_deref() {
                merge_counts(
                    &mut flow.out_cup,
                    &parse_breakdown_for_currency(raw, "CUP", Some("CUP")),
                    1,
                );
            }
            if let Some(raw) = rec_usd.as_deref() {
                merge_counts(
                    &mut flow.in_usd,
                    &parse_breakdown_for_currency(raw, "USD", Some("USD")),
                    1,
                );
            }
            if let Some(raw) = chg_usd.as_deref() {
                merge_counts(
                    &mut flow.out_usd,
                    &parse_breakdown_for_currency(raw, "USD", Some("USD")),
                    1,
                );
            }
        }
    }

    {
        let sql = format!(
            "SELECT date(date), type, reference_type, reference_id, denomination_breakdown
             FROM cash_transactions
             WHERE LOWER(payment_method) = 'efectivo'
               AND {}",
            month_date_clause("date")
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![month], |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (raw_date, tx_type, reference_type, reference_id, breakdown) =
                row.map_err(|e| e.to_string())?;
            let is_pedido = reference_type.as_deref() == Some("pedido");
            if is_pedido {
                if let Some(id) = reference_id {
                    if session_invoices.contains(&id) {
                        continue;
                    }
                }
            }
            let Some(raw) = breakdown.as_deref() else {
                continue;
            };
            let Some(date) = raw_date.filter(|d| !d.is_empty()) else {
                continue;
            };
            let cup = parse_breakdown_for_currency(raw, "CUP", None);
            let usd = parse_breakdown_for_currency(raw, "USD", None);
            let flow = day_flow_mut(&mut days, &date);
            let is_ingreso = tx_type.eq_ignore_ascii_case("ingreso");
            if is_ingreso {
                merge_counts(&mut flow.in_cup, &cup, 1);
                merge_counts(&mut flow.in_usd, &usd, 1);
            } else {
                merge_counts(&mut flow.out_cup, &cup, 1);
                merge_counts(&mut flow.out_usd, &usd, 1);
            }
        }
    }

    let mut in_cup: HashMap<i64, i64> = HashMap::new();
    let mut out_cup: HashMap<i64, i64> = HashMap::new();
    let mut in_usd: HashMap<i64, i64> = HashMap::new();
    let mut out_usd: HashMap<i64, i64> = HashMap::new();
    for flow in days.values() {
        merge_counts(&mut in_cup, &flow.in_cup, 1);
        merge_counts(&mut out_cup, &flow.out_cup, 1);
        merge_counts(&mut in_usd, &flow.in_usd, 1);
        merge_counts(&mut out_usd, &flow.out_usd, 1);
    }

    let (ledger_cup, ledger_usd): (f64, f64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_cup ELSE -amount_cup END), 0),
                COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount_usd ELSE -amount_usd END), 0)
             FROM cash_transactions",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let day_detail = selected_day.as_ref().map(|day| {
        let flow = days.get(day).cloned().unwrap_or_default();
        let has_day_opening = declared_days.contains(day);
        let start_cup = declared_cup
            .get(day)
            .cloned()
            .unwrap_or_else(|| opening_at_day(&opening_cup, &days, &month, day, "CUP"));
        let start_usd = declared_usd
            .get(day)
            .cloned()
            .unwrap_or_else(|| opening_at_day(&opening_usd, &days, &month, day, "USD"));
        (
            build_currency(
                "CUP",
                &start_cup,
                &flow.in_cup,
                &flow.out_cup,
                has_day_opening,
                ledger_cup,
            ),
            build_currency(
                "USD",
                &start_usd,
                &flow.in_usd,
                &flow.out_usd,
                has_day_opening,
                ledger_usd,
            ),
        )
    });
    let (day_cup, day_usd) = match day_detail {
        Some((cup, usd)) => (Some(cup), Some(usd)),
        None => (None, None),
    };
    let day_rows = build_day_rows(&month, &opening_cup, &opening_usd, &days, &declared_days);

    Ok(CashControlSummaryDto {
        month,
        selected_day,
        opening_updated_at,
        notes,
        cup: build_currency(
            "CUP",
            &opening_cup,
            &in_cup,
            &out_cup,
            has_opening,
            ledger_cup,
        ),
        usd: build_currency(
            "USD",
            &opening_usd,
            &in_usd,
            &out_usd,
            has_opening,
            ledger_usd,
        ),
        day_cup,
        day_usd,
        day_notes,
        day_opening_updated_at,
        days: day_rows,
    })
}

/// Guarda (o actualiza) el conteo de denominaciones al inicio del mes.
#[tauri::command]
pub fn cash_month_opening_save(payload: SaveCashOpeningPayload) -> Result<(), String> {
    let month = normalize_month(&payload.month)?;
    let cup = counts_from_frontend(&payload.counts_cup, "CUP");
    let usd = counts_from_frontend(&payload.counts_usd, "USD");
    let notes = payload
        .notes
        .as_ref()
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty());

    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO cash_month_openings (month, counts_cup, counts_usd, notes, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(month) DO UPDATE SET
            counts_cup = excluded.counts_cup,
            counts_usd = excluded.counts_usd,
            notes = excluded.notes,
            updated_at = datetime('now')",
        params![
            month,
            serialize_counts(&cup, "CUP"),
            serialize_counts(&usd, "USD"),
            notes
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Guarda (o actualiza) el conteo de denominaciones al inicio del día.
#[tauri::command]
pub fn cash_day_opening_save(payload: SaveCashDayOpeningPayload) -> Result<(), String> {
    let day = normalize_day(&payload.day)?;
    let month = day[..7].to_string();
    let last = dates_in_month(&month).pop().unwrap_or_default();
    if day > last {
        return Err("El día no existe en ese mes.".to_string());
    }
    let cup = counts_from_frontend(&payload.counts_cup, "CUP");
    let usd = counts_from_frontend(&payload.counts_usd, "USD");
    let notes = payload
        .notes
        .as_ref()
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty());

    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO cash_day_openings (day, counts_cup, counts_usd, notes, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(day) DO UPDATE SET
            counts_cup = excluded.counts_cup,
            counts_usd = excluded.counts_usd,
            notes = excluded.notes,
            updated_at = datetime('now')",
        params![
            day,
            serialize_counts(&cup, "CUP"),
            serialize_counts(&usd, "USD"),
            notes
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
