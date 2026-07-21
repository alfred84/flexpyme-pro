//! Employee CRUD and work-batch (salary) commands backed by SQLite.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db;

/// Employee row returned to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeDto {
    pub id: i64,
    pub name: String,
    pub role_id: Option<i64>,
    pub role: Option<String>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    /// Nombres de roles adicionales (para listado/detalle).
    pub extra_roles: Vec<String>,
    /// Ids de roles adicionales (para editar el formulario).
    pub extra_role_ids: Vec<i64>,
}

/// Payload for creating an employee.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmployeePayload {
    pub name: String,
    pub role_id: Option<i64>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub extra_role_ids: Option<Vec<i64>>,
}

/// Payload for updating an employee.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEmployeePayload {
    pub id: i64,
    pub name: String,
    pub role_id: Option<i64>,
    pub phone: Option<String>,
    pub notes: Option<String>,
    pub extra_role_ids: Option<Vec<i64>>,
}

/// Extra role assigned to an employee (multi-role support).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeExtraRoleDto {
    pub id: i64,
    pub role_id: i64,
    pub role: String,
}

/// One aggregated payroll row for an employee on a given day.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PayrollDailyRowDto {
    pub employee_id: i64,
    pub employee_name: String,
    pub date: String,
    pub total_cost: f64,
    pub paid: f64,
    pub pending: f64,
}

/// Cost-row for a work type (used to build the work-batch form).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkCostDto {
    pub format_id: i64,
    pub format_label: String,
    pub unit_cost: f64,
}

/// One line of a work batch (a format + quantity for an optional client).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkBatchItemPayload {
    pub client_id: i64,
    pub format_id: Option<i64>,
    pub category: String,
    pub quantity: i64,
    pub unit_cost: f64,
}

/// Payload for creating a work batch and its items.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkBatchPayload {
    pub employee_id: i64,
    pub work_type_id: i64,
    pub date: String,
    pub notes: Option<String>,
    pub pay_now: bool,
    pub invoice_id: Option<i64>,
    pub items: Vec<WorkBatchItemPayload>,
}

/// Work batch linked to an invoice (summary for pedido detail).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceWorkBatchDto {
    pub id: i64,
    pub employee_name: String,
    pub work_type: String,
    pub date: String,
    pub total_cost: f64,
    pub paid: f64,
    pub status: String,
}

/// Work batch summary row for an employee history.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkBatchDto {
    pub id: i64,
    pub work_type: String,
    pub date: String,
    pub total_cost: f64,
    pub paid: f64,
    pub status: String,
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

