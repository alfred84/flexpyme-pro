//! Inventory items and stock-movement commands backed by SQLite.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::commands::units::unit_snapshot_for_id;
use crate::db;

/// Inventory item with a computed low-stock flag.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItemDto {
    pub id: i64,
    pub name: String,
    pub category: Option<String>,
    pub unit_id: Option<i64>,
    pub unit_snapshot: Option<String>,
    pub unit: String,
    pub quantity: f64,
    pub min_stock: f64,
    pub cost_per_unit: f64,
    pub supplier: Option<String>,
    pub notes: Option<String>,
    pub low_stock: bool,
}

/// Stock movement row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryMovementDto {
    pub id: i64,
    pub item_id: i64,
    pub movement_type: String,
    pub quantity: f64,
    pub reason: Option<String>,
    pub date: String,
    pub notes: Option<String>,
}

/// Payload for creating an inventory item.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemPayload {
    pub name: String,
    pub category: Option<String>,
    pub unit_id: Option<i64>,
    pub unit: Option<String>,
    pub quantity: f64,
    pub min_stock: f64,
    pub cost_per_unit: f64,
    pub supplier: Option<String>,
    pub notes: Option<String>,
}

/// Payload for updating an inventory item.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemPayload {
    pub id: i64,
    pub name: String,
    pub category: Option<String>,
    pub unit_id: Option<i64>,
    pub unit: Option<String>,
    pub min_stock: f64,
    pub cost_per_unit: f64,
    pub supplier: Option<String>,
    pub notes: Option<String>,
}

/// Payload for registering a stock movement.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementPayload {
    pub item_id: i64,
    pub movement_type: String,
    pub quantity: f64,
    pub reason: Option<String>,
    pub notes: Option<String>,
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

