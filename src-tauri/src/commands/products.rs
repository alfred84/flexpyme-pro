//! Product catalog and price list commands (SQLite via rusqlite).

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Product category row for dropdowns and tables.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDto {
    pub id: i64,
    pub name: String,
}

/// Format row for dropdowns and tables.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatDto {
    pub id: i64,
    pub label: String,
}

/// Price list row with joined labels and dual-currency sale prices.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceRowDto {
    pub id: i64,
    pub category_id: i64,
    pub category_name: String,
    pub format_id: Option<i64>,
    pub format_label: Option<String>,
    pub finish: Option<String>,
    pub service: Option<String>,
    /// Precio CUP legado (espejo de `price_cup` cuando CUP está activo).
    pub price: f64,
    pub price_cup: Option<f64>,
    pub price_usd: Option<f64>,
    pub is_cup_active: bool,
    pub is_usd_active: bool,
    pub cost: Option<f64>,
    pub valid_from: String,
    pub is_active: bool,
}

/// Arguments for listing prices (camelCase from frontend invoke).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricesListArgs {
    pub include_inactive: bool,
}

/// Payload for creating a price list row (CUP and/or USD).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePricePayload {
    pub category_id: i64,
    pub format_id: Option<i64>,
    pub finish: Option<String>,
    pub service: String,
    pub price_cup: Option<f64>,
    pub price_usd: Option<f64>,
    pub is_cup_active: bool,
    pub is_usd_active: bool,
    pub cost: Option<f64>,
    pub is_active: bool,
}

/// Payload for updating a price list row (CUP and/or USD).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePricePayload {
    pub id: i64,
    pub price_cup: Option<f64>,
    pub price_usd: Option<f64>,
    pub is_cup_active: bool,
    pub is_usd_active: bool,
    pub cost: Option<f64>,
    pub is_active: bool,
}

fn read_usd_exchange_rate(conn: &rusqlite::Connection) -> f64 {
    conn.query_row(
        "SELECT value FROM settings WHERE key = 'usd_exchange_rate'",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|v| v.parse::<f64>().ok())
    .filter(|r| *r > 0.0)
    .unwrap_or(0.0)
}

/// Valida precios duales y tarifa; devuelve (price_cup, price_usd, legacy_price).
fn validate_dual_prices(
    price_cup: Option<f64>,
    price_usd: Option<f64>,
    is_cup_active: bool,
    is_usd_active: bool,
    is_active: bool,
    cost: Option<f64>,
    exchange_rate: f64,
) -> Result<(Option<f64>, Option<f64>, f64), String> {
    if is_active && !is_cup_active && !is_usd_active {
        return Err("Activa al menos una moneda (CUP o USD) para el precio".to_string());
    }
    let cup = price_cup.filter(|v| v.is_finite() && *v >= 0.0);
    let usd = price_usd.filter(|v| v.is_finite() && *v >= 0.0);
    if is_cup_active {
        let Some(c) = cup else {
            return Err("El precio CUP es obligatorio cuando CUP está activo".to_string());
        };
        if c <= 0.0 {
            return Err("El precio CUP debe ser mayor que cero".to_string());
        }
    }
    if is_usd_active {
        let Some(u) = usd else {
            return Err("El precio USD es obligatorio cuando USD está activo".to_string());
        };
        if u <= 0.0 {
            return Err("El precio USD debe ser mayor que cero".to_string());
        }
    }
    let tarifa = cost.unwrap_or(0.0);
    if tarifa < 0.0 {
        return Err("La tarifa de pago no puede ser negativa".to_string());
    }
    let sale_cup_for_tarifa = if is_usd_active && exchange_rate > 0.0 {
        usd.unwrap_or(0.0) * exchange_rate
    } else if is_cup_active {
        cup.unwrap_or(0.0)
    } else {
        0.0
    };
    if sale_cup_for_tarifa > 0.0 && tarifa > sale_cup_for_tarifa + 1e-9 {
        return Err(
            "La tarifa de pago no puede ser mayor que el precio de venta (en CUP)".to_string(),
        );
    }
    let legacy_price = if is_cup_active {
        cup.unwrap_or(0.0)
    } else {
        0.0
    };
    // Se conservan ambos importes aunque la moneda esté desactivada (para reactivar luego).
    Ok((cup, usd, legacy_price))
}