/// Loads extra role ids and labels for one employee.
fn load_extra_roles(
    conn: &rusqlite::Connection,
    employee_id: i64,
) -> Result<(Vec<i64>, Vec<String>), String> {
    let mut stmt = conn
        .prepare(
            "SELECT eer.role_id, COALESCE(eer.role_snapshot, er.name) AS role_label
             FROM employee_extra_roles eer
             JOIN employee_roles er ON er.id = eer.role_id
             WHERE eer.employee_id = ?1
             ORDER BY role_label COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![employee_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;
    let mut ids = Vec::new();
    let mut names = Vec::new();
    for r in rows {
        let (id, name) = r.map_err(|e| e.to_string())?;
        ids.push(id);
        names.push(name);
    }
    Ok((ids, names))
}

/// Replaces the extra-role set for an employee (excludes the main role).
fn sync_extra_roles(
    conn: &rusqlite::Connection,
    employee_id: i64,
    main_role_id: i64,
    extra_role_ids: &[i64],
) -> Result<(), String> {
    let mut unique: Vec<i64> = Vec::new();
    for &role_id in extra_role_ids {
        if role_id == main_role_id {
            continue;
        }
        if !unique.contains(&role_id) {
            unique.push(role_id);
        }
    }

    conn.execute(
        "DELETE FROM employee_extra_roles WHERE employee_id = ?1",
        params![employee_id],
    )
    .map_err(|e| e.to_string())?;

    for role_id in unique {
        let role_name: String = conn
            .query_row(
                "SELECT name FROM employee_roles WHERE id = ?1",
                params![role_id],
                |row| row.get(0),
            )
            .map_err(|_| "Rol adicional no válido".to_string())?;
        conn.execute(
            "INSERT INTO employee_extra_roles (employee_id, role_id, role_snapshot)
             VALUES (?1, ?2, ?3)",
            params![employee_id, role_id, role_name],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Lists employees. When `active_only` is true, hides deactivated employees.
#[tauri::command]
pub fn employees_list(active_only: Option<bool>) -> Result<Vec<EmployeeDto>, String> {
    let conn = db::open_connection()?;
    let only_active = active_only.unwrap_or(false);
    let sql = if only_active {
        "SELECT e.id, e.name, e.role_id,
                COALESCE(e.role_snapshot, er.name, e.role) AS role_label,
                e.phone, e.notes, e.is_active, e.created_at
         FROM employees e
         LEFT JOIN employee_roles er ON er.id = e.role_id
         WHERE e.deleted_at IS NULL AND e.is_active = 1
         ORDER BY e.name COLLATE NOCASE"
    } else {
        "SELECT e.id, e.name, e.role_id,
                COALESCE(e.role_snapshot, er.name, e.role) AS role_label,
                e.phone, e.notes, e.is_active, e.created_at
         FROM employees e
         LEFT JOIN employee_roles er ON er.id = e.role_id
         WHERE e.deleted_at IS NULL
         ORDER BY e.is_active DESC, e.name COLLATE NOCASE"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, i64>(6)? != 0,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for r in rows {
        let (id, name, role_id, role, phone, notes, is_active, created_at) =
            r.map_err(|e| e.to_string())?;
        let (extra_role_ids, extra_roles) = load_extra_roles(&conn, id)?;
        out.push(EmployeeDto {
            id,
            name,
            role_id,
            role,
            phone,
            notes,
            is_active,
            created_at,
            extra_roles,
            extra_role_ids,
        });
    }
    Ok(out)
}

/// Loads a single employee by id.
#[tauri::command]
pub fn employees_get_by_id(id: i64) -> Result<EmployeeDto, String> {
    let conn = db::open_connection()?;
    let (emp_id, name, role_id, role, phone, notes, is_active, created_at) = conn
        .query_row(
            "SELECT e.id, e.name, e.role_id,
                    COALESCE(e.role_snapshot, er.name, e.role) AS role_label,
                    e.phone, e.notes, e.is_active, e.created_at
             FROM employees e
             LEFT JOIN employee_roles er ON er.id = e.role_id
             WHERE e.id = ?1 AND e.deleted_at IS NULL",
            params![id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, i64>(6)? != 0,
                    row.get::<_, String>(7)?,
                ))
            },
        )
        .map_err(|_| "Empleado no encontrado".to_string())?;
    let (extra_role_ids, extra_roles) = load_extra_roles(&conn, emp_id)?;
    Ok(EmployeeDto {
        id: emp_id,
        name,
        role_id,
        role,
        phone,
        notes,
        is_active,
        created_at,
        extra_roles,
        extra_role_ids,
    })
}

/// Creates a new employee.
#[tauri::command]
pub fn employees_create(payload: CreateEmployeePayload) -> Result<i64, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let role_id = payload.role_id.ok_or_else(|| "Selecciona un rol".to_string())?;
    let mut conn = db::open_connection()?;
    let role_name: String = conn
        .query_row(
            "SELECT name FROM employee_roles WHERE id = ?1 AND is_active = 1",
            params![role_id],
            |row| row.get(0),
        )
        .map_err(|_| "Rol no válido".to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO employees (name, role_id, role_snapshot, phone, notes, is_active, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, datetime('now'))",
        params![
            name,
            role_id,
            role_name,
            normalize_optional(payload.phone),
            normalize_optional(payload.notes)
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = tx.last_insert_rowid();
    let extras = payload.extra_role_ids.unwrap_or_default();
    sync_extra_roles(&*tx, id, role_id, &extras)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

/// Updates an existing employee.
#[tauri::command]
pub fn employees_update(payload: UpdateEmployeePayload) -> Result<(), String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let mut conn = db::open_connection()?;
    let role_id = payload.role_id.ok_or_else(|| "Selecciona un rol".to_string())?;
    let role_name: String = conn
        .query_row(
            "SELECT name FROM employee_roles WHERE id = ?1",
            params![role_id],
            |row| row.get(0),
        )
        .map_err(|_| "Rol no válido".to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let updated = tx
        .execute(
            "UPDATE employees
             SET name = ?1, role_id = ?2, role_snapshot = ?3, phone = ?4, notes = ?5,
                 updated_at = datetime('now')
             WHERE id = ?6 AND deleted_at IS NULL",
            params![
                name,
                role_id,
                role_name,
                normalize_optional(payload.phone),
                normalize_optional(payload.notes),
                payload.id
            ],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Empleado no encontrado".to_string());
    }
    let extras = payload.extra_role_ids.unwrap_or_default();
    sync_extra_roles(&*tx, payload.id, role_id, &extras)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Reactivates a previously deactivated employee.
#[tauri::command]
pub fn employees_reactivate(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE employees SET is_active = 1, updated_at = datetime('now')
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Empleado no encontrado".to_string());
    }
    Ok(())
}

/// Deactivates an employee (soft delete: is_active = 0).
#[tauri::command]
pub fn employees_deactivate(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let updated = conn
        .execute(
            "UPDATE employees SET is_active = 0, updated_at = datetime('now')
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Empleado no encontrado".to_string());
    }
    Ok(())
}

/// Returns the active cost rows for a given work type, joined with format labels.
#[tauri::command]
pub fn cost_list_for_work_type(work_type_id: i64) -> Result<Vec<WorkCostDto>, String> {
    let conn = db::open_connection()?;
    let code: String = conn
        .query_row(
            "SELECT code FROM work_types WHERE id = ?1 AND is_active = 1",
            params![work_type_id],
            |row| row.get(0),
        )
        .map_err(|_| "Tipo de trabajo no válido".to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT f.id, f.label, cl.unit_cost
             FROM cost_list cl
             JOIN formats f ON f.id = cl.format_id AND f.is_active = 1
             WHERE cl.is_active = 1 AND cl.work_type = ?1
             ORDER BY cl.unit_cost",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![code], |row| {
            Ok(WorkCostDto {
                format_id: row.get(0)?,
                format_label: row.get(1)?,
                unit_cost: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Creates a work batch with its items in a transaction. Optionally registers
/// the salary payment immediately as a cash egress.
#[tauri::command]
pub fn work_batch_create(payload: CreateWorkBatchPayload) -> Result<i64, String> {
    if payload.items.is_empty() {
        return Err("El lote debe tener al menos una línea".to_string());
    }
    let total_cost: f64 = payload
        .items
        .iter()
        .map(|item| item.unit_cost * item.quantity as f64)
        .sum();

    let mut conn = db::open_connection()?;
    let mut invoice_number: Option<String> = None;
    if let Some(invoice_id) = payload.invoice_id {
        invoice_number = conn
            .query_row(
                "SELECT invoice_number FROM invoices WHERE id = ?1 AND deleted_at IS NULL",
                params![invoice_id],
                |row| row.get::<_, String>(0),
            )
            .ok();
        if invoice_number.is_none() {
            return Err("Pedido no encontrado".to_string());
        }
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let paid = if payload.pay_now { total_cost } else { 0.0 };
    let status = if payload.pay_now { "pagado" } else { "pendiente" };

    let (work_code, work_name): (String, String) = tx
        .query_row(
            "SELECT code, name FROM work_types WHERE id = ?1",
            params![payload.work_type_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Tipo de trabajo no válido".to_string())?;

    tx.execute(
        "INSERT INTO production_batches (type, work_type_id, work_type_snapshot, date, employee_id, total_cost, paid, status, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            work_code,
            payload.work_type_id,
            work_name,
            payload.date.trim(),
            payload.employee_id,
            total_cost,
            paid,
            status,
            normalize_optional(payload.notes)
        ],
    )
    .map_err(|e| e.to_string())?;
    let batch_id = tx.last_insert_rowid();

    for item in &payload.items {
        let subtotal = item.unit_cost * item.quantity as f64;
        tx.execute(
            "INSERT INTO production_batch_items
                (batch_id, client_id, format_id, category, quantity, unit_cost, subtotal, invoice_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                batch_id,
                item.client_id,
                item.format_id,
                item.category.trim(),
                item.quantity,
                item.unit_cost,
                subtotal,
                payload.invoice_id
            ],
        )
        .map_err(|e| e.to_string())?;

        // Marca la conclusión en la línea del pedido correspondiente (Área+formato)
        // y descuenta el inventario por la cantidad concluida.
        if let Some(invoice_id) = payload.invoice_id {
            let number = invoice_number.as_deref().unwrap_or("");
            mark_invoice_item_completed(&tx, invoice_id, number, item)?;
        }
    }

    // Actualiza la bandera agregada de recurso faltante en el pedido.
    if let Some(invoice_id) = payload.invoice_id {
        tx.execute(
            "UPDATE invoices SET resource_missing = (
                 SELECT CASE WHEN EXISTS (
                     SELECT 1 FROM invoice_items
                     WHERE invoice_id = ?1 AND resource_missing = 1
                 ) THEN 1 ELSE 0 END
             ) WHERE id = ?1",
            params![invoice_id],
        )
        .map_err(|e| e.to_string())?;
    }

    if payload.pay_now {
        tx.execute(
            "INSERT INTO cash_transactions
                (type, concept, reference_type, reference_id, amount_cup, payment_method, date)
             VALUES ('egreso', ?1, 'salario', ?2, ?3, 'efectivo', datetime('now'))",
            params![
                format!("Pago lote {} ({})", batch_id, work_name),
                batch_id,
                total_cost
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(batch_id)
}

/// Marca como concluida (parcial o total) la línea de pedido que corresponde a
/// un ítem de lote de trabajo, emparejando por formato y Área (servicio).
///
/// Incrementa `completed_quantity` sin superar la cantidad pedida y fija
/// `completed_at`. Reparte la cantidad del lote entre las líneas coincidentes.
fn mark_invoice_item_completed(
    tx: &rusqlite::Transaction<'_>,
    invoice_id: i64,
    invoice_number: &str,
    item: &WorkBatchItemPayload,
) -> Result<(), String> {
    let mut stmt = tx
        .prepare(
            "SELECT id, category_id, service, quantity, completed_quantity
             FROM invoice_items
             WHERE invoice_id = ?1 AND (format_id = ?2 OR (?2 IS NULL AND format_id IS NULL))
             ORDER BY id",
        )
        .map_err(|e| e.to_string())?;
    let candidates = stmt
        .query_map(params![invoice_id, item.format_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut remaining = item.quantity;
    for (id, category_id, service, quantity, completed) in candidates {
        if remaining <= 0 {
            break;
        }
        let service = service.unwrap_or_default();
        if !crate::commands::area_tokens_match(&service, &item.category) {
            continue;
        }
        let pending = (quantity - completed).max(0);
        if pending <= 0 {
            continue;
        }
        let add = remaining.min(pending);
        tx.execute(
            "UPDATE invoice_items
             SET completed_quantity = completed_quantity + ?1, completed_at = datetime('now')
             WHERE id = ?2",
            params![add, id],
        )
        .map_err(|e| e.to_string())?;
        remaining -= add;

        // Descuenta el inventario por la cantidad concluida en esta línea.
        let service_filter = if service.trim().is_empty() {
            None
        } else {
            Some(service.as_str())
        };
        let deficit = crate::commands::inventory::deduct_inventory_for_line(
            tx,
            invoice_id,
            invoice_number,
            category_id,
            service_filter,
            add,
        )?;
        if !deficit.is_empty() {
            let note = format!("Recurso insuficiente: {}", deficit.join(", "));
            tx.execute(
                "UPDATE invoice_items SET resource_missing = 1, resource_note = ?1 WHERE id = ?2",
                params![note, id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Lists work batches for an employee (most recent first).
#[tauri::command]
pub fn work_batches_for_employee(employee_id: i64) -> Result<Vec<WorkBatchDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, type, date, total_cost, paid, status
             FROM production_batches
             WHERE employee_id = ?1
             ORDER BY date DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![employee_id], |row| {
            Ok(WorkBatchDto {
                id: row.get(0)?,
                work_type: row.get(1)?,
                date: row.get(2)?,
                total_cost: row.get(3)?,
                paid: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Marks a work batch as paid and registers the salary as a cash egress.
#[tauri::command]
pub fn work_batch_pay(batch_id: i64) -> Result<(), String> {
    let mut conn = db::open_connection()?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (total_cost, paid, work_type): (f64, f64, String) = tx
        .query_row(
            "SELECT total_cost, paid, type FROM production_batches WHERE id = ?1",
            params![batch_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Lote no encontrado".to_string())?;

    let remaining = (total_cost - paid).max(0.0);
    if remaining <= 1e-9 {
        return Err("El lote ya está pagado".to_string());
    }

    tx.execute(
        "UPDATE production_batches SET paid = total_cost, status = 'pagado' WHERE id = ?1",
        params![batch_id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO cash_transactions
            (type, concept, reference_type, reference_id, amount_cup, payment_method, date)
         VALUES ('egreso', ?1, 'salario', ?2, ?3, 'efectivo', datetime('now'))",
        params![format!("Pago lote {} ({})", batch_id, work_type), batch_id, remaining],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// Lists the extra roles assigned to an employee.
#[tauri::command]
pub fn employee_extra_roles_list(employee_id: i64) -> Result<Vec<EmployeeExtraRoleDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT eer.id, eer.role_id, COALESCE(eer.role_snapshot, er.name) AS role_label
             FROM employee_extra_roles eer
             JOIN employee_roles er ON er.id = eer.role_id
             WHERE eer.employee_id = ?1
             ORDER BY role_label COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![employee_id], |row| {
            Ok(EmployeeExtraRoleDto {
                id: row.get(0)?,
                role_id: row.get(1)?,
                role: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Adds an extra role to an employee (no duplicates, cannot equal main role).
#[tauri::command]
pub fn employee_extra_role_add(employee_id: i64, role_id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let main_role: Option<i64> = conn
        .query_row(
            "SELECT role_id FROM employees WHERE id = ?1 AND deleted_at IS NULL",
            params![employee_id],
            |row| row.get(0),
        )
        .map_err(|_| "Empleado no encontrado".to_string())?;
    if main_role == Some(role_id) {
        return Err("Ese rol ya es el rol principal del empleado".to_string());
    }
    let role_name: String = conn
        .query_row(
            "SELECT name FROM employee_roles WHERE id = ?1",
            params![role_id],
            |row| row.get(0),
        )
        .map_err(|_| "Rol no válido".to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO employee_extra_roles (employee_id, role_id, role_snapshot)
         VALUES (?1, ?2, ?3)",
        params![employee_id, role_id, role_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Removes an extra role assignment by its id.
#[tauri::command]
pub fn employee_extra_role_remove(id: i64) -> Result<(), String> {
    let conn = db::open_connection()?;
    let removed = conn
        .execute("DELETE FROM employee_extra_roles WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if removed == 0 {
        return Err("Rol adicional no encontrado".to_string());
    }
    Ok(())
}

/// Daily payroll for a month (`YYYY-MM`): total, paid and pending per
/// employee/day, derived from work batches (production_batches).
#[tauri::command]
pub fn payroll_daily(month: String) -> Result<Vec<PayrollDailyRowDto>, String> {
    let month = month.trim().to_string();
    if month.len() != 7 {
        return Err("Mes inválido (formato YYYY-MM)".to_string());
    }
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT pb.employee_id, e.name, pb.date,
                    COALESCE(SUM(pb.total_cost), 0), COALESCE(SUM(pb.paid), 0)
             FROM production_batches pb
             JOIN employees e ON e.id = pb.employee_id
             WHERE pb.employee_id IS NOT NULL
               AND strftime('%Y-%m', pb.date) = ?1
             GROUP BY pb.employee_id, pb.date
             ORDER BY pb.date DESC, e.name COLLATE NOCASE",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![month], |row| {
            let total_cost: f64 = row.get(3)?;
            let paid: f64 = row.get(4)?;
            Ok(PayrollDailyRowDto {
                employee_id: row.get(0)?,
                employee_name: row.get(1)?,
                date: row.get(2)?,
                total_cost,
                paid,
                pending: (total_cost - paid).max(0.0),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Lists work batches linked to an invoice (via batch items).
#[tauri::command]
pub fn work_batches_for_invoice(invoice_id: i64) -> Result<Vec<InvoiceWorkBatchDto>, String> {
    let conn = db::open_connection()?;
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT pb.id,
                    e.name,
                    COALESCE(pb.work_type_snapshot, pb.type),
                    pb.date,
                    pb.total_cost,
                    pb.paid,
                    pb.status
             FROM production_batches pb
             JOIN production_batch_items pbi ON pbi.batch_id = pb.id
             JOIN employees e ON e.id = pb.employee_id
             WHERE pbi.invoice_id = ?1
             ORDER BY pb.date DESC, pb.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![invoice_id], |row| {
            Ok(InvoiceWorkBatchDto {
                id: row.get(0)?,
                employee_name: row.get(1)?,
                work_type: row.get(2)?,
                date: row.get(3)?,
                total_cost: row.get(4)?,
                paid: row.get(5)?,
                status: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
