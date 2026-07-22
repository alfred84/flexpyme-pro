//! CRUD for product categories used in orders.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductCategoryDto {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub sort_order: i64,
    pub is_active: bool,
    pub is_system: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryDto {
    pub name: String,
    pub code: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryDto {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub sort_order: Option<i64>,
}

fn slugify(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

fn map_category(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProductCategoryDto> {
    Ok(ProductCategoryDto {
        id: row.get(0)?,
        code: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        icon: row.get(4)?,
        sort_order: row.get(5)?,
        is_active: row.get::<_, i64>(6)? != 0,
        is_system: row.get::<_, i64>(7)? != 0,
    })
}

/// Lists product categories, optionally filtering active rows only.
#[tauri::command]
pub fn get_categories(active_only: bool) -> Result<Vec<ProductCategoryDto>, String> {
    let conn = db::open_connection()?;
    let sql = if active_only {
        "SELECT id, code, name, description, icon, sort_order, is_active, is_system
         FROM product_categories WHERE is_active = 1
         ORDER BY sort_order, name"
    } else {
        "SELECT id, code, name, description, icon, sort_order, is_active, is_system
         FROM product_categories
         ORDER BY is_active DESC, sort_order, name"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], map_category).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a custom product category (`is_system = false`).
#[tauri::command]
pub fn create_category(data: CreateCategoryDto) -> Result<ProductCategoryDto, String> {
    let name = data.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let code = {
        let c = data.code.trim().to_string();
        if c.is_empty() {
            slugify(&name)
        } else {
            slugify(&c)
        }
    };
    if code.is_empty() {
        return Err("El código es obligatorio".to_string());
    }
    let sort_order = data.sort_order.unwrap_or(100);
    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO product_categories (code, name, description, icon, sort_order, is_active, is_system, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, datetime('now'), datetime('now'))",
        params![code, name, data.description, data.icon, sort_order],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe una categoría con ese código".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, code, name, description, icon, sort_order, is_active, is_system FROM product_categories WHERE id = ?1",
        params![id],
        map_category,
    )
    .map_err(|e| e.to_string())
}

/// Updates a non-system category.
#[tauri::command]
pub fn update_category(id: i64, data: UpdateCategoryDto) -> Result<ProductCategoryDto, String> {
    let name = data.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let is_system: i64 = conn
        .query_row(
            "SELECT is_system FROM product_categories WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Categoría no encontrada".to_string())?;
    if is_system != 0 {
        return Err("Las categorías del sistema no se pueden modificar".to_string());
    }
    let sort_order = data.sort_order.unwrap_or(100);
    conn.execute(
        "UPDATE product_categories SET name = ?1, description = ?2, icon = ?3, sort_order = ?4, updated_at = datetime('now') WHERE id = ?5",
        params![name, data.description, data.icon, sort_order, id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, code, name, description, icon, sort_order, is_active, is_system FROM product_categories WHERE id = ?1",
        params![id],
        map_category,
    )
    .map_err(|e| e.to_string())
}

/// Deactivates a non-system category if no pending-payment orders reference it.
#[tauri::command]
pub fn deactivate_category(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let is_system: i64 = conn
        .query_row(
            "SELECT is_system FROM product_categories WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Categoría no encontrada".to_string())?;
    if is_system != 0 {
        return Err("Las categorías del sistema no se pueden desactivar".to_string());
    }
    let pending: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT i.id) FROM invoices i
             JOIN invoice_items ii ON ii.invoice_id = i.id
             WHERE ii.category_id = ?1 AND i.deleted_at IS NULL AND i.payment_status = 'pendiente'",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if pending > 0 {
        return Err(format!(
            "Esta categoría tiene {} pedido(s) pendiente(s) de cobro. Ciérralos antes de desactivarla.",
            pending
        ));
    }
    conn.execute(
        "UPDATE product_categories SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Reactivates a deactivated category.
#[tauri::command]
pub fn reactivate_category(id: i64) -> Result<ProductCategoryDto, String> {
    let conn = db::open_connection()?;
    conn.execute(
        "UPDATE product_categories SET is_active = 1, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, code, name, description, icon, sort_order, is_active, is_system FROM product_categories WHERE id = ?1",
        params![id],
        map_category,
    )
    .map_err(|_| "Categoría no encontrada".to_string())
}

/// Service/area configured for a category (e.g. Impresión, Laminado, Enmarcado).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryServiceDto {
    pub id: i64,
    pub category_id: i64,
    pub service: String,
    pub is_default: bool,
    pub sort_order: i64,
}

/// Finish linked to a category (from the global finishes catalog).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryFinishDto {
    pub id: i64,
    pub category_id: i64,
    pub finish_id: Option<i64>,
    pub finish: String,
    pub is_default: bool,
    pub sort_order: i64,
    pub finish_active: bool,
}

/// Lists all configured category services (all categories).
#[tauri::command]
pub fn category_services_all() -> Result<Vec<CategoryServiceDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, category_id, service, is_default, sort_order
             FROM category_services ORDER BY category_id, sort_order, service",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CategoryServiceDto {
                id: row.get(0)?,
                category_id: row.get(1)?,
                service: row.get(2)?,
                is_default: row.get::<_, i64>(3)? != 0,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Adds a service to a category.
#[tauri::command]
pub fn category_service_create(
    category_id: i64,
    service: String,
    is_default: bool,
) -> Result<CategoryServiceDto, String> {
    let service = service.trim().to_string();
    if service.is_empty() {
        return Err("El nombre del servicio es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM category_services WHERE category_id = ?1 AND lower(service) = lower(?2)",
            params![category_id, service],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists > 0 {
        return Err("Ese servicio ya está configurado para la categoría".to_string());
    }
    conn.execute(
        "INSERT INTO category_services (category_id, service, is_default, sort_order)
         VALUES (?1, ?2, ?3, 0)",
        params![category_id, service, if is_default { 1 } else { 0 }],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(CategoryServiceDto {
        id,
        category_id,
        service,
        is_default,
        sort_order: 0,
    })
}

/// Toggles the default-selected flag of a category service.
#[tauri::command]
pub fn category_service_set_default(id: i64, is_default: bool) -> Result<(), String> {
    let conn = db::open_connection()?;
    conn.execute(
        "UPDATE category_services SET is_default = ?1 WHERE id = ?2",
        params![if is_default { 1 } else { 0 }, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Removes a category service.
#[tauri::command]
pub fn category_service_delete(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    conn.execute("DELETE FROM category_services WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Lists all configured category finishes (all categories).
#[tauri::command]
pub fn category_finishes_all() -> Result<Vec<CategoryFinishDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT cf.id, cf.category_id, cf.finish_id,
                    COALESCE(f.name, cf.finish) AS finish_label,
                    cf.is_default, cf.sort_order,
                    COALESCE(f.is_active, 1) AS finish_active
             FROM category_finishes cf
             LEFT JOIN finishes f ON f.id = cf.finish_id
             ORDER BY cf.category_id, cf.sort_order, finish_label COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CategoryFinishDto {
                id: row.get(0)?,
                category_id: row.get(1)?,
                finish_id: row.get(2)?,
                finish: row.get(3)?,
                is_default: row.get::<_, i64>(4)? != 0,
                sort_order: row.get(5)?,
                finish_active: row.get::<_, i64>(6)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Links a catalog finish to a category (idempotent).
#[tauri::command]
pub fn category_finish_add(
    category_id: i64,
    finish_id: i64,
    is_default: Option<bool>,
) -> Result<CategoryFinishDto, String> {
    let conn = db::open_connection()?;
    let (name, is_active): (String, i64) = conn
        .query_row(
            "SELECT name, is_active FROM finishes WHERE id = ?1",
            params![finish_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Acabado no válido".to_string())?;
    let category_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM product_categories WHERE id = ?1",
            params![category_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if category_exists == 0 {
        return Err("Categoría no encontrada".to_string());
    }
    let existing: Option<(i64, i64, i64)> = conn
        .query_row(
            "SELECT id, is_default, sort_order FROM category_finishes
             WHERE category_id = ?1 AND (finish_id = ?2 OR lower(finish) = lower(?3))",
            params![category_id, finish_id, name],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();
    if let Some((id, def, sort)) = existing {
        conn.execute(
            "UPDATE category_finishes SET finish_id = ?1, finish = ?2 WHERE id = ?3",
            params![finish_id, name, id],
        )
        .map_err(|e| e.to_string())?;
        return Ok(CategoryFinishDto {
            id,
            category_id,
            finish_id: Some(finish_id),
            finish: name,
            is_default: def != 0,
            sort_order: sort,
            finish_active: is_active != 0,
        });
    }
    let is_default = is_default.unwrap_or(false);
    conn.execute(
        "INSERT INTO category_finishes (category_id, finish, finish_id, is_default, sort_order)
         VALUES (?1, ?2, ?3, ?4, 0)",
        params![category_id, name, finish_id, if is_default { 1 } else { 0 }],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(CategoryFinishDto {
        id,
        category_id,
        finish_id: Some(finish_id),
        finish: name,
        is_default,
        sort_order: 0,
        finish_active: is_active != 0,
    })
}

/// Adds a finish to a category by free-text name (legacy; prefer category_finish_add).
#[tauri::command]
pub fn category_finish_create(
    category_id: i64,
    finish: String,
    is_default: bool,
) -> Result<CategoryFinishDto, String> {
    let finish = finish.trim().to_string();
    if finish.is_empty() {
        return Err("El nombre del acabado es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let finish_id: i64 = match conn.query_row(
        "SELECT id FROM finishes WHERE lower(name) = lower(?1)",
        params![finish],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(_) => {
            conn.execute(
                "INSERT INTO finishes (name, is_active, is_system) VALUES (?1, 1, 0)",
                params![finish],
            )
            .map_err(|e| e.to_string())?;
            conn.last_insert_rowid()
        }
    };
    drop(conn);
    category_finish_add(category_id, finish_id, Some(is_default))
}

/// Toggles the default-selected flag of a category finish.
#[tauri::command]
pub fn category_finish_set_default(id: i64, is_default: bool) -> Result<(), String> {
    let conn = db::open_connection()?;
    conn.execute(
        "UPDATE category_finishes SET is_default = ?1 WHERE id = ?2",
        params![if is_default { 1 } else { 0 }, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Removes a category finish.
#[tauri::command]
pub fn category_finish_delete(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    conn.execute("DELETE FROM category_finishes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryWorkTypeDto {
    pub id: i64,
    pub category_id: i64,
    pub work_type_id: i64,
    pub work_type_name: String,
    pub work_type_active: bool,
}

/// Lists work types linked to a category.
#[tauri::command]
pub fn category_work_types_list(category_id: i64) -> Result<Vec<CategoryWorkTypeDto>, String> {
    let conn = db::open_connection()?;
    list_category_work_types(&conn, Some(category_id))
}

/// Lists all category ↔ work-type links (for order forms).
#[tauri::command]
pub fn category_work_types_all() -> Result<Vec<CategoryWorkTypeDto>, String> {
    let conn = db::open_connection()?;
    list_category_work_types(&conn, None)
}

fn list_category_work_types(
    conn: &rusqlite::Connection,
    category_id: Option<i64>,
) -> Result<Vec<CategoryWorkTypeDto>, String> {
    let sql = if category_id.is_some() {
        "SELECT cwt.id, cwt.category_id, cwt.work_type_id, wt.name, wt.is_active
         FROM category_work_types cwt
         JOIN work_types wt ON wt.id = cwt.work_type_id
         WHERE cwt.category_id = ?1
         ORDER BY wt.name COLLATE NOCASE"
    } else {
        "SELECT cwt.id, cwt.category_id, cwt.work_type_id, wt.name, wt.is_active
         FROM category_work_types cwt
         JOIN work_types wt ON wt.id = cwt.work_type_id
         ORDER BY cwt.category_id, wt.name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(CategoryWorkTypeDto {
            id: row.get(0)?,
            category_id: row.get(1)?,
            work_type_id: row.get(2)?,
            work_type_name: row.get(3)?,
            work_type_active: row.get::<_, i64>(4)? != 0,
        })
    };
    let rows = if let Some(id) = category_id {
        stmt.query_map(params![id], map_row)
    } else {
        stmt.query_map([], map_row)
    }
    .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Links a work type to a category (idempotent).
#[tauri::command]
pub fn category_work_type_add(category_id: i64, work_type_id: i64) -> Result<CategoryWorkTypeDto, String> {
    let conn = db::open_connection()?;
    let (name, is_active): (String, i64) = conn
        .query_row(
            "SELECT name, is_active FROM work_types WHERE id = ?1",
            params![work_type_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Tipo de trabajo no válido".to_string())?;
    let category_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM product_categories WHERE id = ?1",
            params![category_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if category_exists == 0 {
        return Err("Categoría no encontrada".to_string());
    }
    conn.execute(
        "INSERT OR IGNORE INTO category_work_types (category_id, work_type_id)
         VALUES (?1, ?2)",
        params![category_id, work_type_id],
    )
    .map_err(|e| e.to_string())?;
    let id: i64 = conn
        .query_row(
            "SELECT id FROM category_work_types WHERE category_id = ?1 AND work_type_id = ?2",
            params![category_id, work_type_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(CategoryWorkTypeDto {
        id,
        category_id,
        work_type_id,
        work_type_name: name,
        work_type_active: is_active != 0,
    })
}

/// Unlinks a work type from a category by assignment id.
#[tauri::command]
pub fn category_work_type_remove(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let removed = conn
        .execute("DELETE FROM category_work_types WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if removed == 0 {
        return Err("Asignación de tipo de trabajo no encontrada".to_string());
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryFormatDto {
    pub id: i64,
    pub category_id: i64,
    pub format_id: i64,
    pub format_label: String,
    pub format_active: bool,
}

/// Lists formats linked to a category.
#[tauri::command]
pub fn category_formats_list(category_id: i64) -> Result<Vec<CategoryFormatDto>, String> {
    let conn = db::open_connection()?;
    list_category_formats(&conn, Some(category_id))
}

/// Lists all category ↔ format links (for order forms).
#[tauri::command]
pub fn category_formats_all() -> Result<Vec<CategoryFormatDto>, String> {
    let conn = db::open_connection()?;
    list_category_formats(&conn, None)
}

fn list_category_formats(
    conn: &rusqlite::Connection,
    category_id: Option<i64>,
) -> Result<Vec<CategoryFormatDto>, String> {
    let sql = if category_id.is_some() {
        "SELECT cf.id, cf.category_id, cf.format_id, f.label, f.is_active
         FROM category_formats cf
         JOIN formats f ON f.id = cf.format_id
         WHERE cf.category_id = ?1
         ORDER BY f.label COLLATE NOCASE"
    } else {
        "SELECT cf.id, cf.category_id, cf.format_id, f.label, f.is_active
         FROM category_formats cf
         JOIN formats f ON f.id = cf.format_id
         ORDER BY cf.category_id, f.label COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(CategoryFormatDto {
            id: row.get(0)?,
            category_id: row.get(1)?,
            format_id: row.get(2)?,
            format_label: row.get(3)?,
            format_active: row.get::<_, i64>(4)? != 0,
        })
    };
    let rows = if let Some(id) = category_id {
        stmt.query_map(params![id], map_row)
    } else {
        stmt.query_map([], map_row)
    }
    .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Links a format to a category (idempotent).
#[tauri::command]
pub fn category_format_add(category_id: i64, format_id: i64) -> Result<CategoryFormatDto, String> {
    let conn = db::open_connection()?;
    let (label, is_active): (String, i64) = conn
        .query_row(
            "SELECT label, is_active FROM formats WHERE id = ?1",
            params![format_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Formato no válido".to_string())?;
    let category_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM product_categories WHERE id = ?1",
            params![category_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if category_exists == 0 {
        return Err("Categoría no encontrada".to_string());
    }
    conn.execute(
        "INSERT OR IGNORE INTO category_formats (category_id, format_id)
         VALUES (?1, ?2)",
        params![category_id, format_id],
    )
    .map_err(|e| e.to_string())?;
    let id: i64 = conn
        .query_row(
            "SELECT id FROM category_formats WHERE category_id = ?1 AND format_id = ?2",
            params![category_id, format_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(CategoryFormatDto {
        id,
        category_id,
        format_id,
        format_label: label,
        format_active: is_active != 0,
    })
}

/// Unlinks a format from a category by assignment id.
#[tauri::command]
pub fn category_format_remove(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let removed = conn
        .execute("DELETE FROM category_formats WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if removed == 0 {
        return Err("Asignación de formato no encontrada".to_string());
    }
    Ok(())
}

/// Resolves the display label stored in invoice item snapshots.
pub fn category_display_name(conn: &rusqlite::Connection, category_id: i64) -> Result<String, String> {
    conn.query_row(
        "SELECT COALESCE(NULLIF(trim(label_es), ''), name) FROM product_categories WHERE id = ?1",
        params![category_id],
        |row| row.get(0),
    )
    .map_err(|_| "Categoría no encontrada".to_string())
}
