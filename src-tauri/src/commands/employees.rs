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
}

/// Payload for creating an employee.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEmployeePayload {
    pub name: String,
    pub role_id: Option<i64>,
    pub phone: Option<String>,
    pub notes: Option<String>,
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
    pub items: Vec<WorkBatchItemPayload>,
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
            Ok(EmployeeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                role_id: row.get(2)?,
                role: row.get(3)?,
                phone: row.get(4)?,
                notes: row.get(5)?,
                is_active: row.get::<_, i64>(6)? != 0,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Loads a single employee by id.
#[tauri::command]
pub fn employees_get_by_id(id: i64) -> Result<EmployeeDto, String> {
    let conn = db::open_connection()?;
    conn.query_row(
        "SELECT e.id, e.name, e.role_id,
                COALESCE(e.role_snapshot, er.name, e.role) AS role_label,
                e.phone, e.notes, e.is_active, e.created_at
         FROM employees e
         LEFT JOIN employee_roles er ON er.id = e.role_id
         WHERE e.id = ?1 AND e.deleted_at IS NULL",
        params![id],
        |row| {
            Ok(EmployeeDto {
                id: row.get(0)?,
                name: row.get(1)?,
                role_id: row.get(2)?,
                role: row.get(3)?,
                phone: row.get(4)?,
                notes: row.get(5)?,
                is_active: row.get::<_, i64>(6)? != 0,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|_| "Empleado no encontrado".to_string())
}

/// Creates a new employee.
#[tauri::command]
pub fn employees_create(payload: CreateEmployeePayload) -> Result<i64, String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let role_id = payload.role_id.ok_or_else(|| "Selecciona un rol".to_string())?;
    let conn = db::open_connection()?;
    let role_name: String = conn
        .query_row(
            "SELECT name FROM employee_roles WHERE id = ?1 AND is_active = 1",
            params![role_id],
            |row| row.get(0),
        )
        .map_err(|_| "Rol no válido".to_string())?;
    conn.execute(
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
    Ok(conn.last_insert_rowid())
}

/// Updates an existing employee.
#[tauri::command]
pub fn employees_update(payload: UpdateEmployeePayload) -> Result<(), String> {
    let name = payload.name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    let conn = db::open_connection()?;
    let role_id = payload.role_id.ok_or_else(|| "Selecciona un rol".to_string())?;
    let _role_exists: String = conn
        .query_row(
            "SELECT name FROM employee_roles WHERE id = ?1",
            params![role_id],
            |row| row.get(0),
        )
        .map_err(|_| "Rol no válido".to_string())?;
    let updated = conn
        .execute(
            "UPDATE employees
             SET name = ?1, role_id = ?2, phone = ?3, notes = ?4, updated_at = datetime('now')
             WHERE id = ?5 AND deleted_at IS NULL",
            params![
                name,
                role_id,
                normalize_optional(payload.phone),
                normalize_optional(payload.notes),
                payload.id
            ],
        )
        .map_err(|e| e.to_string())?;
    if updated == 0 {
        return Err("Empleado no encontrado".to_string());
    }
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
                (batch_id, client_id, format_id, category, quantity, unit_cost, subtotal)
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
