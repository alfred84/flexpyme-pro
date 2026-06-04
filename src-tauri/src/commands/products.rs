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

/// Price list row with joined labels.
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
    pub price: f64,
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

/// Payload for updating a price list row.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePricePayload {
    pub id: i64,
    pub price: f64,
    pub cost: Option<f64>,
    pub is_active: bool,
}

/// Lists all product categories.
#[tauri::command]
pub fn product_categories_list() -> Result<Vec<CategoryDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare("SELECT id, name FROM product_categories ORDER BY id")
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

/// Lists all formats.
#[tauri::command]
pub fn formats_list() -> Result<Vec<FormatDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare("SELECT id, label FROM formats ORDER BY label COLLATE NOCASE")
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
        "SELECT p.id, p.category_id, c.name, p.format_id, f.label, p.finish, p.service, p.price, p.cost, p.valid_from, p.is_active
         FROM price_list p
         JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN formats f ON f.id = p.format_id
         ORDER BY c.name COLLATE NOCASE, f.label COLLATE NOCASE NULLS LAST, p.service, p.finish"
    } else {
        "SELECT p.id, p.category_id, c.name, p.format_id, f.label, p.finish, p.service, p.price, p.cost, p.valid_from, p.is_active
         FROM price_list p
         JOIN product_categories c ON c.id = p.category_id
         LEFT JOIN formats f ON f.id = p.format_id
         WHERE p.is_active = 1
         ORDER BY c.name COLLATE NOCASE, f.label COLLATE NOCASE NULLS LAST, p.service, p.finish"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let is_active_i: i64 = row.get(10)?;
            Ok(PriceRowDto {
                id: row.get(0)?,
                category_id: row.get(1)?,
                category_name: row.get(2)?,
                format_id: row.get(3)?,
                format_label: row.get(4)?,
                finish: row.get(5)?,
                service: row.get(6)?,
                price: row.get(7)?,
                cost: row.get(8)?,
                valid_from: row.get(9)?,
                is_active: is_active_i != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Updates price, optional cost, and active flag for a price list row.
#[tauri::command]
pub fn prices_update(payload: UpdatePricePayload) -> Result<(), String> {
    if payload.price <= 0.0 {
        return Err("El precio debe ser mayor que cero".to_string());
    }
    if let Some(cost) = payload.cost {
        if cost < 0.0 {
            return Err("El costo no puede ser negativo".to_string());
        }
        if cost > payload.price {
            return Err("El costo no puede ser mayor que el precio de venta".to_string());
        }
    }

    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE price_list SET price = ?1, cost = ?2, is_active = ?3 WHERE id = ?4",
            params![
                payload.price,
                payload.cost,
                if payload.is_active { 1i64 } else { 0i64 },
                payload.id
            ],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Precio no encontrado".to_string());
    }
    Ok(())
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

/// Returns the first matching active unit price for the given dimensions.
#[tauri::command]
pub fn prices_lookup(args: PriceLookupArgs) -> Result<Option<f64>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT format_id, finish, service, price FROM price_list WHERE category_id = ?1 AND is_active = 1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![args.category_id], |row| {
            Ok((
                row.get::<_, Option<i64>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, f64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let want_finish = normalize_lookup_token(&args.finish);
    let want_service = normalize_lookup_token(&args.service);

    for r in rows {
        let (fid, finish, service, price) = r.map_err(|e| e.to_string())?;
        if args.format_id != fid {
            continue;
        }
        if normalize_lookup_token(&finish) != want_finish {
            continue;
        }
        if normalize_lookup_token(&service) != want_service {
            continue;
        }
        return Ok(Some(price));
    }
    Ok(None)
}
