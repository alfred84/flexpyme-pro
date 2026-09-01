//! Inventory items, material categories, recipes, stock movements and deductions.

use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

use crate::commands::units::unit_snapshot_for_id;
use crate::db;

/// Inventory item with computed low-stock / deficit flags.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItemDto {
    pub id: i64,
    pub name: String,
    pub category: Option<String>,
    pub material_category_id: Option<i64>,
    pub material_category_name: Option<String>,
    pub format_id: Option<i64>,
    pub format_label: Option<String>,
    pub unit_id: Option<i64>,
    pub unit_snapshot: Option<String>,
    pub unit: String,
    pub quantity: f64,
    pub min_stock: f64,
    pub cost_per_unit: f64,
    pub cost_per_unit_usd: f64,
    pub supplier: Option<String>,
    pub notes: Option<String>,
    pub low_stock: bool,
    pub deficit: bool,
}

/// Material category catalog row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialCategoryDto {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub sort_order: i64,
    pub is_active: bool,
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

/// Movimiento en listado global (con material y método de salida).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryMovementListDto {
    pub id: i64,
    pub item_id: i64,
    pub item_name: String,
    pub movement_type: String,
    pub quantity: f64,
    pub reason: Option<String>,
    pub date: String,
    pub notes: Option<String>,
    pub reference_id: Option<i64>,
    /// `Manual` | `Rebaja por Pedido` | `Merma` | `Venta` | `—` (entradas).
    pub method: String,
}

/// Payload for creating an inventory item.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemPayload {
    pub name: String,
    pub material_category_id: i64,
    pub category: Option<String>,
    pub format_id: Option<i64>,
    pub unit_id: Option<i64>,
    pub unit: Option<String>,
    pub quantity: f64,
    pub min_stock: f64,
    pub cost_per_unit: f64,
    pub cost_per_unit_usd: f64,
    pub supplier: Option<String>,
    pub notes: Option<String>,
}

/// Payload for updating an inventory item.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemPayload {
    pub id: i64,
    pub name: String,
    pub material_category_id: i64,
    pub category: Option<String>,
    pub format_id: Option<i64>,
    pub unit_id: Option<i64>,
    pub unit: Option<String>,
    pub min_stock: f64,
    pub cost_per_unit: f64,
    pub cost_per_unit_usd: f64,
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

/// Línea de merma a registrar sobre un pedido.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceMaterialWasteLinePayload {
    pub inventory_item_id: i64,
    pub quantity: f64,
    pub reason_code: String,
    pub notes: Option<String>,
}

/// Payload para registrar una o más mermas de un pedido.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterInvoiceMaterialWastePayload {
    pub invoice_id: i64,
    pub items: Vec<InvoiceMaterialWasteLinePayload>,
}

/// Payload para registrar una venta de material (salida de stock + ingreso en caja).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterMaterialSalePayload {
    pub inventory_item_id: i64,
    pub quantity: f64,
    pub payment_method: String,
    pub payment_currency: String,
    pub amount_cup: f64,
    pub amount_usd: Option<f64>,
    pub exchange_rate: Option<f64>,
    pub denomination_breakdown: Option<String>,
    pub transfer_concept: Option<String>,
    pub notes: Option<String>,
}

/// Merma persistida de un pedido (con snapshot de costo).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceMaterialWasteDto {
    pub id: i64,
    pub invoice_id: i64,
    pub inventory_item_id: i64,
    pub item_name: String,
    pub unit: String,
    pub quantity: f64,
    pub reason_code: String,
    pub reason_label: String,
    pub notes: Option<String>,
    pub cost_per_unit_cup: f64,
    pub cost_per_unit_usd: f64,
    pub cost_cup: f64,
    pub cost_usd: f64,
    pub inventory_movement_id: Option<i64>,
    pub created_at: String,
}

/// Production consumption recipe row.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryRecipeDto {
    pub id: i64,
    pub category_id: i64,
    pub category_name: String,
    pub service: Option<String>,
    pub work_type_id: Option<i64>,
    pub work_type_name: Option<String>,
    pub format_id: Option<i64>,
    pub format_label: Option<String>,
    pub finish: Option<String>,
    pub inventory_item_id: i64,
    pub inventory_item_name: String,
    pub quantity_per_unit: f64,
    pub is_active: bool,
}

/// Payload for creating a consumption recipe.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecipePayload {
    pub category_id: i64,
    pub work_type_id: i64,
    pub format_id: Option<i64>,
    pub finish: Option<String>,
    pub inventory_item_id: i64,
    pub quantity_per_unit: f64,
}

/// Payload for updating a consumption recipe.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecipePayload {
    pub id: i64,
    pub inventory_item_id: i64,
    pub format_id: Option<i64>,
    pub finish: Option<String>,
    pub quantity_per_unit: f64,
}

/// Material line attached to an invoice item at creation time.
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItemMaterialInput {
    pub inventory_item_id: i64,
    pub quantity_per_unit: f64,
    pub source: Option<String>,
    pub recipe_id: Option<i64>,
}

fn normalize_token(value: Option<&str>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim().to_lowercase();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
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

fn is_low_stock(quantity: f64, min_stock: f64) -> bool {
    min_stock > 0.0 && quantity <= min_stock
}

fn map_item_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<InventoryItemDto> {
    let quantity: f64 = row.get(7)?;
    let min_stock: f64 = row.get(8)?;
    Ok(InventoryItemDto {
        id: row.get(0)?,
        name: row.get(1)?,
        category: row.get(2)?,
        material_category_id: row.get(3)?,
        material_category_name: row.get(4)?,
        unit_id: row.get(5)?,
        unit_snapshot: row.get(6)?,
        unit: row.get(9)?,
        quantity,
        min_stock,
        cost_per_unit: row.get(10)?,
        cost_per_unit_usd: row.get(11)?,
        supplier: row.get(12)?,
        notes: row.get(13)?,
        format_id: row.get(14)?,
        format_label: row.get(15)?,
        low_stock: is_low_stock(quantity, min_stock),
        deficit: quantity < 0.0,
    })
}

const ITEM_SELECT: &str = "SELECT ii.id, ii.name, ii.category, ii.material_category_id, mc.name,
        ii.unit_id, ii.unit_snapshot, ii.quantity, ii.min_stock, ii.unit,
        ii.cost_per_unit, ii.cost_per_unit_usd, ii.supplier, ii.notes,
        ii.format_id, COALESCE(f.label, 'Sin formato')
     FROM inventory_items ii
     LEFT JOIN inventory_material_categories mc ON mc.id = ii.material_category_id
     LEFT JOIN formats f ON f.id = ii.format_id";

/// Escasez de un material respecto a lo requerido por una línea.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialShortageDto {
    pub inventory_item_id: i64,
    pub name: String,
    pub needed: f64,
    pub available: f64,
}

/// Demanda pendiente de pedidos abiertos sobre un ítem de inventario.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryPendingDemandDto {
    pub inventory_item_id: i64,
    pub item_name: String,
    pub unit: String,
    pub available: f64,
    pub needed: f64,
    pub shortfall: f64,
    pub open_order_count: i64,
}