fn map_price_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PriceRowDto> {
    let price: f64 = row.get(7)?;
    let price_cup: Option<f64> = row.get(8)?;
    let price_usd: Option<f64> = row.get(9)?;
    let is_cup_active = row.get::<_, i64>(10)? != 0;
    let is_usd_active = row.get::<_, i64>(11)? != 0;
    let is_active = row.get::<_, i64>(14)? != 0;
    Ok(PriceRowDto {
        id: row.get(0)?,
        category_id: row.get(1)?,
        category_name: row.get(2)?,
        format_id: row.get(3)?,
        format_label: row.get(4)?,
        finish: row.get(5)?,
        service: row.get(6)?,
        price: price_cup.unwrap_or(price),
        price_cup: price_cup.or(Some(price)),
        price_usd,
        is_cup_active,
        is_usd_active,
        cost: row.get(12)?,
        valid_from: row.get(13)?,
        is_active,
    })
}

const PRICE_SELECT: &str = "SELECT p.id, p.category_id, c.name, p.format_id, f.label, p.finish, p.service,
        p.price,
        COALESCE(p.price_cup, p.price),
        p.price_usd,
        COALESCE(p.is_cup_active, 0),
        COALESCE(p.is_usd_active, 1),
        p.cost, p.valid_from, p.is_active
     FROM price_list p
     JOIN product_categories c ON c.id = p.category_id
     LEFT JOIN formats f ON f.id = p.format_id";