/// Lists all inventory items, ordered with low-stock first.
#[tauri::command]
pub fn inventory_items_list() -> Result<Vec<InventoryItemDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, category, unit_id, unit_snapshot, unit, quantity, min_stock, cost_per_unit, supplier, notes
             FROM inventory_items
             ORDER BY (quantity <= min_stock) DESC, name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let quantity: f64 = row.get(6)?;
            let min_stock: f64 = row.get(7)?;
            Ok(InventoryItemDto {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                unit_id: row.get(3)?,
                unit_snapshot: row.get(4)?,
                unit: row.get(5)?,
                quantity,
                min_stock,
                cost_per_unit: row.get(8)?,
                supplier: row.get(9)?,
                notes: row.get(10)?,
                low_stock: quantity <= min_stock,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Loads a single inventory item by id.
#[tauri::command]
pub fn inventory_item_get(id: i64) -> Result<InventoryItemDto, String> {
    let conn = db::open_connection()?;
    conn.query_row(
        "SELECT id, name, category, unit_id, unit_snapshot, unit, quantity, min_stock, cost_per_unit, supplier, notes
         FROM inventory_items WHERE id = ?1",
        params![id],
        |row| {
            let quantity: f64 = row.get(6)?;
            let min_stock: f64 = row.get(7)?;
            Ok(InventoryItemDto {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                unit_id: row.get(3)?,
                unit_snapshot: row.get(4)?,
                unit: row.get(5)?,
                quantity,
                min_stock,
                cost_per_unit: row.get(8)?,
                supplier: row.get(9)?,
                notes: row.get(10)?,
                low_stock: quantity <= min_stock,
            })
        },
    )
    .map_err(|_| "Ítem de inventario no encontrado".to_string())
}

fn resolve_unit_fields(
    conn: &rusqlite::Connection,
    unit_id: Option<i64>,
    unit_text: Option<String>,
) -> Result<(Option<i64>, String, String), String> {
    if let Some(id) = unit_id {
        let snapshot = unit_snapshot_for_id(conn, id)?;
        let abbr: String = conn
            .query_row(
                "SELECT abbreviation FROM units WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        return Ok((Some(id), snapshot, abbr));
    }
    let unit = unit_text
        .map(|u| u.trim().to_string())
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| "unidad".to_string());
    Ok((None, unit.clone(), unit))
}

/// Creates a new inventory item.
#[tauri::command]
pub fn inventory_item_create(payload: CreateItemPayload) -> Result<i64, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let (unit_id, unit_snapshot, unit_label) =
        resolve_unit_fields(&conn, payload.unit_id, payload.unit)?;
    conn.execute(
        "INSERT INTO inventory_items
            (name, category, unit_id, unit_snapshot, unit, quantity, min_stock, cost_per_unit, supplier, notes, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'))",
        params![
            name,
            normalize_optional(payload.category),
            unit_id,
            unit_snapshot,
            unit_label,
            payload.quantity,
            payload.min_stock,
            payload.cost_per_unit,
            normalize_optional(payload.supplier),
            normalize_optional(payload.notes)
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

/// Updates an inventory item (quantity is changed only via movements).
#[tauri::command]
pub fn inventory_item_update(payload: UpdateItemPayload) -> Result<(), String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let (unit_id, unit_snapshot, unit_label) =
        resolve_unit_fields(&conn, payload.unit_id, payload.unit)?;
    let updated = conn
        .execute(
            "UPDATE inventory_items
             SET name = ?1, category = ?2, unit_id = ?3, unit_snapshot = ?4, unit = ?5,
                 min_stock = ?6, cost_per_unit = ?7, supplier = ?8, notes = ?9, updated_at = datetime('now')
             WHERE id = ?10",
            params![
                name,
                normalize_optional(payload.category),
                unit_id,
                unit_snapshot,
                unit_label,
                payload.min_stock,
                payload.cost_per_unit,
                normalize_optional(payload.supplier),
                normalize_optional(payload.notes),
                payload.id
            ],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Ítem de inventario no encontrado".to_string());
    }
    Ok(())
}

/// Registers a stock movement (entrada/salida) and updates the item quantity.
#[tauri::command]
pub fn inventory_movement_register(payload: MovementPayload) -> Result<(), String> {
    if payload.quantity <= 0.0 {
        return Err("La cantidad debe ser mayor que cero".to_string());
    }
    let movement_type = payload.movement_type.trim().to_lowercase();
    if movement_type != "entrada" && movement_type != "salida" {
        return Err("Tipo de movimiento inválido".to_string());
    }

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let current: f64 = tx
        .query_row(
            "SELECT quantity FROM inventory_items WHERE id = ?1",
            params![payload.item_id],
            |row| row.get(0),
        )
        .map_err(|_| "Ítem de inventario no encontrado".to_string())?;

    let delta = if movement_type == "entrada" {
        payload.quantity
    } else {
        -payload.quantity
    };
    let new_quantity = current + delta;
    if new_quantity < 0.0 {
        return Err("La salida supera el stock disponible".to_string());
    }

    let unit_snapshot: Option<String> = tx
        .query_row(
            "SELECT unit_snapshot FROM inventory_items WHERE id = ?1",
            params![payload.item_id],
            |row| row.get(0),
        )
        .ok();

    tx.execute(
        "INSERT INTO inventory_movements (item_id, type, quantity, unit_snapshot, reason, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            payload.item_id,
            movement_type,
            payload.quantity,
            unit_snapshot,
            normalize_optional(payload.reason),
            normalize_optional(payload.notes)
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE inventory_items SET quantity = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_quantity, payload.item_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Lists movements for an item, most recent first.
#[tauri::command]
pub fn inventory_movements_for_item(item_id: i64) -> Result<Vec<InventoryMovementDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, type, quantity, reason, date, notes
             FROM inventory_movements WHERE item_id = ?1
             ORDER BY date DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![item_id], |row| {
            Ok(InventoryMovementDto {
                id: row.get(0)?,
                item_id: row.get(1)?,
                movement_type: row.get(2)?,
                quantity: row.get(3)?,
                reason: row.get(4)?,
                date: row.get(5)?,
                notes: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
