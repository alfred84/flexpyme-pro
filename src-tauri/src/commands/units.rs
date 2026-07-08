//! CRUD for units of measure used in inventory.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

const UNIT_TYPES: &[&str] = &["cantidad", "peso", "volumen", "longitud", "area"];

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitDto {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub abbreviation: String,
    pub unit_type: String,
    pub is_active: bool,
    pub is_system: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUnitDto {
    pub name: String,
    pub abbreviation: String,
    pub unit_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUnitDto {
    pub name: String,
    pub abbreviation: String,
}

fn slugify(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace(' ', "_")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect()
}

fn map_unit(row: &rusqlite::Row<'_>) -> rusqlite::Result<UnitDto> {
    Ok(UnitDto {
        id: row.get(0)?,
        code: row.get(1)?,
        name: row.get(2)?,
        abbreviation: row.get(3)?,
        unit_type: row.get(4)?,
        is_active: row.get::<_, i64>(5)? != 0,
        is_system: row.get::<_, i64>(6)? != 0,
    })
}

/// Lists units, optionally filtered by active flag and unit type.
#[tauri::command]
pub fn get_units(active_only: bool, unit_type: Option<String>) -> Result<Vec<UnitDto>, String> {
    let conn = db::open_connection()?;
    let mut sql = String::from(
        "SELECT id, code, name, abbreviation, type, is_active, is_system FROM units WHERE 1=1",
    );
    if active_only {
        sql.push_str(" AND is_active = 1");
    }
    if let Some(t) = unit_type.as_ref().map(|s| s.trim().to_lowercase()) {
        if !t.is_empty() && UNIT_TYPES.contains(&t.as_str()) {
            sql.push_str(&format!(" AND type = '{}'", t));
        }
    }
    sql.push_str(" ORDER BY type, name");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], map_unit).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a custom unit of measure.
#[tauri::command]
pub fn create_unit(data: CreateUnitDto) -> Result<UnitDto, String> {
    let name = data.name.trim().to_string();
    let abbreviation = data.abbreviation.trim().to_string();
    let unit_type = data.unit_type.trim().to_lowercase();
    if name.is_empty() || abbreviation.is_empty() {
        return Err("Nombre y abreviatura son obligatorios".to_string());
    }
    if !UNIT_TYPES.contains(&unit_type.as_str()) {
        return Err("Tipo de unidad no válido".to_string());
    }
    let code = slugify(&name);
    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO units (code, name, abbreviation, type, is_active, is_system, created_at)
         VALUES (?1, ?2, ?3, ?4, 1, 0, datetime('now'))",
        params![code, name, abbreviation, unit_type],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe una unidad con ese código".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, code, name, abbreviation, type, is_active, is_system FROM units WHERE id = ?1",
        params![id],
        map_unit,
    )
    .map_err(|e| e.to_string())
}

/// Updates a non-system unit.
#[tauri::command]
pub fn update_unit(id: i64, data: UpdateUnitDto) -> Result<UnitDto, String> {
    let name = data.name.trim().to_string();
    let abbreviation = data.abbreviation.trim().to_string();
    if name.is_empty() || abbreviation.is_empty() {
        return Err("Nombre y abreviatura son obligatorios".to_string());
    }
    let conn = db::open_connection()?;
    let is_system: i64 = conn
        .query_row("SELECT is_system FROM units WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|_| "Unidad no encontrada".to_string())?;
    if is_system != 0 {
        return Err("Las unidades del sistema no se pueden modificar".to_string());
    }
    conn.execute(
        "UPDATE units SET name = ?1, abbreviation = ?2 WHERE id = ?3",
        params![name, abbreviation, id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, code, name, abbreviation, type, is_active, is_system FROM units WHERE id = ?1",
        params![id],
        map_unit,
    )
    .map_err(|e| e.to_string())
}

/// Deactivates a non-system unit if no inventory items use it.
#[tauri::command]
pub fn deactivate_unit(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let is_system: i64 = conn
        .query_row("SELECT is_system FROM units WHERE id = ?1", params![id], |row| row.get(0))
        .map_err(|_| "Unidad no encontrada".to_string())?;
    if is_system != 0 {
        return Err("Las unidades del sistema no se pueden desactivar".to_string());
    }
    let in_use: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM inventory_items WHERE unit_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if in_use > 0 {
        return Err(format!(
            "{} producto(s) del inventario usan esta unidad. Reasígnalos antes.",
            in_use
        ));
    }
    conn.execute("UPDATE units SET is_active = 0 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Reactivates a deactivated non-system unit.
#[tauri::command]
pub fn reactivate_unit(id: i64) -> Result<UnitDto, String> {
    let conn = db::open_connection()?;
    conn.execute("UPDATE units SET is_active = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, code, name, abbreviation, type, is_active, is_system FROM units WHERE id = ?1",
        params![id],
        map_unit,
    )
    .map_err(|_| "Unidad no encontrada".to_string())
}

/// Resolves unit snapshot text for inventory operations.
pub fn unit_snapshot_for_id(conn: &rusqlite::Connection, unit_id: i64) -> Result<String, String> {
    conn.query_row(
        "SELECT name FROM units WHERE id = ?1 AND is_active = 1",
        params![unit_id],
        |row| row.get(0),
    )
    .map_err(|_| "Unidad no encontrada o inactiva".to_string())
}
