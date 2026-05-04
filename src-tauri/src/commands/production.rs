//! Production batch commands: list and create.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchListDto {
    pub id: i64,
    pub r#type: String,
    pub date: String,
    pub worker_name: Option<String>,
    pub total_cost: f64,
    pub paid: f64,
    pub pending: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionItemPayload {
    pub client_id: i64,
    pub format_id: Option<i64>,
    pub category: String,
    pub quantity: i64,
    pub unit_cost: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionBatchPayload {
    pub r#type: String,
    pub date: String,
    pub worker_name: Option<String>,
    pub paid: f64,
    pub notes: Option<String>,
    pub items: Vec<CreateProductionItemPayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductionBatchResponse {
    pub id: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchHeaderDto {
    pub id: i64,
    pub r#type: String,
    pub date: String,
    pub worker_name: Option<String>,
    pub total_cost: f64,
    pub paid: f64,
    pub pending: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchLineDto {
    pub id: i64,
    pub client_id: i64,
    pub client_code: String,
    pub client_name: String,
    pub format_id: Option<i64>,
    pub format_label: Option<String>,
    pub category: String,
    pub quantity: i64,
    pub unit_cost: f64,
    pub subtotal: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionBatchDetailDto {
    pub batch: ProductionBatchHeaderDto,
    pub items: Vec<ProductionBatchLineDto>,
}

fn trim_optional(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

#[tauri::command]
pub fn production_list() -> Result<Vec<ProductionBatchListDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, type, date, worker_name, total_cost, paid
             FROM production_batches
             ORDER BY date DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let total_cost: f64 = row.get(4)?;
            let paid: f64 = row.get(5)?;
            Ok(ProductionBatchListDto {
                id: row.get(0)?,
                r#type: row.get(1)?,
                date: row.get(2)?,
                worker_name: row.get(3)?,
                total_cost,
                paid,
                pending: (total_cost - paid).max(0.0),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Loads one production batch with line items (client and format labels).
#[tauri::command]
pub fn production_get_detail(batch_id: i64) -> Result<ProductionBatchDetailDto, String> {
    let conn = db::open_connection()?;
    let header = conn
        .query_row(
            "SELECT id, type, date, worker_name, total_cost, paid, notes
             FROM production_batches WHERE id = ?1",
            params![batch_id],
            |row| {
                let total_cost: f64 = row.get(4)?;
                let paid: f64 = row.get(5)?;
                Ok(ProductionBatchHeaderDto {
                    id: row.get(0)?,
                    r#type: row.get(1)?,
                    date: row.get(2)?,
                    worker_name: row.get(3)?,
                    total_cost,
                    paid,
                    pending: (total_cost - paid).max(0.0),
                    notes: row.get(6)?,
                })
            },
        )
        .map_err(|_| "Lote no encontrado".to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT pbi.id, pbi.client_id, c.code, c.name, pbi.format_id, f.label, pbi.category,
                    pbi.quantity, pbi.unit_cost, pbi.subtotal
             FROM production_batch_items pbi
             JOIN clients c ON c.id = pbi.client_id
             LEFT JOIN formats f ON f.id = pbi.format_id
             WHERE pbi.batch_id = ?1
             ORDER BY pbi.id",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![batch_id], |row| {
            Ok(ProductionBatchLineDto {
                id: row.get(0)?,
                client_id: row.get(1)?,
                client_code: row.get(2)?,
                client_name: row.get(3)?,
                format_id: row.get(4)?,
                format_label: row.get(5)?,
                category: row.get(6)?,
                quantity: row.get(7)?,
                unit_cost: row.get(8)?,
                subtotal: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ProductionBatchDetailDto { batch: header, items })
}

#[tauri::command]
pub fn production_create(
    payload: CreateProductionBatchPayload,
) -> Result<CreateProductionBatchResponse, String> {
    if payload.items.is_empty() {
        return Err("El lote debe tener al menos una linea".to_string());
    }
    if payload.paid < 0.0 {
        return Err("El pagado no puede ser negativo".to_string());
    }

    let batch_type = payload.r#type.trim().to_string();
    if batch_type.is_empty() {
        return Err("El tipo de lote es obligatorio".to_string());
    }

    let date = payload.date.trim().to_string();
    if date.is_empty() {
        return Err("La fecha es obligatoria".to_string());
    }

    for item in &payload.items {
        if item.category.trim().is_empty() {
            return Err("Cada linea debe tener categoria".to_string());
        }
        if item.quantity <= 0 {
            return Err("Cada linea debe tener cantidad mayor que cero".to_string());
        }
        if item.unit_cost < 0.0 {
            return Err("El costo unitario no puede ser negativo".to_string());
        }
    }

    let mut total_cost = 0.0_f64;
    for item in &payload.items {
        total_cost += (item.quantity as f64) * item.unit_cost;
    }
    if payload.paid - total_cost > 1e-6 {
        return Err("El pagado no puede ser mayor que el costo total".to_string());
    }

    let worker_name = trim_optional(payload.worker_name);
    let notes = trim_optional(payload.notes);

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO production_batches (type, date, worker_name, total_cost, paid, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![batch_type, date, worker_name, total_cost, payload.paid, notes],
    )
    .map_err(|e| e.to_string())?;
    let batch_id = tx.last_insert_rowid();

    for item in &payload.items {
        let exists: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM clients WHERE id = ?1 AND deleted_at IS NULL",
                params![item.client_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err("Cliente no encontrado en una linea".to_string());
        }

        let subtotal = (item.quantity as f64) * item.unit_cost;
        tx.execute(
            "INSERT INTO production_batch_items (batch_id, client_id, format_id, category, quantity, unit_cost, subtotal)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                batch_id,
                item.client_id,
                item.format_id,
                item.category.trim(),
                item.quantity,
                item.unit_cost,
                subtotal
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(CreateProductionBatchResponse { id: batch_id })
}