/// Lists all product categories.
#[tauri::command]
pub fn product_categories_list() -> Result<Vec<CategoryDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name FROM product_categories WHERE is_active = 1 ORDER BY sort_order, id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CategoryDto {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Lists all formats («Sin formato» first).
#[tauri::command]
pub fn formats_list() -> Result<Vec<FormatDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, label FROM formats WHERE is_active = 1
             ORDER BY CASE WHEN lower(label) = lower('Sin formato') THEN 0 ELSE 1 END,
               label COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FormatDto {
                id: row.get(0)?,
                label: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Lists price rows with optional inclusion of inactive rows.
#[tauri::command]
pub fn prices_list(args: PricesListArgs) -> Result<Vec<PriceRowDto>, String> {
    let conn = db::open_connection()?;
    let sql = if args.include_inactive {
        format!(
            "{PRICE_SELECT}
             ORDER BY c.name COLLATE NOCASE, f.label COLLATE NOCASE NULLS LAST, p.service, p.finish"
        )
    } else {
        format!(
            "{PRICE_SELECT}
             WHERE p.is_active = 1
             ORDER BY c.name COLLATE NOCASE, f.label COLLATE NOCASE NULLS LAST, p.service, p.finish"
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_price_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Updates dual sale prices, payment tariff (`cost`), and active flags.
/// Also syncs the matching `cost_list` row used for employee salary calculations.
#[tauri::command]
pub fn prices_update(payload: UpdatePricePayload) -> Result<(), String> {
    let mut conn = db::open_connection()?;
    let rate = read_usd_exchange_rate(&conn);
    let (price_cup, price_usd, legacy_price) = validate_dual_prices(
        payload.price_cup,
        payload.price_usd,
        payload.is_cup_active,
        payload.is_usd_active,
        payload.is_active,
        payload.cost,
        rate,
    )?;
    let tarifa = payload.cost.unwrap_or(0.0);

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (category_id, format_id, finish, service): (i64, Option<i64>, Option<String>, Option<String>) = tx
        .query_row(
            "SELECT category_id, format_id, finish, service FROM price_list WHERE id = ?1",
            params![payload.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Precio no encontrado".to_string())?;

    let updated = tx
        .execute(
            "UPDATE price_list
             SET price = ?1, price_cup = ?2, price_usd = ?3,
                 is_cup_active = ?4, is_usd_active = ?5,
                 cost = ?6, is_active = ?7
             WHERE id = ?8",
            params![
                legacy_price,
                price_cup,
                price_usd,
                if payload.is_cup_active { 1i64 } else { 0i64 },
                if payload.is_usd_active { 1i64 } else { 0i64 },
                tarifa,
                if payload.is_active { 1i64 } else { 0i64 },
                payload.id
            ],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Precio no encontrado".to_string());
    }

    sync_product_sale_prices(
        &tx,
        category_id,
        format_id,
        &finish,
        legacy_price,
        price_cup,
        price_usd,
        if payload.is_cup_active { 1i64 } else { 0i64 },
        if payload.is_usd_active { 1i64 } else { 0i64 },
    )?;

    if let Some(ref service_name) = service {
        sync_cost_list_for_service(&tx, service_name, format_id, tarifa, payload.is_active)?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Creates a new price list row and syncs the matching employee pay tariff.
#[tauri::command]
pub fn prices_create(payload: CreatePricePayload) -> Result<PriceRowDto, String> {
    let service = payload.service.trim().to_string();
    if service.is_empty() {
        return Err("El tipo de trabajo es obligatorio".to_string());
    }
    let finish = payload.finish.and_then(|f| {
        let t = f.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });

    let mut conn = db::open_connection()?;
    let rate = read_usd_exchange_rate(&conn);
    let (price_cup, price_usd, legacy_price) = validate_dual_prices(
        payload.price_cup,
        payload.price_usd,
        payload.is_cup_active,
        payload.is_usd_active,
        payload.is_active,
        payload.cost,
        rate,
    )?;
    let tarifa = payload.cost.unwrap_or(0.0);

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let category_ok: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM product_categories WHERE id = ?1",
            params![payload.category_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if category_ok == 0 {
        return Err("Categoría no encontrada".to_string());
    }
    if let Some(fid) = payload.format_id {
        let format_ok: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM formats WHERE id = ?1",
                params![fid],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if format_ok == 0 {
            return Err("Formato no encontrado".to_string());
        }
    }

    tx.execute(
        "INSERT INTO price_list
            (category_id, format_id, finish, service, price, price_cup, price_usd,
             is_cup_active, is_usd_active, cost, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            payload.category_id,
            payload.format_id,
            finish,
            service,
            legacy_price,
            price_cup,
            price_usd,
            if payload.is_cup_active { 1i64 } else { 0i64 },
            if payload.is_usd_active { 1i64 } else { 0i64 },
            tarifa,
            if payload.is_active { 1i64 } else { 0i64 }
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = tx.last_insert_rowid();

    let (sale_cup, sale_usd, sale_legacy, sale_cup_on, sale_usd_on) =
        product_sale_or_sibling(
            &tx,
            payload.category_id,
            payload.format_id,
            &finish,
            id,
            price_cup,
            price_usd,
            legacy_price,
            if payload.is_cup_active { 1i64 } else { 0i64 },
            if payload.is_usd_active { 1i64 } else { 0i64 },
        )?;

    if sale_legacy != legacy_price
        || sale_cup != price_cup
        || sale_usd != price_usd
        || sale_cup_on != i64::from(payload.is_cup_active)
        || sale_usd_on != i64::from(payload.is_usd_active)
    {
        tx.execute(
            "UPDATE price_list
             SET price = ?1, price_cup = ?2, price_usd = ?3,
                 is_cup_active = ?4, is_usd_active = ?5
             WHERE id = ?6",
            params![sale_legacy, sale_cup, sale_usd, sale_cup_on, sale_usd_on, id],
        )
        .map_err(|e| e.to_string())?;
    }

    sync_product_sale_prices(
        &tx,
        payload.category_id,
        payload.format_id,
        &finish,
        sale_legacy,
        sale_cup,
        sale_usd,
        sale_cup_on,
        sale_usd_on,
    )?;

    sync_cost_list_for_service(
        &tx,
        &service,
        payload.format_id,
        tarifa,
        payload.is_active,
    )?;

    let row = tx
        .query_row(
            &format!("{PRICE_SELECT} WHERE p.id = ?1"),
            params![id],
            map_price_row,
        )
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(row)
}

fn finish_lookup_key(finish: &Option<String>) -> String {
    finish
        .as_ref()
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty())
        .unwrap_or_default()
}

fn row_has_sale_price(price: f64, price_cup: Option<f64>, price_usd: Option<f64>) -> bool {
    price_usd.filter(|v| *v > 0.0).is_some()
        || price_cup.filter(|v| *v > 0.0).is_some()
        || price > 0.0
}

/// If the new row has no sale price, copies CUP/USD from a sibling of the same product.
fn product_sale_or_sibling(
    conn: &rusqlite::Connection,
    category_id: i64,
    format_id: Option<i64>,
    finish: &Option<String>,
    exclude_id: i64,
    price_cup: Option<f64>,
    price_usd: Option<f64>,
    legacy_price: f64,
    is_cup_active: i64,
    is_usd_active: i64,
) -> Result<(Option<f64>, Option<f64>, f64, i64, i64), String> {
    if row_has_sale_price(legacy_price, price_cup, price_usd) {
        return Ok((
            price_cup,
            price_usd,
            legacy_price,
            is_cup_active,
            is_usd_active,
        ));
    }
    let mut stmt = conn
        .prepare(
            "SELECT price, price_cup, price_usd, COALESCE(is_cup_active, 0), COALESCE(is_usd_active, 1)
             FROM price_list
             WHERE category_id = ?1
               AND ((format_id IS NULL AND ?2 IS NULL) OR format_id = ?2)
               AND lower(trim(coalesce(finish, ''))) = ?3
               AND id != ?4
               AND (COALESCE(price_usd, 0) > 0 OR COALESCE(price_cup, price, 0) > 0)
             LIMIT 1",
        )
        .map_err(|e| e.to_string())?;
    match stmt.query_row(
        params![category_id, format_id, finish_lookup_key(finish), exclude_id],
        |row| {
            Ok((
                row.get::<_, Option<f64>>(1)?,
                row.get::<_, Option<f64>>(2)?,
                row.get::<_, f64>(0)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        },
    ) {
        Ok(found) => Ok(found),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok((
            price_cup,
            price_usd,
            legacy_price,
            is_cup_active,
            is_usd_active,
        )),
        Err(e) => Err(e.to_string()),
    }
}

/// Copies sale prices to every work-type row of the same finished product.
fn sync_product_sale_prices(
    conn: &rusqlite::Connection,
    category_id: i64,
    format_id: Option<i64>,
    finish: &Option<String>,
    legacy_price: f64,
    price_cup: Option<f64>,
    price_usd: Option<f64>,
    is_cup_active: i64,
    is_usd_active: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE price_list
         SET price = ?1, price_cup = ?2, price_usd = ?3,
             is_cup_active = ?4, is_usd_active = ?5
         WHERE category_id = ?6
           AND ((format_id IS NULL AND ?7 IS NULL) OR format_id = ?7)
           AND lower(trim(coalesce(finish, ''))) = ?8",
        params![
            legacy_price,
            price_cup,
            price_usd,
            is_cup_active,
            is_usd_active,
            category_id,
            format_id,
            finish_lookup_key(finish),
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Syncs `cost_list.unit_cost` for a work type + format pair.
fn sync_cost_list_for_service(
    conn: &rusqlite::Connection,
    service: &str,
    format_id: Option<i64>,
    tarifa: f64,
    is_active: bool,
) -> Result<(), String> {
    let Some(fid) = format_id else {
        return Ok(());
    };
    let Ok(work_code) = resolve_work_type_code(conn, service) else {
        return Ok(());
    };
    let synced = conn
        .execute(
            "UPDATE cost_list SET unit_cost = ?1, is_active = ?2
             WHERE work_type = ?3 AND format_id = ?4",
            params![
                tarifa,
                if is_active { 1i64 } else { 0i64 },
                work_code,
                fid
            ],
        )
        .map_err(|e| e.to_string())?;
    if synced == 0 {
        let _ = conn.execute(
            "INSERT INTO cost_list (work_type, format_id, unit_cost, is_active)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                work_code,
                fid,
                tarifa,
                if is_active { 1i64 } else { 0i64 }
            ],
        );
    }
    Ok(())
}

/// Resolves a `work_types.code` from a price-list service label (name or code).
fn resolve_work_type_code(conn: &rusqlite::Connection, service: &str) -> Result<String, String> {
    let needle = service.trim().to_lowercase();
    conn.query_row(
        "SELECT code FROM work_types
         WHERE lower(code) = ?1 OR lower(name) = ?1
         LIMIT 1",
        params![needle],
        |row| row.get(0),
    )
    .or_else(|_| {
        conn.query_row(
            "SELECT code FROM work_types
             WHERE lower(name) LIKE '%' || ?1 || '%' OR lower(code) LIKE '%' || ?1 || '%'
             LIMIT 1",
            params![needle],
            |row| row.get(0),
        )
    })
    .map_err(|_| "Tipo de trabajo no encontrado".to_string())
}

/// Cost-list row with format label (employee salary costs).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CostRowDto {
    pub id: i64,
    pub work_type: String,
    pub format_id: Option<i64>,
    pub format_label: Option<String>,
    pub unit_cost: f64,
    pub is_active: bool,
}

/// Payload for updating a cost-list row.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCostPayload {
    pub id: i64,
    pub unit_cost: f64,
    pub is_active: bool,
}

/// Lists all employee cost rows joined with format labels.
#[tauri::command]
pub fn cost_list_all() -> Result<Vec<CostRowDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT cl.id, cl.work_type, cl.format_id, f.label, cl.unit_cost, cl.is_active
             FROM cost_list cl
             LEFT JOIN formats f ON f.id = cl.format_id
             ORDER BY cl.work_type, cl.unit_cost",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let is_active_i: i64 = row.get(5)?;
            Ok(CostRowDto {
                id: row.get(0)?,
                work_type: row.get(1)?,
                format_id: row.get(2)?,
                format_label: row.get(3)?,
                unit_cost: row.get(4)?,
                is_active: is_active_i != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Updates the unit cost and active flag for a cost-list row.
#[tauri::command]
pub fn cost_update(payload: UpdateCostPayload) -> Result<(), String> {
    if payload.unit_cost < 0.0 {
        return Err("El costo no puede ser negativo".to_string());
    }
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE cost_list SET unit_cost = ?1, is_active = ?2 WHERE id = ?3",
            params![payload.unit_cost, if payload.is_active { 1i64 } else { 0i64 }, payload.id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Costo no encontrado".to_string());
    }
    Ok(())
}

fn normalize_lookup_token(value: &Option<String>) -> String {
    value
        .as_ref()
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty())
        .unwrap_or_default()
}

/// Arguments for resolving a unit price from the active price list.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceLookupArgs {
    pub category_id: i64,
    pub format_id: Option<i64>,
    pub finish: Option<String>,
    pub service: Option<String>,
}

/// Returns the matching active unit price in CUP (converts USD with current rate if needed).
#[tauri::command]
pub fn prices_lookup(args: PriceLookupArgs) -> Result<Option<f64>, String> {
    let conn = db::open_connection()?;
    let rate = read_usd_exchange_rate(&conn);
    let mut stmt = conn
        .prepare(
            "SELECT format_id, finish, service,
                    COALESCE(price_cup, price), price_usd,
                    COALESCE(is_cup_active, 1), COALESCE(is_usd_active, 0)
             FROM price_list WHERE category_id = ?1 AND is_active = 1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![args.category_id], |row| {
            Ok((
                row.get::<_, Option<i64>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<f64>>(3)?,
                row.get::<_, Option<f64>>(4)?,
                row.get::<_, i64>(5)? != 0,
                row.get::<_, i64>(6)? != 0,
            ))
        })
        .map_err(|e| e.to_string())?;

    let want_finish = normalize_lookup_token(&args.finish);

    for r in rows {
        let (fid, finish, _service, price_cup, price_usd, cup_on, usd_on) =
            r.map_err(|e| e.to_string())?;
        if args.format_id != fid {
            continue;
        }
        if normalize_lookup_token(&finish) != want_finish {
            continue;
        }
        if cup_on {
            if let Some(c) = price_cup.filter(|v| *v > 0.0) {
                return Ok(Some(c));
            }
        }
        if usd_on {
            if let Some(u) = price_usd.filter(|v| *v > 0.0) {
                if rate <= 0.0 {
                    return Err(
                        "Hay precio solo en USD pero la tasa de cambio no está configurada"
                            .to_string(),
                    );
                }
                return Ok(Some(u * rate));
            }
        }
    }
    Ok(None)
}