/// Fila del resumen de consumo de materiales (kardex del periodo).
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InventoryConsumptionRowDto {
    pub item_id: i64,
    pub formato: String,
    pub unit: String,
    pub material_category_id: Option<i64>,
    pub material_category_name: String,
    pub existencia_inicial: f64,
    pub entradas: f64,
    pub salidas: f64,
    pub solicitados: f64,
    pub mermas: f64,
    pub ventas: f64,
    pub existencia_final: f64,
    pub demanda: f64,
    pub deficit: f64,
    pub disponible: f64,
}

/// Rango opcional para informes de inventario (`None` = histórico completo).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryReportRangeArgs {
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

const STOCK_EPS: f64 = 1e-9;

/// Mensaje de escasez para UI / errores.
pub fn format_shortages_message(shortages: &[MaterialShortageDto]) -> String {
    shortages
        .iter()
        .map(|s| {
            format!(
                "{} (necesario {:.2}, disponible {:.2})",
                s.name, s.needed, s.available
            )
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// Resuelve cantidades totales por ítem para una línea (materiales asignados o normas).
fn resolve_line_material_totals(
    tx: &rusqlite::Transaction<'_>,
    invoice_item_id: i64,
    category_id: i64,
    service: Option<&str>,
    format_id: Option<i64>,
    finish: Option<&str>,
    quantity: i64,
) -> Result<std::collections::HashMap<i64, f64>, String> {
    let mut totals: std::collections::HashMap<i64, f64> = std::collections::HashMap::new();
    if quantity <= 0 {
        return Ok(totals);
    }

    let mut mat_stmt = tx
        .prepare(
            "SELECT inventory_item_id, quantity_per_unit
             FROM invoice_item_materials WHERE invoice_item_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let assigned = mat_stmt
        .query_map(params![invoice_item_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(mat_stmt);

    if !assigned.is_empty() {
        for (item_id, per_unit) in assigned {
            let amount = per_unit * (quantity as f64);
            if amount > 0.0 {
                *totals.entry(item_id).or_insert(0.0) += amount;
            }
        }
        return Ok(totals);
    }

    let line_service = normalize_token(service);
    let line_finish = normalize_token(finish);
    let mut recipe_stmt = tx
        .prepare(
            "SELECT r.service, r.work_type_id, wt.name, wt.code, r.format_id, r.finish,
                    r.inventory_item_id, r.quantity_per_unit
             FROM inventory_recipes r
             LEFT JOIN work_types wt ON wt.id = r.work_type_id
             WHERE r.is_active = 1 AND r.category_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let recipes = recipe_stmt
        .query_map(params![category_id], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<i64>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, f64>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(recipe_stmt);

    for (recipe_service, _wt_id, wt_name, wt_code, recipe_format, recipe_finish, item_id, per_unit) in
        recipes
    {
        if let Some(rf) = recipe_format {
            if format_id != Some(rf) {
                continue;
            }
        }
        let rf_finish = normalize_token(recipe_finish.as_deref());
        if let Some(ref want_finish) = rf_finish {
            if line_finish.as_ref() != Some(want_finish) {
                continue;
            }
        }

        let mut matched = false;
        if let Some(ref svc) = line_service {
            for candidate in [
                recipe_service.as_deref(),
                wt_name.as_deref(),
                wt_code.as_deref(),
            ]
            .into_iter()
            .flatten()
            {
                if let Some(token) = normalize_token(Some(candidate)) {
                    if &token == svc || svc.contains(&token) || token.contains(svc.as_str()) {
                        matched = true;
                        break;
                    }
                }
            }
            if !matched
                && recipe_service
                    .as_ref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true)
                && wt_name.is_none()
            {
                matched = true;
            }
        } else if recipe_service
            .as_ref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(true)
            && wt_name.is_none()
        {
            matched = true;
        }
        if !matched {
            continue;
        }
        let amount = per_unit * (quantity as f64);
        if amount > 0.0 {
            *totals.entry(item_id).or_insert(0.0) += amount;
        }
    }
    Ok(totals)
}

/// Calcula materiales con stock insuficiente para una cantidad concreta de una línea.
pub fn line_material_shortages_for_quantity(
    tx: &rusqlite::Transaction<'_>,
    invoice_item_id: i64,
    quantity: i64,
) -> Result<Vec<MaterialShortageDto>, String> {
    let (category_id, service, format_id, finish): (
        i64,
        Option<String>,
        Option<i64>,
        Option<String>,
    ) = tx
        .query_row(
            "SELECT category_id, service, format_id, finish FROM invoice_items WHERE id = ?1",
            params![invoice_item_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Línea de pedido no encontrada".to_string())?;

    let totals = resolve_line_material_totals(
        tx,
        invoice_item_id,
        category_id,
        service.as_deref(),
        format_id,
        finish.as_deref(),
        quantity,
    )?;

    let mut shortages = Vec::new();
    for (item_id, needed) in totals {
        if needed <= STOCK_EPS {
            continue;
        }
        let (name, available): (String, f64) = tx
            .query_row(
                "SELECT name, quantity FROM inventory_items WHERE id = ?1",
                params![item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| format!("Ítem de inventario #{} no encontrado", item_id))?;
        if available + STOCK_EPS < needed {
            shortages.push(MaterialShortageDto {
                inventory_item_id: item_id,
                name,
                needed,
                available,
            });
        }
    }
    Ok(shortages)
}

/// Calcula materiales con stock insuficiente para la cantidad pendiente de una línea.
pub fn line_material_shortages(
    tx: &rusqlite::Transaction<'_>,
    invoice_item_id: i64,
) -> Result<Vec<MaterialShortageDto>, String> {
    let (quantity, completed, status): (i64, i64, String) = tx
        .query_row(
            "SELECT quantity, completed_quantity,
                    COALESCE(production_line_status, 'en_produccion')
             FROM invoice_items WHERE id = ?1",
            params![invoice_item_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Línea de pedido no encontrada".to_string())?;

    if status == "listo" {
        return Ok(Vec::new());
    }
    let pending = (quantity - completed).max(0);
    line_material_shortages_for_quantity(tx, invoice_item_id, pending)
}

/// Actualiza `resource_missing` / `resource_note` de líneas no listo y la bandera del pedido.
pub fn recompute_invoice_resource_flags(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
) -> Result<(), String> {
    let line_ids: Vec<i64> = {
        let mut stmt = tx
            .prepare(
                "SELECT id FROM invoice_items
                 WHERE invoice_id = ?1
                   AND COALESCE(production_line_status, 'en_produccion') != 'listo'",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![invoice_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };

    for line_id in line_ids {
        let shortages = line_material_shortages(tx, line_id)?;
        if shortages.is_empty() {
            tx.execute(
                "UPDATE invoice_items SET resource_missing = 0, resource_note = NULL WHERE id = ?1",
                params![line_id],
            )
            .map_err(|e| e.to_string())?;
        } else {
            let note = format!(
                "Material en déficit: {}",
                format_shortages_message(&shortages)
            );
            tx.execute(
                "UPDATE invoice_items SET resource_missing = 1, resource_note = ?1 WHERE id = ?2",
                params![note, line_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.execute(
        "UPDATE invoices SET resource_missing = (
             SELECT CASE WHEN EXISTS (
                 SELECT 1 FROM invoice_items
                 WHERE invoice_id = ?1 AND resource_missing = 1
                   AND COALESCE(production_line_status, 'en_produccion') != 'listo'
             ) THEN 1 ELSE 0 END
         ) WHERE id = ?1",
        params![invoice_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Recalcula banderas de déficit en pedidos abiertos (p. ej. tras una entrada).
pub fn recompute_open_invoices_resource_flags(tx: &rusqlite::Transaction<'_>) -> Result<(), String> {
    let invoice_ids: Vec<i64> = {
        let mut stmt = tx
            .prepare(
                "SELECT DISTINCT i.id
                 FROM invoices i
                 JOIN invoice_items ii ON ii.invoice_id = i.id
                 WHERE i.deleted_at IS NULL AND i.cancelled_at IS NULL
                   AND COALESCE(ii.production_line_status, 'en_produccion') != 'listo'",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    for id in invoice_ids {
        recompute_invoice_resource_flags(tx, id)?;
    }
    Ok(())
}

fn apply_inventory_movement(
    tx: &rusqlite::Transaction<'_>,
    item_id: i64,
    movement_type: &str,
    quantity: f64,
    reason: Option<&str>,
    reference_id: Option<i64>,
    notes: Option<&str>,
) -> Result<i64, String> {
    if quantity <= 0.0 {
        return Err("La cantidad debe ser mayor que cero".to_string());
    }
    let current: f64 = tx
        .query_row(
            "SELECT quantity FROM inventory_items WHERE id = ?1",
            params![item_id],
            |row| row.get(0),
        )
        .map_err(|_| "Ítem de inventario no encontrado".to_string())?;

    let delta = if movement_type == "entrada" {
        quantity
    } else if movement_type == "salida" {
        -quantity
    } else {
        return Err("Tipo de movimiento inválido".to_string());
    };
    let new_quantity = current + delta;
    if new_quantity < 0.0 {
        let name: String = tx
            .query_row(
                "SELECT name FROM inventory_items WHERE id = ?1",
                params![item_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "material".to_string());
        return Err(format!(
            "Stock insuficiente de «{}»: disponible {:.2}, requerido {:.2}",
            name, current, quantity
        ));
    }

    let unit_snapshot: Option<String> = tx
        .query_row(
            "SELECT unit_snapshot FROM inventory_items WHERE id = ?1",
            params![item_id],
            |row| row.get(0),
        )
        .ok();

    tx.execute(
        "INSERT INTO inventory_movements (item_id, type, quantity, unit_snapshot, reason, reference_id, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            item_id,
            movement_type,
            quantity,
            unit_snapshot,
            reason,
            reference_id,
            notes
        ],
    )
    .map_err(|e| e.to_string())?;
    let movement_id = tx.last_insert_rowid();

    tx.execute(
        "UPDATE inventory_items SET quantity = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_quantity, item_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(movement_id)
}

/// Revierte salidas de inventario vinculadas a un pedido anulado (entrada compensatoria).
pub fn reverse_inventory_for_cancelled_invoice(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    invoice_number: &str,
) -> Result<(), String> {
    let rows: Vec<(i64, f64)> = {
        let mut stmt = tx
            .prepare(
                "SELECT item_id, SUM(quantity)
                 FROM inventory_movements
                 WHERE reference_id = ?1 AND type = 'salida'
                   AND COALESCE(notes, '') NOT LIKE 'Reverso anulación%'
                   AND COALESCE(notes, '') != 'Merma de producción'
                   AND id NOT IN (
                     SELECT inventory_movement_id FROM invoice_material_wastes
                     WHERE inventory_movement_id IS NOT NULL
                   )
                 GROUP BY item_id
                 HAVING SUM(quantity) > 0",
            )
            .map_err(|e| e.to_string())?;
        let mapped = stmt
            .query_map(params![invoice_id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        mapped
    };

    let reason = format!("Reverso anulación {}", invoice_number);
    for (item_id, quantity) in rows {
        apply_inventory_movement(
            tx,
            item_id,
            "entrada",
            quantity,
            Some(&reason),
            Some(invoice_id),
            Some("Reverso anulación de pedido"),
        )?;
    }

    tx.execute(
        "UPDATE invoice_items
         SET resource_missing = 0, resource_note = NULL
         WHERE invoice_id = ?1",
        params![invoice_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE invoices SET resource_missing = 0 WHERE id = ?1",
        params![invoice_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Inserts material assignments for an invoice line.
pub fn insert_invoice_item_materials(
    tx: &rusqlite::Transaction<'_>,
    invoice_item_id: i64,
    materials: &[InvoiceItemMaterialInput],
) -> Result<(), String> {
    for m in materials {
        if m.quantity_per_unit <= 0.0 {
            return Err("La cantidad de material por unidad debe ser mayor que cero".to_string());
        }
        let source = m
            .source
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .unwrap_or("manual");
        tx.execute(
            "INSERT INTO invoice_item_materials
                (invoice_item_id, inventory_item_id, quantity_per_unit, source, recipe_id)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                invoice_item_id,
                m.inventory_item_id,
                m.quantity_per_unit,
                source,
                m.recipe_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Deduce inventario de forma estricta (sin stock negativo) al concluir una línea.
pub fn deduct_inventory_for_line(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    invoice_number: &str,
    invoice_item_id: i64,
    category_id: i64,
    service: Option<&str>,
    format_id: Option<i64>,
    finish: Option<&str>,
    quantity: i64,
) -> Result<(), String> {
    if quantity <= 0 {
        return Ok(());
    }

    let totals = resolve_line_material_totals(
        tx,
        invoice_item_id,
        category_id,
        service,
        format_id,
        finish,
        quantity,
    )?;

    let reason = format!("Pedido {} (línea concluida)", invoice_number);
    for (item_id, amount) in totals {
        apply_inventory_movement(
            tx,
            item_id,
            "salida",
            amount,
            Some(&reason),
            Some(invoice_id),
            Some("Consumo por línea concluida"),
        )?;
    }
    Ok(())
}

/// Legacy whole-invoice deduction (kept for compatibility; prefer line deduction).
pub fn deduct_inventory_for_invoice(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    invoice_number: &str,
) -> Result<(), String> {
    let already: Option<String> = tx
        .query_row(
            "SELECT inventory_deducted_at FROM invoices WHERE id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();
    if already.is_some() {
        return Ok(());
    }

    let mut stmt = tx
        .prepare(
            "SELECT id, category_id, service, format_id, finish, quantity
             FROM invoice_items WHERE invoice_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let lines = stmt
        .query_map(params![invoice_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    for (item_id, category_id, service, format_id, finish, qty) in lines {
        deduct_inventory_for_line(
            tx,
            invoice_id,
            invoice_number,
            item_id,
            category_id,
            service.as_deref(),
            format_id,
            finish.as_deref(),
            qty,
        )?;
    }

    tx.execute(
        "UPDATE invoices SET inventory_deducted_at = datetime('now') WHERE id = ?1",
        params![invoice_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Resuelve el formato del ítem; si no viene, usa el formato base «Sin formato».
fn resolve_inventory_format_id(
    conn: &rusqlite::Connection,
    format_id: Option<i64>,
) -> Result<i64, String> {
    if let Some(id) = format_id.filter(|id| *id > 0) {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM formats WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err("El formato seleccionado no existe".to_string());
        }
        return Ok(id);
    }
    crate::commands::formats::ensure_sin_formato_row(conn)
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

fn material_category_name(conn: &rusqlite::Connection, id: i64) -> Result<String, String> {
    conn.query_row(
        "SELECT name FROM inventory_material_categories WHERE id = ?1 AND is_active = 1",
        params![id],
        |row| row.get(0),
    )
    .map_err(|_| "Categoría de material no válida".to_string())
}

fn map_recipe_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<InventoryRecipeDto> {
    Ok(InventoryRecipeDto {
        id: row.get(0)?,
        category_id: row.get(1)?,
        category_name: row.get(2)?,
        service: row.get(3)?,
        work_type_id: row.get(4)?,
        work_type_name: row.get(5)?,
        format_id: row.get(6)?,
        format_label: row.get(7)?,
        finish: row.get(8)?,
        inventory_item_id: row.get(9)?,
        inventory_item_name: row.get(10)?,
        quantity_per_unit: row.get(11)?,
        is_active: row.get::<_, i64>(12)? != 0,
    })
}

const RECIPE_SELECT: &str = "SELECT r.id, r.category_id,
        COALESCE(NULLIF(trim(pc.label_es), ''), pc.name),
        r.service, r.work_type_id, wt.name, r.format_id, f.label, r.finish,
        r.inventory_item_id, ii.name, r.quantity_per_unit, r.is_active
     FROM inventory_recipes r
     JOIN product_categories pc ON pc.id = r.category_id
     JOIN inventory_items ii ON ii.id = r.inventory_item_id
     LEFT JOIN work_types wt ON wt.id = r.work_type_id
     LEFT JOIN formats f ON f.id = r.format_id";

/// Lists material categories.
#[tauri::command]
pub fn inventory_material_categories_list(
    active_only: Option<bool>,
) -> Result<Vec<MaterialCategoryDto>, String> {
    let conn = db::open_connection()?;
    let only = active_only.unwrap_or(false);
    let sql = if only {
        "SELECT id, name, description, sort_order, is_active FROM inventory_material_categories
         WHERE is_active = 1 ORDER BY sort_order, name COLLATE NOCASE"
    } else {
        "SELECT id, name, description, sort_order, is_active FROM inventory_material_categories
         ORDER BY is_active DESC, sort_order, name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MaterialCategoryDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a material category.
#[tauri::command]
pub fn inventory_material_category_create(
    name: String,
    description: Option<String>,
    sort_order: Option<i64>,
) -> Result<MaterialCategoryDto, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre de la categoría es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    conn.execute(
        "INSERT INTO inventory_material_categories (name, description, sort_order, is_active)
         VALUES (?1, ?2, ?3, 1)",
        params![
            name,
            normalize_optional(description),
            sort_order.unwrap_or(10)
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe una categoría con ese nombre".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, description, sort_order, is_active FROM inventory_material_categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(MaterialCategoryDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Updates a material category.
#[tauri::command]
pub fn inventory_material_category_update(
    id: i64,
    name: String,
    description: Option<String>,
    sort_order: Option<i64>,
) -> Result<MaterialCategoryDto, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre de la categoría es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE inventory_material_categories
             SET name = ?1, description = ?2, sort_order = ?3 WHERE id = ?4",
            params![
                name,
                normalize_optional(description),
                sort_order.unwrap_or(10),
                id
            ],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                "Ya existe una categoría con ese nombre".to_string()
            } else {
                e.to_string()
            }
        })?;
    if updated == 0 {
        return Err("Categoría no encontrada".to_string());
    }
    conn.query_row(
        "SELECT id, name, description, sort_order, is_active FROM inventory_material_categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(MaterialCategoryDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Deactivates a material category.
#[tauri::command]
pub fn inventory_material_category_deactivate(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE inventory_material_categories SET is_active = 0 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Categoría no encontrada".to_string());
    }
    Ok(())
}

/// Reactivates a material category.
#[tauri::command]
pub fn inventory_material_category_reactivate(id: i64) -> Result<MaterialCategoryDto, String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE inventory_material_categories SET is_active = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Categoría no encontrada".to_string());
    }
    conn.query_row(
        "SELECT id, name, description, sort_order, is_active FROM inventory_material_categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(MaterialCategoryDto {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                sort_order: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Lists all inventory items (low-stock with threshold first).
#[tauri::command]
pub fn inventory_items_list() -> Result<Vec<InventoryItemDto>, String> {
    let conn = db::open_connection()?;
    let sql = format!(
        "{} ORDER BY (ii.min_stock > 0 AND ii.quantity <= ii.min_stock) DESC, ii.name COLLATE NOCASE",
        ITEM_SELECT
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_item_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Loads a single inventory item by id.
#[tauri::command]
pub fn inventory_item_get(id: i64) -> Result<InventoryItemDto, String> {
    let conn = db::open_connection()?;
    let sql = format!("{} WHERE ii.id = ?1", ITEM_SELECT);
    conn.query_row(&sql, params![id], map_item_row)
        .map_err(|_| "Ítem de inventario no encontrado".to_string())
}

/// Creates a new inventory item.
#[tauri::command]
pub fn inventory_item_create(payload: CreateItemPayload) -> Result<i64, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let cat_name = material_category_name(&conn, payload.material_category_id)?;
    let (unit_id, unit_snapshot, unit_label) =
        resolve_unit_fields(&conn, payload.unit_id, payload.unit)?;
    let format_id = resolve_inventory_format_id(&conn, payload.format_id)?;
    let category_label = normalize_optional(payload.category).or(Some(cat_name));
    conn.execute(
        "INSERT INTO inventory_items
            (name, category, material_category_id, format_id, unit_id, unit_snapshot, unit, quantity, min_stock, cost_per_unit, cost_per_unit_usd, supplier, notes, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))",
        params![
            name,
            category_label,
            payload.material_category_id,
            format_id,
            unit_id,
            unit_snapshot,
            unit_label,
            payload.quantity,
            payload.min_stock.max(0.0),
            payload.cost_per_unit.max(0.0),
            payload.cost_per_unit_usd.max(0.0),
            normalize_optional(payload.supplier),
            normalize_optional(payload.notes)
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

/// Updates an inventory item (quantity changes only via movements).
#[tauri::command]
pub fn inventory_item_update(payload: UpdateItemPayload) -> Result<(), String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let cat_name = material_category_name(&conn, payload.material_category_id)?;
    let (unit_id, unit_snapshot, unit_label) =
        resolve_unit_fields(&conn, payload.unit_id, payload.unit)?;
    let format_id = resolve_inventory_format_id(&conn, payload.format_id)?;
    let category_label = normalize_optional(payload.category).or(Some(cat_name));
    let updated = conn
        .execute(
            "UPDATE inventory_items
             SET name = ?1, category = ?2, material_category_id = ?3, format_id = ?4, unit_id = ?5, unit_snapshot = ?6, unit = ?7,
                 min_stock = ?8, cost_per_unit = ?9, cost_per_unit_usd = ?10, supplier = ?11, notes = ?12, updated_at = datetime('now')
             WHERE id = ?13",
            params![
                name,
                category_label,
                payload.material_category_id,
                format_id,
                unit_id,
                unit_snapshot,
                unit_label,
                payload.min_stock.max(0.0),
                payload.cost_per_unit.max(0.0),
                payload.cost_per_unit_usd.max(0.0),
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

/// Registers a stock movement (entrada/salida).
#[tauri::command]
pub fn inventory_movement_register(payload: MovementPayload) -> Result<(), String> {
    let movement_type = payload.movement_type.trim().to_lowercase();
    let reason = normalize_optional(payload.reason);
    if movement_type == "salida" && reason.is_none() {
        return Err("El motivo de la salida es obligatorio".to_string());
    }
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    apply_inventory_movement(
        &tx,
        payload.item_id,
        &movement_type,
        payload.quantity,
        reason.as_deref(),
        None,
        normalize_optional(payload.notes).as_deref(),
    )?;
    if movement_type == "entrada" {
        recompute_open_invoices_resource_flags(&tx)?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Demanda pendiente de materiales en pedidos abiertos (necesario > disponible).
#[tauri::command]
pub fn inventory_pending_order_demand() -> Result<Vec<InventoryPendingDemandDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT ii.id, ii.name, COALESCE(ii.unit_snapshot, ii.unit, ''), ii.quantity,
                    SUM(iim.quantity_per_unit * (inv_item.quantity - inv_item.completed_quantity)),
                    COUNT(DISTINCT inv.id)
             FROM invoice_item_materials iim
             JOIN invoice_items inv_item ON inv_item.id = iim.invoice_item_id
             JOIN invoices inv ON inv.id = inv_item.invoice_id
             JOIN inventory_items ii ON ii.id = iim.inventory_item_id
             WHERE inv.deleted_at IS NULL
               AND inv.cancelled_at IS NULL
               AND COALESCE(inv_item.production_line_status, 'en_produccion') != 'listo'
               AND (inv_item.quantity - inv_item.completed_quantity) > 0
             GROUP BY ii.id, ii.name, ii.unit_snapshot, ii.unit, ii.quantity
             HAVING SUM(iim.quantity_per_unit * (inv_item.quantity - inv_item.completed_quantity))
                    > ii.quantity + 1e-9
             ORDER BY ii.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let available: f64 = row.get(3)?;
            let needed: f64 = row.get(4)?;
            Ok(InventoryPendingDemandDto {
                inventory_item_id: row.get(0)?,
                item_name: row.get(1)?,
                unit: row.get(2)?,
                available,
                needed,
                shortfall: (needed - available).max(0.0),
                open_order_count: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
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

/// Clasifica el método de un movimiento de salida (`Manual`, `Rebaja por Pedido`, `Merma` o `Venta`).
fn classify_movement_method(
    movement_type: &str,
    reference_id: Option<i64>,
    reason: Option<&str>,
    notes: Option<&str>,
    is_sale: bool,
) -> String {
    if movement_type != "salida" {
        return "—".to_string();
    }
    if is_sale {
        return "Venta".to_string();
    }
    let notes_l = notes.map(|n| n.to_lowercase()).unwrap_or_default();
    let reason_l = reason.map(|r| r.trim().to_lowercase()).unwrap_or_default();
    if notes_l == "merma de producción"
        || notes_l == "merma de produccion"
        || reason_l.starts_with("merma ")
    {
        return "Merma".to_string();
    }
    let from_pedido = reference_id.is_some()
        || notes_l.contains("línea concluida")
        || notes_l.contains("linea concluida")
        || reason_l.starts_with("pedido ");
    if from_pedido {
        "Rebaja por Pedido".to_string()
    } else {
        "Manual".to_string()
    }
}

/// SQL del listado global de movimientos con cláusula de fecha interpolada.
fn inventory_movements_sql(date_clause: &str) -> String {
    format!(
        "SELECT m.id, m.item_id, ii.name, m.type, m.quantity, m.reason, m.date, m.notes, m.reference_id,
                s.id
         FROM inventory_movements m
         INNER JOIN inventory_items ii ON ii.id = m.item_id
         LEFT JOIN inventory_material_sales s ON s.inventory_movement_id = m.id
         WHERE {date_clause}
         ORDER BY m.date DESC, m.id DESC"
    )
}

/// Mapea una fila del listado global de movimientos.
fn map_movement_list_row(row: &Row<'_>) -> rusqlite::Result<InventoryMovementListDto> {
    let movement_type: String = row.get(3)?;
    let reason: Option<String> = row.get(5)?;
    let notes: Option<String> = row.get(7)?;
    let reference_id: Option<i64> = row.get(8)?;
    let sale_id: Option<i64> = row.get(9)?;
    let method = classify_movement_method(
        &movement_type,
        reference_id,
        reason.as_deref(),
        notes.as_deref(),
        sale_id.is_some(),
    );
    Ok(InventoryMovementListDto {
        id: row.get(0)?,
        item_id: row.get(1)?,
        item_name: row.get(2)?,
        movement_type,
        quantity: row.get(4)?,
        reason,
        date: row.get(6)?,
        notes,
        reference_id,
        method,
    })
}

/// Ejecuta el listado de movimientos con cláusula y parámetros.
fn query_movement_list(
    date_clause: &str,
    bind: impl rusqlite::Params,
) -> Result<Vec<InventoryMovementListDto>, String> {
    let conn = db::open_connection()?;
    let sql = inventory_movements_sql(date_clause);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(bind, map_movement_list_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Lists inventory movements for the current day, month, or all (local calendar).
#[tauri::command]
pub fn inventory_movements_list(period: String) -> Result<Vec<InventoryMovementListDto>, String> {
    let period = period.trim().to_lowercase();
    let date_clause = match period.as_str() {
        "hoy" => "date(m.date) = date('now', 'localtime')",
        "mes" => {
            "date(m.date) >= date('now', 'localtime', 'start of month')
             AND date(m.date) < date('now', 'localtime', 'start of month', '+1 month')"
        }
        "todos" => "1 = 1",
        _ => {
            return Err("Periodo inválido. Use «hoy», «mes» o «todos».".to_string());
        }
    };
    query_movement_list(date_clause, [])
}

/// Recorta una fecha opcional a `YYYY-MM-DD`.
fn normalize_optional_iso(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let t = v.trim();
        if t.len() >= 10 {
            Some(t[..10].to_string())
        } else {
            None
        }
    })
}

/// Valida que las fechas ISO del rango estén bien formadas y no invertidas.
fn validate_iso_range(from: &Option<String>, to: &Option<String>) -> Result<(), String> {
    for date in [from, to].into_iter().flatten() {
        if date.len() != 10 || &date[4..5] != "-" || &date[7..8] != "-" {
            return Err("Fecha inválida. Use YYYY-MM-DD.".to_string());
        }
        if !date.bytes().all(|b| b.is_ascii_digit() || b == b'-') {
            return Err("Fecha inválida. Use YYYY-MM-DD.".to_string());
        }
    }
    if let (Some(start), Some(end)) = (from, to) {
        if start > end {
            return Err("El rango Desde / Hasta está invertido.".to_string());
        }
    }
    Ok(())
}

const ISO_RANGE_MOVEMENT: &str = "(?1 IS NULL OR substr(m.date, 1, 10) >= ?1)
             AND (?2 IS NULL OR substr(m.date, 1, 10) <= ?2)";

const ISO_RANGE_INVOICE: &str = "(?1 IS NULL OR substr(inv.date, 1, 10) >= ?1)
             AND (?2 IS NULL OR substr(inv.date, 1, 10) <= ?2)";

/// Movimientos de inventario en un rango ISO (o histórico completo).
#[tauri::command]
pub fn inventory_movements_in_range(
    args: InventoryReportRangeArgs,
) -> Result<Vec<InventoryMovementListDto>, String> {
    let date_from = normalize_optional_iso(args.date_from);
    let date_to = normalize_optional_iso(args.date_to);
    validate_iso_range(&date_from, &date_to)?;
    query_movement_list(ISO_RANGE_MOVEMENT, params![date_from, date_to])
}

/// Cláusula de fecha local para filtros Día / Mes en curso / Total.
fn period_date_clause(column: &str, period: &str) -> Result<String, String> {
    match period {
        "hoy" => Ok(format!("date({column}) = date('now', 'localtime')")),
        "mes" => Ok(format!(
            "date({column}) >= date('now', 'localtime', 'start of month')
             AND date({column}) < date('now', 'localtime', 'start of month', '+1 month')"
        )),
        "todos" => Ok("1 = 1".to_string()),
        _ => Err("Periodo inválido. Use «hoy», «mes» o «todos».".to_string()),
    }
}

/// Etiqueta de la columna Formato: nombre del ítem, con formato de catálogo si aporta.
fn consumption_formato_label(name: &str, format_label: Option<&str>) -> String {
    let label = format_label.map(str::trim).unwrap_or("");
    if label.is_empty() || label.eq_ignore_ascii_case("Sin formato") {
        return name.to_string();
    }
    if name.contains(label) {
        name.to_string()
    } else {
        format!("{} · {}", name, label)
    }
}

/// SQL del kardex de consumo con cláusulas de fecha interpoladas.
fn inventory_consumption_sql(movement_clause: &str, invoice_clause: &str) -> String {
    format!(
        "SELECT
            ii.id,
            ii.name,
            COALESCE(f.label, ''),
            COALESCE(NULLIF(ii.unit_snapshot, ''), ii.unit, ''),
            ii.material_category_id,
            COALESCE(mc.name, 'Sin categoría'),
            ii.quantity,
            COALESCE(mov.entradas, 0),
            COALESCE(mov.salidas, 0),
            COALESCE(mov.mermas, 0),
            COALESCE(mov.ventas, 0),
            COALESCE(ped.solicitados, 0),
            COALESCE(ped.demanda, 0)
         FROM inventory_items ii
         LEFT JOIN formats f ON f.id = ii.format_id
         LEFT JOIN inventory_material_categories mc ON mc.id = ii.material_category_id
         LEFT JOIN (
            SELECT m.item_id,
                SUM(CASE WHEN m.type = 'entrada' THEN m.quantity ELSE 0 END) AS entradas,
                SUM(CASE WHEN m.type = 'salida' THEN m.quantity ELSE 0 END) AS salidas,
                SUM(CASE WHEN m.type = 'salida' AND (
                    EXISTS (
                        SELECT 1 FROM invoice_material_wastes w
                        WHERE w.inventory_movement_id = m.id
                    )
                    OR LOWER(COALESCE(m.notes, '')) IN ('merma de producción', 'merma de produccion')
                    OR LOWER(TRIM(COALESCE(m.reason, ''))) LIKE 'merma %'
                ) THEN m.quantity ELSE 0 END) AS mermas,
                SUM(CASE WHEN m.type = 'salida' AND EXISTS (
                    SELECT 1 FROM inventory_material_sales s
                    WHERE s.inventory_movement_id = m.id
                ) THEN m.quantity ELSE 0 END) AS ventas
            FROM inventory_movements m
            WHERE {movement_clause}
            GROUP BY m.item_id
         ) mov ON mov.item_id = ii.id
         LEFT JOIN (
            SELECT iim.inventory_item_id,
                SUM(iim.quantity_per_unit * inv_item.quantity) AS solicitados,
                SUM(CASE
                    WHEN COALESCE(inv_item.production_line_status, 'en_produccion') != 'listo'
                     AND (inv_item.quantity - inv_item.completed_quantity) > 0
                    THEN iim.quantity_per_unit
                         * (inv_item.quantity - inv_item.completed_quantity)
                    ELSE 0
                END) AS demanda
            FROM invoice_item_materials iim
            INNER JOIN invoice_items inv_item ON inv_item.id = iim.invoice_item_id
            INNER JOIN invoices inv ON inv.id = inv_item.invoice_id
            WHERE inv.deleted_at IS NULL
              AND inv.cancelled_at IS NULL
              AND {invoice_clause}
            GROUP BY iim.inventory_item_id
         ) ped ON ped.inventory_item_id = ii.id
         ORDER BY COALESCE(mc.name, 'Sin categoría') COLLATE NOCASE,
                  ii.name COLLATE NOCASE,
                  ii.id"
    )
}

/// Mapea una fila del kardex de consumo.
fn map_consumption_row(row: &Row<'_>) -> rusqlite::Result<InventoryConsumptionRowDto> {
    let name: String = row.get(1)?;
    let format_label: String = row.get(2)?;
    let existencia_final: f64 = row.get(6)?;
    let entradas: f64 = row.get(7)?;
    let salidas: f64 = row.get(8)?;
    let mermas: f64 = row.get(9)?;
    let ventas: f64 = row.get(10)?;
    let solicitados: f64 = row.get(11)?;
    let demanda: f64 = row.get(12)?;
    let existencia_inicial = existencia_final - entradas + salidas;
    let deficit = (demanda - existencia_final).max(0.0);
    let disponible = (existencia_final - demanda).max(0.0);
    Ok(InventoryConsumptionRowDto {
        item_id: row.get(0)?,
        formato: consumption_formato_label(&name, Some(&format_label)),
        unit: row.get(3)?,
        material_category_id: row.get(4)?,
        material_category_name: row.get(5)?,
        existencia_inicial,
        entradas,
        salidas,
        solicitados,
        mermas,
        ventas,
        existencia_final,
        demanda,
        deficit,
        disponible,
    })
}

/// Ejecuta el kardex de consumo con cláusulas y parámetros.
fn query_consumption_summary(
    movement_clause: &str,
    invoice_clause: &str,
    bind: impl rusqlite::Params,
) -> Result<Vec<InventoryConsumptionRowDto>, String> {
    let conn = db::open_connection()?;
    let sql = inventory_consumption_sql(movement_clause, invoice_clause);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(bind, map_consumption_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Resumen de consumo por ítem: existencias, movimientos, pedidos, mermas y ventas del periodo.
#[tauri::command]
pub fn inventory_consumption_summary(
    period: String,
) -> Result<Vec<InventoryConsumptionRowDto>, String> {
    let period = period.trim().to_lowercase();
    let movement_clause = period_date_clause("m.date", &period)?;
    let invoice_clause = period_date_clause("inv.date", &period)?;
    query_consumption_summary(&movement_clause, &invoice_clause, [])
}

/// Kardex de consumo en un rango ISO (o histórico completo).
#[tauri::command]
pub fn inventory_consumption_in_range(
    args: InventoryReportRangeArgs,
) -> Result<Vec<InventoryConsumptionRowDto>, String> {
    let date_from = normalize_optional_iso(args.date_from);
    let date_to = normalize_optional_iso(args.date_to);
    validate_iso_range(&date_from, &date_to)?;
    query_consumption_summary(ISO_RANGE_MOVEMENT, ISO_RANGE_INVOICE, params![date_from, date_to])
}

/// Lists production consumption recipes.
#[tauri::command]
pub fn inventory_recipes_list(active_only: Option<bool>) -> Result<Vec<InventoryRecipeDto>, String> {
    let conn = db::open_connection()?;
    let only = active_only.unwrap_or(true);
    let sql = if only {
        format!(
            "{} WHERE r.is_active = 1 ORDER BY pc.name, wt.name, f.label, ii.name",
            RECIPE_SELECT
        )
    } else {
        format!(
            "{} ORDER BY r.is_active DESC, pc.name, wt.name, f.label, ii.name",
            RECIPE_SELECT
        )
    };
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], map_recipe_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a production consumption recipe.
#[tauri::command]
pub fn inventory_recipe_create(payload: CreateRecipePayload) -> Result<InventoryRecipeDto, String> {
    if payload.quantity_per_unit <= 0.0 {
        return Err("La cantidad por unidad debe ser mayor que cero".to_string());
    }
    let conn = db::open_connection()?;
    let (wt_name, _wt_code): (String, String) = conn
        .query_row(
            "SELECT name, code FROM work_types WHERE id = ?1",
            params![payload.work_type_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Tipo de trabajo no válido".to_string())?;
    let finish = normalize_optional(payload.finish);
    conn.execute(
        "INSERT INTO inventory_recipes
            (category_id, service, work_type_id, format_id, finish, inventory_item_id, quantity_per_unit, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
        params![
            payload.category_id,
            wt_name,
            payload.work_type_id,
            payload.format_id,
            finish,
            payload.inventory_item_id,
            payload.quantity_per_unit
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let sql = format!("{} WHERE r.id = ?1", RECIPE_SELECT);
    conn.query_row(&sql, params![id], map_recipe_row)
        .map_err(|e| e.to_string())
}

/// Updates a production consumption recipe (affects future deductions only).
#[tauri::command]
pub fn inventory_recipe_update(payload: UpdateRecipePayload) -> Result<InventoryRecipeDto, String> {
    if payload.quantity_per_unit <= 0.0 {
        return Err("La cantidad por unidad debe ser mayor que cero".to_string());
    }
    let conn = db::open_connection()?;
    let finish = normalize_optional(payload.finish);
    let updated = conn
        .execute(
            "UPDATE inventory_recipes
             SET inventory_item_id = ?1, format_id = ?2, finish = ?3, quantity_per_unit = ?4
             WHERE id = ?5",
            params![
                payload.inventory_item_id,
                payload.format_id,
                finish,
                payload.quantity_per_unit,
                payload.id
            ],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Norma no encontrada".to_string());
    }
    let sql = format!("{} WHERE r.id = ?1", RECIPE_SELECT);
    conn.query_row(&sql, params![payload.id], map_recipe_row)
        .map_err(|e| e.to_string())
}

/// Deactivates a production consumption recipe.
#[tauri::command]
pub fn inventory_recipe_deactivate(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE inventory_recipes SET is_active = 0 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Norma no encontrada".to_string());
    }
    Ok(())
}

/// Reactivates a production consumption recipe.
#[tauri::command]
pub fn inventory_recipe_reactivate(id: i64) -> Result<InventoryRecipeDto, String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE inventory_recipes SET is_active = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Norma no encontrada".to_string());
    }
    let sql = format!("{} WHERE r.id = ?1", RECIPE_SELECT);
    conn.query_row(&sql, params![id], map_recipe_row)
        .map_err(|e| e.to_string())
}

const MERMA_MOVEMENT_NOTES: &str = "Merma de producción";

/// Etiqueta de motivo de merma (snapshot para el historial).
fn merma_reason_label(code: &str) -> Result<&'static str, String> {
    match code.trim().to_lowercase().as_str() {
        "error_impresion" => Ok("Error de impresión"),
        "material_defectuoso" => Ok("Material defectuoso"),
        "error_corte" => Ok("Error de corte"),
        "otro" => Ok("Otro"),
        _ => Err("Motivo de merma no válido".to_string()),
    }
}

/// Lista las mermas registradas de un pedido (más recientes primero).
#[tauri::command]
pub fn invoice_material_wastes_list(invoice_id: i64) -> Result<Vec<InvoiceMaterialWasteDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT w.id, w.invoice_id, w.inventory_item_id, ii.name,
                    COALESCE(ii.unit_snapshot, ii.unit, ''),
                    w.quantity, w.reason_code, w.reason_label, w.notes,
                    w.cost_per_unit_cup, w.cost_per_unit_usd, w.cost_cup, w.cost_usd,
                    w.inventory_movement_id, w.created_at
             FROM invoice_material_wastes w
             INNER JOIN inventory_items ii ON ii.id = w.inventory_item_id
             WHERE w.invoice_id = ?1
             ORDER BY w.created_at DESC, w.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![invoice_id], |row| {
            Ok(InvoiceMaterialWasteDto {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                inventory_item_id: row.get(2)?,
                item_name: row.get(3)?,
                unit: row.get(4)?,
                quantity: row.get(5)?,
                reason_code: row.get(6)?,
                reason_label: row.get(7)?,
                notes: row.get(8)?,
                cost_per_unit_cup: row.get(9)?,
                cost_per_unit_usd: row.get(10)?,
                cost_cup: row.get(11)?,
                cost_usd: row.get(12)?,
                inventory_movement_id: row.get(13)?,
                created_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Registra mermas de un pedido: descuenta almacén y guarda costo snapshot.
/// No modifica totales ni precio de venta del pedido.
#[tauri::command]
pub fn invoice_material_waste_register(
    payload: RegisterInvoiceMaterialWastePayload,
) -> Result<Vec<InvoiceMaterialWasteDto>, String> {
    if payload.items.is_empty() {
        return Err("Añade al menos un material merma.".to_string());
    }

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (invoice_number, cancelled_at, deleted_at): (String, Option<String>, Option<String>) = tx
        .query_row(
            "SELECT invoice_number, cancelled_at, deleted_at FROM invoices WHERE id = ?1",
            params![payload.invoice_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Pedido no encontrado".to_string())?;
    if deleted_at.is_some() {
        return Err("El pedido está eliminado.".to_string());
    }
    if cancelled_at.is_some() {
        return Err("No se puede registrar merma en un pedido anulado.".to_string());
    }

    for line in &payload.items {
        let reason_code = line.reason_code.trim().to_lowercase();
        let reason_label = merma_reason_label(&reason_code)?;
        let notes = normalize_optional(line.notes.clone());
        if reason_code == "otro" && notes.is_none() {
            return Err("Indica el detalle del motivo «Otro».".to_string());
        }
        if line.inventory_item_id <= 0 {
            return Err("Selecciona un material.".to_string());
        }
        if line.quantity <= 0.0 {
            return Err("La cantidad de merma debe ser mayor que cero.".to_string());
        }

        let (cost_per_unit_cup, cost_per_unit_usd): (f64, f64) = tx
            .query_row(
                "SELECT cost_per_unit, cost_per_unit_usd FROM inventory_items WHERE id = ?1",
                params![line.inventory_item_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| "Ítem de inventario no encontrado".to_string())?;
        let cost_cup = (cost_per_unit_cup.max(0.0) * line.quantity).max(0.0);
        let cost_usd = (cost_per_unit_usd.max(0.0) * line.quantity).max(0.0);

        let movement_reason = format!("Merma {} — {}", invoice_number, reason_label);
        let movement_id = apply_inventory_movement(
            &tx,
            line.inventory_item_id,
            "salida",
            line.quantity,
            Some(&movement_reason),
            Some(payload.invoice_id),
            Some(MERMA_MOVEMENT_NOTES),
        )?;

        tx.execute(
            "INSERT INTO invoice_material_wastes
                (invoice_id, inventory_item_id, quantity, reason_code, reason_label, notes,
                 cost_per_unit_cup, cost_per_unit_usd, cost_cup, cost_usd, inventory_movement_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                payload.invoice_id,
                line.inventory_item_id,
                line.quantity,
                reason_code,
                reason_label,
                notes,
                cost_per_unit_cup.max(0.0),
                cost_per_unit_usd.max(0.0),
                cost_cup,
                cost_usd,
                movement_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    recompute_open_invoices_resource_flags(&tx)?;
    tx.commit().map_err(|e| e.to_string())?;

    invoice_material_wastes_list(payload.invoice_id)
}

const SALE_MOVEMENT_REASON: &str = "Venta de material";

/// Formatea la cantidad de venta para el concepto de caja.
fn format_sale_qty(quantity: f64) -> String {
    if (quantity - quantity.round()).abs() < 1e-9 {
        format!("{}", quantity.round() as i64)
    } else {
        format!("{:.2}", quantity)
    }
}

/// Registra una venta de material: descuenta almacén (salida estricta) e ingresa el cobro en caja.
/// No crea pedido ni factura. Cajones CUP/USD independientes; la tasa es solo auditoría.
#[tauri::command]
pub fn inventory_material_sale_register(
    payload: RegisterMaterialSalePayload,
) -> Result<i64, String> {
    const EPS: f64 = 1e-6;
    if payload.inventory_item_id <= 0 {
        return Err("Selecciona un material.".to_string());
    }
    if payload.quantity <= 0.0 {
        return Err("La cantidad debe ser mayor que cero.".to_string());
    }

    let method = payload.payment_method.trim().to_lowercase();
    if method != "efectivo" && method != "transferencia" {
        return Err("Forma de pago inválida.".to_string());
    }

    let mut amount_cup = payload.amount_cup.max(0.0);
    let mut amount_usd = payload.amount_usd.unwrap_or(0.0).max(0.0);
    let mut rate = payload.exchange_rate.unwrap_or(0.0).max(0.0);

    let currency = if method == "transferencia" {
        amount_usd = 0.0;
        rate = 0.0;
        if amount_cup <= EPS {
            return Err("Indica el importe CUP de la transferencia.".to_string());
        }
        "CUP".to_string()
    } else {
        match payload.payment_currency.trim().to_lowercase().as_str() {
            "usd" => {
                amount_cup = 0.0;
                if amount_usd <= EPS {
                    return Err("Indica el importe USD de la venta.".to_string());
                }
                if rate <= EPS {
                    return Err("Indica una tasa USD→CUP válida (auditoría).".to_string());
                }
                "USD".to_string()
            }
            "cup" => {
                amount_usd = 0.0;
                rate = 0.0;
                if amount_cup <= EPS {
                    return Err("Indica el importe CUP de la venta.".to_string());
                }
                "CUP".to_string()
            }
            "mixto" => {
                if amount_cup <= EPS || amount_usd <= EPS {
                    return Err(
                        "El cobro mixto requiere importes en CUP y en USD mayores que cero."
                            .to_string(),
                    );
                }
                if rate <= EPS {
                    return Err("Indica una tasa USD→CUP válida (auditoría).".to_string());
                }
                "mixto".to_string()
            }
            _ => {
                return Err("Moneda de cobro inválida. Use USD, CUP o mixto.".to_string());
            }
        }
    };

    let notes = normalize_optional(payload.notes);
    let transfer_concept = normalize_optional(payload.transfer_concept);
    let denomination = if method == "efectivo" {
        normalize_optional(payload.denomination_breakdown)
    } else {
        None
    };

    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (name, unit_label): (String, String) = tx
        .query_row(
            "SELECT name, COALESCE(NULLIF(unit_snapshot, ''), unit, '')
             FROM inventory_items WHERE id = ?1",
            params![payload.inventory_item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Ítem de inventario no encontrado".to_string())?;

    let mut concept = format!(
        "Venta de material: {} ({} {})",
        name,
        format_sale_qty(payload.quantity),
        unit_label.trim()
    );
    if method == "transferencia" {
        if let Some(extra) = transfer_concept.as_ref() {
            concept.push_str(" · ");
            concept.push_str(extra);
        }
    }

    let movement_notes = notes
        .clone()
        .unwrap_or_else(|| SALE_MOVEMENT_REASON.to_string());
    let movement_id = apply_inventory_movement(
        &tx,
        payload.inventory_item_id,
        "salida",
        payload.quantity,
        Some(SALE_MOVEMENT_REASON),
        None,
        Some(&movement_notes),
    )?;

    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, amount_usd, exchange_rate,
             payment_method, denomination_breakdown, date)
         VALUES ('ingreso', ?1, 'venta_material', NULL, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
        params![
            concept,
            amount_cup,
            amount_usd,
            rate,
            method.as_str(),
            denomination.as_deref()
        ],
    )
    .map_err(|e| e.to_string())?;
    let cash_id = tx.last_insert_rowid();

    tx.execute(
        "INSERT INTO inventory_material_sales
            (inventory_item_id, quantity, unit_snapshot, sale_amount_cup, sale_amount_usd,
             payment_currency, payment_method, exchange_rate, denomination_breakdown, notes,
             inventory_movement_id, cash_transaction_id, date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, datetime('now'))",
        params![
            payload.inventory_item_id,
            payload.quantity,
            unit_label,
            amount_cup,
            amount_usd,
            currency.as_str(),
            method.as_str(),
            rate,
            denomination.as_deref(),
            notes.as_deref(),
            movement_id,
            cash_id
        ],
    )
    .map_err(|e| e.to_string())?;
    let sale_id = tx.last_insert_rowid();

    tx.execute(
        "UPDATE cash_transactions SET reference_id = ?1 WHERE id = ?2",
        params![sale_id, cash_id],
    )
    .map_err(|e| e.to_string())?;

    recompute_open_invoices_resource_flags(&tx)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(sale_id)
}
