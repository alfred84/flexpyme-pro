//! Shared database configuration helpers.
//!
//! - **Debug (`tauri dev`)**: la BD sigue en `<repo>/.local/flexpyme.db` para alinear con `pnpm db:migrate`.
//! - **Release**: la BD vive junto al ejecutable portable como `flexpyme.db`.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use rusqlite::{params, Connection, OpenFlags};

/// Canonical SQLite database file used by desktop runtime and scripts (solo perfil debug / workspace).
pub const SQLITE_DB_PATH: &str = ".local/flexpyme.db";

static RELEASE_DB_PATH: OnceLock<PathBuf> = OnceLock::new();

/// Solo release: debe llamarse una vez desde `setup` antes de cualquier acceso a la BD.
pub fn set_release_db_path(path: PathBuf) -> Result<(), String> {
    RELEASE_DB_PATH
        .set(path)
        .map_err(|_| "La ruta de base de datos para release ya fue inicializada".to_string())
}

fn workspace_root_dir() -> Result<PathBuf, String> {
    let current = std::env::current_dir().map_err(|err| err.to_string())?;
    if current
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case("src-tauri"))
        .unwrap_or(false)
    {
        current
            .parent()
            .map(|p| p.to_path_buf())
            .ok_or_else(|| "No se pudo resolver la carpeta raiz del workspace".to_string())
    } else {
        Ok(current)
    }
}

/// Resolves the canonical SQLite path to an absolute path.
pub fn resolve_db_path() -> Result<PathBuf, String> {
    #[cfg(not(debug_assertions))]
    {
        return RELEASE_DB_PATH.get().cloned().ok_or_else(|| {
            "Base de datos no inicializada (release sin set_release_db_path)".to_string()
        });
    }
    #[cfg(debug_assertions)]
    {
        Ok(workspace_root_dir()?.join(SQLITE_DB_PATH))
    }
}

/// Migración inicial embebida (misma semántica que `src/db/migrations/`).
const EMBEDDED_INITIAL_SCHEMA: &str = include_str!("../migrations/0000_vengeful_cerebro.sql");

/// Migración v2 embebida: empleados, inventario, caja general, costos y columnas nuevas.
/// Mantener alineada con `src/db/migrations/0001_aberrant_talon.sql`.
const EMBEDDED_V2_SCHEMA: &str = include_str!("../migrations/0001_aberrant_talon.sql");
const EMBEDDED_PAYMENT_SCHEMA: &str = include_str!("../../src/db/migrations/0002_nasty_vermin.sql");
const EMBEDDED_EMPLOYEE_ROLES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0003_tough_giant_man.sql");
const EMBEDDED_DUAL_STATUS_SCHEMA: &str =
    include_str!("../../src/db/migrations/0004_young_quasimodo.sql");
const EMBEDDED_WORK_TYPES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0005_large_cerise.sql");
const EMBEDDED_CATEGORIES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0006_product_categories_v22.sql");
const EMBEDDED_UNITS_SCHEMA: &str = include_str!("../../src/db/migrations/0007_units_v22.sql");
const EMBEDDED_STOCK_INVOICES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0008_stock_invoices_v22.sql");
const EMBEDDED_EXCHANGE_RATE_HISTORY_SCHEMA: &str =
    include_str!("../../src/db/migrations/0009_exchange_rate_history.sql");
const EMBEDDED_INVENTORY_RECIPES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0010_inventory_recipes.sql");
const EMBEDDED_INVOICE_WORK_BATCHES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0011_invoice_work_batches.sql");
const EMBEDDED_CATEGORY_SERVICES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0012_category_services_finishes.sql");
const EMBEDDED_CASH_CHANGE_SCHEMA: &str =
    include_str!("../../src/db/migrations/0013_cash_change_breakdown.sql");
const EMBEDDED_ITEM_COMPLETION_SCHEMA: &str =
    include_str!("../../src/db/migrations/0014_invoice_item_completion.sql");
const EMBEDDED_INVENTORY_DEFICIT_SCHEMA: &str =
    include_str!("../../src/db/migrations/0015_inventory_deficit.sql");
const EMBEDDED_EMPLOYEE_EXTRA_ROLES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0016_employee_extra_roles.sql");
const EMBEDDED_OTHER_EXPENSES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0017_other_expenses.sql");
const EMBEDDED_EXPENSE_TYPES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0018_expense_types.sql");
const EMBEDDED_CATEGORY_WORK_TYPES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0019_category_work_types.sql");
const EMBEDDED_CATEGORY_FORMATS_SCHEMA: &str =
    include_str!("../../src/db/migrations/0020_category_formats.sql");
const EMBEDDED_FINISHES_CATALOG_SCHEMA: &str =
    include_str!("../../src/db/migrations/0021_finishes_catalog.sql");
const EMBEDDED_SIN_FORMATO_SCHEMA: &str =
    include_str!("../../src/db/migrations/0022_sin_formato.sql");
const EMBEDDED_INVENTORY_MATERIALS_V26_SCHEMA: &str =
    include_str!("../../src/db/migrations/0023_inventory_materials_v26.sql");
const EMBEDDED_ROLE_WORK_ASSIGNMENTS_SCHEMA: &str =
    include_str!("../../src/db/migrations/0024_role_work_and_line_assignments.sql");
const EMBEDDED_PRICE_DUAL_CURRENCY_SCHEMA: &str =
    include_str!("../../src/db/migrations/0025_price_list_dual_currency.sql");
const EMBEDDED_CLIENT_CREDIT_BALANCE_SCHEMA: &str =
    include_str!("../../src/db/migrations/0026_client_credit_balance.sql");
const EMBEDDED_EMPLOYEE_FIXED_DAILY_SALARY_SCHEMA: &str =
    include_str!("../../src/db/migrations/0027_employee_fixed_daily_salary.sql");
const EMBEDDED_EMPLOYEE_PAY_MODE_DESTAJO_SCHEMA: &str =
    include_str!("../../src/db/migrations/0028_employee_pay_mode_destajo.sql");
const EMBEDDED_EMPLOYEE_PAYMENT_CASH_LINK_SCHEMA: &str =
    include_str!("../../src/db/migrations/0029_employee_payment_cash_link.sql");
const EMBEDDED_DUAL_CURRENCY_ORDERS_SCHEMA: &str =
    include_str!("../../src/db/migrations/0030_dual_currency_orders.sql");
const EMBEDDED_CASH_PHYSICAL_AMOUNTS_SCHEMA: &str =
    include_str!("../../src/db/migrations/0031_cash_physical_amounts.sql");
const EMBEDDED_INVENTORY_COST_USD_SCHEMA: &str =
    include_str!("../../src/db/migrations/0032_inventory_cost_usd.sql");
const EMBEDDED_INVOICE_MATERIAL_WASTES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0033_invoice_material_wastes.sql");
const EMBEDDED_EMPLOYEE_MONTHLY_SALARY_SCHEMA: &str =
    include_str!("../../src/db/migrations/0034_employee_monthly_salary.sql");
const EMBEDDED_MONTHLY_SALARY_OPT_IN_SCHEMA: &str =
    include_str!("../../src/db/migrations/0035_monthly_salary_opt_in.sql");
const EMBEDDED_INVENTORY_ITEM_FORMAT_SCHEMA: &str =
    include_str!("../../src/db/migrations/0036_inventory_item_format.sql");
const EMBEDDED_INVENTORY_MATERIAL_SALES_SCHEMA: &str =
    include_str!("../../src/db/migrations/0037_inventory_material_sales.sql");
const EMBEDDED_CASH_MONTH_OPENINGS_SCHEMA: &str =
    include_str!("../../src/db/migrations/0038_cash_month_openings.sql");
const EMBEDDED_CASH_DAY_OPENINGS_SCHEMA: &str =
    include_str!("../../src/db/migrations/0039_cash_day_openings.sql");

fn migrate_legacy_db_if_needed(db_path: &PathBuf) -> Result<(), String> {
    if db_path.exists() {
        return Ok(());
    }

    let root = workspace_root_dir()?;
    let legacy_candidates = [
        root.join("src-tauri/flexpyme.db"),
        root.join("src-tauri/src-tauri/flexpyme.db"),
    ];
    if let Some(source) = legacy_candidates.iter().find(|p| p.exists()) {
        fs::copy(source, db_path).map_err(|err| {
            format!(
                "No se pudo migrar la base de datos legacy desde {} hacia {}: {}",
                source.to_string_lossy(),
                db_path.to_string_lossy(),
                err
            )
        })?;
    }
    Ok(())
}

/// Crea el archivo si no existe, copia legacy si aplica y aplica el esquema SQL vigente.
/// Debe ejecutarse al arrancar la app (desde `setup`), después de `set_release_db_path` en release.
pub fn init_database_schema_if_empty() -> Result<(), String> {
    let db_path = resolve_db_path()?;

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    migrate_legacy_db_if_needed(&db_path)?;

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    if !table_exists(&conn, "clients") {
        conn.execute_batch(EMBEDDED_INITIAL_SCHEMA)
            .map_err(|e| format!("No se pudo aplicar el esquema inicial de SQLite: {}", e))?;
    }

    // Aplica la migración v2 solo si las tablas nuevas aún no existen (instalación v1 -> v2).
    if !table_exists(&conn, "employees") {
        conn.execute_batch(EMBEDDED_V2_SCHEMA)
            .map_err(|e| format!("No se pudo aplicar el esquema v2 de SQLite: {}", e))?;
    }

    apply_current_migrations(&conn)?;
    Ok(())
}

/// Comprueba si existe una tabla con el nombre dado en la base de datos abierta.
fn table_exists(conn: &Connection, table_name: &str) -> bool {
    conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        params![table_name],
        |row| row.get::<_, i64>(0),
    )
    .map(|count| count > 0)
    .unwrap_or(false)
}

fn column_exists(conn: &Connection, table_name: &str, column_name: &str) -> bool {
    let pragma = format!("PRAGMA table_info({})", table_name);
    let mut stmt = match conn.prepare(&pragma) {
        Ok(stmt) => stmt,
        Err(_) => return false,
    };
    let rows = match stmt.query_map([], |row| row.get::<_, String>(1)) {
        Ok(rows) => rows,
        Err(_) => return false,
    };
    let found = rows.filter_map(Result::ok).any(|name| name == column_name);
    found
}

fn execute_migration(conn: &Connection, sql: &str, label: &str) -> Result<(), String> {
    conn.execute_batch(sql)
        .map_err(|e| format!("No se pudo aplicar la migración {}: {}", label, e))
}

fn apply_current_migrations(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "invoices", "payment_currency") {
        execute_migration(conn, EMBEDDED_PAYMENT_SCHEMA, "0002_nasty_vermin")?;
    }
    if !table_exists(conn, "employee_roles") {
        execute_migration(conn, EMBEDDED_EMPLOYEE_ROLES_SCHEMA, "0003_tough_giant_man")?;
    }
    if !column_exists(conn, "invoices", "production_status") {
        execute_migration(conn, EMBEDDED_DUAL_STATUS_SCHEMA, "0004_young_quasimodo")?;
    }
    if !table_exists(conn, "work_types") {
        execute_migration(conn, EMBEDDED_WORK_TYPES_SCHEMA, "0005_large_cerise")?;
    }
    if !column_exists(conn, "product_categories", "code") {
        execute_migration(
            conn,
            EMBEDDED_CATEGORIES_SCHEMA,
            "0006_product_categories_v22",
        )?;
    }
    if !table_exists(conn, "units") {
        execute_migration(conn, EMBEDDED_UNITS_SCHEMA, "0007_units_v22")?;
    }
    if !column_exists(conn, "invoices", "production_completed_at") {
        execute_migration(
            conn,
            EMBEDDED_STOCK_INVOICES_SCHEMA,
            "0008_stock_invoices_v22",
        )?;
    }
    if !table_exists(conn, "exchange_rate_history") {
        execute_migration(
            conn,
            EMBEDDED_EXCHANGE_RATE_HISTORY_SCHEMA,
            "0009_exchange_rate_history",
        )?;
    }
    if !table_exists(conn, "inventory_recipes") {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_RECIPES_SCHEMA,
            "0010_inventory_recipes",
        )?;
    } else if !column_exists(conn, "invoices", "inventory_deducted_at") {
        conn.execute(
            "ALTER TABLE invoices ADD COLUMN inventory_deducted_at TEXT",
            [],
        )
        .map_err(|e| format!("No se pudo aplicar inventory_deducted_at: {}", e))?;
    }
    if !column_exists(conn, "production_batch_items", "invoice_id") {
        execute_migration(
            conn,
            EMBEDDED_INVOICE_WORK_BATCHES_SCHEMA,
            "0011_invoice_work_batches",
        )?;
    }
    if !table_exists(conn, "category_services") {
        execute_migration(
            conn,
            EMBEDDED_CATEGORY_SERVICES_SCHEMA,
            "0012_category_services_finishes",
        )?;
    }
    if !column_exists(conn, "cash_sessions", "change_breakdown") {
        execute_migration(conn, EMBEDDED_CASH_CHANGE_SCHEMA, "0013_cash_change_breakdown")?;
    }
    if !column_exists(conn, "invoice_items", "completed_quantity") {
        execute_migration(
            conn,
            EMBEDDED_ITEM_COMPLETION_SCHEMA,
            "0014_invoice_item_completion",
        )?;
    }
    if !column_exists(conn, "invoice_items", "resource_missing") {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_DEFICIT_SCHEMA,
            "0015_inventory_deficit",
        )?;
    }
    if !table_exists(conn, "employee_extra_roles") {
        execute_migration(
            conn,
            EMBEDDED_EMPLOYEE_EXTRA_ROLES_SCHEMA,
            "0016_employee_extra_roles",
        )?;
    }
    if !table_exists(conn, "other_expenses") {
        execute_migration(conn, EMBEDDED_OTHER_EXPENSES_SCHEMA, "0017_other_expenses")?;
    }
    if !table_exists(conn, "expense_types") {
        execute_migration(conn, EMBEDDED_EXPENSE_TYPES_SCHEMA, "0018_expense_types")?;
    }
    if !table_exists(conn, "category_work_types") {
        execute_migration(
            conn,
            EMBEDDED_CATEGORY_WORK_TYPES_SCHEMA,
            "0019_category_work_types",
        )?;
    }
    if !table_exists(conn, "category_formats") {
        execute_migration(
            conn,
            EMBEDDED_CATEGORY_FORMATS_SCHEMA,
            "0020_category_formats",
        )?;
    }
    if !table_exists(conn, "finishes") {
        execute_migration(conn, EMBEDDED_FINISHES_CATALOG_SCHEMA, "0021_finishes_catalog")?;
    }
    if table_exists(conn, "category_finishes")
        && !column_exists(conn, "category_finishes", "finish_id")
    {
        conn.execute(
            "ALTER TABLE category_finishes ADD COLUMN finish_id integer REFERENCES finishes(id)",
            [],
        )
        .map_err(|e| format!("No se pudo añadir finish_id a category_finishes: {}", e))?;
        // Import any leftover free-text finishes into the catalog.
        conn.execute_batch(
            "INSERT OR IGNORE INTO finishes (name, is_active, is_system)
             SELECT DISTINCT trim(cf.finish), 1, 0
             FROM category_finishes cf
             WHERE cf.finish IS NOT NULL AND trim(cf.finish) <> ''
               AND NOT EXISTS (
                 SELECT 1 FROM finishes f WHERE lower(f.name) = lower(trim(cf.finish))
               );
             UPDATE category_finishes
             SET finish_id = (
               SELECT f.id FROM finishes f
               WHERE lower(f.name) = lower(trim(category_finishes.finish))
               LIMIT 1
             )
             WHERE finish_id IS NULL AND finish IS NOT NULL AND trim(finish) <> '';",
        )
        .map_err(|e| format!("No se pudo vincular category_finishes.finish_id: {}", e))?;
    }
    // Base format for categories without print sizes.
    let sin_formato_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM formats WHERE lower(label) = lower('Sin formato')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if sin_formato_exists == 0 {
        execute_migration(conn, EMBEDDED_SIN_FORMATO_SCHEMA, "0022_sin_formato")?;
    }
    if !table_exists(conn, "inventory_material_categories") {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_MATERIALS_V26_SCHEMA,
            "0023_inventory_materials_v26",
        )?;
    } else if !column_exists(conn, "inventory_items", "material_category_id") {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_MATERIALS_V26_SCHEMA,
            "0023_inventory_materials_v26",
        )?;
    } else if table_exists(conn, "inventory_recipes")
        && !column_exists(conn, "inventory_recipes", "work_type_id")
    {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_MATERIALS_V26_SCHEMA,
            "0023_inventory_materials_v26",
        )?;
    }
    if !table_exists(conn, "role_work_types") || !table_exists(conn, "invoice_item_assignments")
    {
        execute_migration(
            conn,
            EMBEDDED_ROLE_WORK_ASSIGNMENTS_SCHEMA,
            "0024_role_work_and_line_assignments",
        )?;
    }
    if !column_exists(conn, "invoice_items", "production_line_status") {
        conn.execute(
            "ALTER TABLE invoice_items ADD COLUMN production_line_status text NOT NULL DEFAULT 'en_produccion'",
            [],
        )
        .map_err(|e| {
            format!(
                "No se pudo aplicar production_line_status (0024): {}",
                e
            )
        })?;
    }
    if !column_exists(conn, "price_list", "price_cup") {
        execute_migration(
            conn,
            EMBEDDED_PRICE_DUAL_CURRENCY_SCHEMA,
            "0025_price_list_dual_currency",
        )?;
    }
    if !column_exists(conn, "clients", "credit_balance") {
        execute_migration(
            conn,
            EMBEDDED_CLIENT_CREDIT_BALANCE_SCHEMA,
            "0026_client_credit_balance",
        )?;
    }
    if !column_exists(conn, "employees", "has_fixed_daily_salary") {
        execute_migration(
            conn,
            EMBEDDED_EMPLOYEE_FIXED_DAILY_SALARY_SCHEMA,
            "0027_employee_fixed_daily_salary",
        )?;
    }
    if !column_exists(conn, "employees", "pay_mode") {
        execute_migration(
            conn,
            EMBEDDED_EMPLOYEE_PAY_MODE_DESTAJO_SCHEMA,
            "0028_employee_pay_mode_destajo",
        )?;
    }
    if !column_exists(conn, "production_batches", "cash_transaction_id") {
        execute_migration(
            conn,
            EMBEDDED_EMPLOYEE_PAYMENT_CASH_LINK_SCHEMA,
            "0029_employee_payment_cash_link",
        )?;
    }
    if !column_exists(conn, "invoice_items", "unit_price_usd") {
        execute_migration(
            conn,
            EMBEDDED_DUAL_CURRENCY_ORDERS_SCHEMA,
            "0030_dual_currency_orders",
        )?;
    }
    // Data-only: idempotent cleanup of USD→CUP equivalents wrongly stored in amount_cup.
    if !settings_flag_set(conn, "migration_0031_cash_physical_amounts") {
        execute_migration(
            conn,
            EMBEDDED_CASH_PHYSICAL_AMOUNTS_SCHEMA,
            "0031_cash_physical_amounts",
        )?;
        set_settings_flag(conn, "migration_0031_cash_physical_amounts")?;
    }
    if !column_exists(conn, "inventory_items", "cost_per_unit_usd") {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_COST_USD_SCHEMA,
            "0032_inventory_cost_usd",
        )?;
    }
    if !table_exists(conn, "invoice_material_wastes") {
        execute_migration(
            conn,
            EMBEDDED_INVOICE_MATERIAL_WASTES_SCHEMA,
            "0033_invoice_material_wastes",
        )?;
    }
    if !column_exists(conn, "employees", "fixed_monthly_salary_cup") {
        execute_migration(
            conn,
            EMBEDDED_EMPLOYEE_MONTHLY_SALARY_SCHEMA,
            "0034_employee_monthly_salary",
        )?;
    }
    if !settings_flag_set(conn, "migration_0035_monthly_salary_opt_in") {
        execute_migration(
            conn,
            EMBEDDED_MONTHLY_SALARY_OPT_IN_SCHEMA,
            "0035_monthly_salary_opt_in",
        )?;
        set_settings_flag(conn, "migration_0035_monthly_salary_opt_in")?;
    }
    if !column_exists(conn, "inventory_items", "format_id") {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_ITEM_FORMAT_SCHEMA,
            "0036_inventory_item_format",
        )?;
    }
    if !table_exists(conn, "inventory_material_sales") {
        execute_migration(
            conn,
            EMBEDDED_INVENTORY_MATERIAL_SALES_SCHEMA,
            "0037_inventory_material_sales",
        )?;
    }
    if !table_exists(conn, "cash_month_openings") {
        execute_migration(
            conn,
            EMBEDDED_CASH_MONTH_OPENINGS_SCHEMA,
            "0038_cash_month_openings",
        )?;
    }
    if !table_exists(conn, "cash_day_openings") {
        execute_migration(
            conn,
            EMBEDDED_CASH_DAY_OPENINGS_SCHEMA,
            "0039_cash_day_openings",
        )?;
    }
    Ok(())
}

/// True if `settings.key` exists with a non-empty value.
fn settings_flag_set(conn: &Connection, key: &str) -> bool {
    conn.query_row(
        "SELECT COUNT(*) FROM settings WHERE key = ?1 AND TRIM(value) != ''",
        params![key],
        |row| row.get::<_, i64>(0),
    )
    .map(|count| count > 0)
    .unwrap_or(false)
}

/// Marks a one-shot data migration as applied.
fn set_settings_flag(conn: &Connection, key: &str) -> Result<(), String> {
    if !table_exists(conn, "settings") {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, '1')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key],
    )
    .map_err(|e| format!("No se pudo registrar la migración {}: {}", key, e))?;
    Ok(())
}

/// Validates that a SQLite file is readable and compatible with the current FlexPyme schema.
pub fn validate_database_compatibility(path: &Path) -> Result<(), String> {
    if !path.exists() || !path.is_file() {
        return Err("Archivo de base de datos no encontrado".to_string());
    }
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("No se pudo abrir la base de datos seleccionada: {}", e))?;
    let integrity: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| {
            format!(
                "No se pudo verificar la integridad de la base de datos: {}",
                e
            )
        })?;
    if integrity != "ok" {
        return Err(format!(
            "La base de datos no pasó la verificación de integridad: {}",
            integrity
        ));
    }

    let required_tables = [
        "settings",
        "clients",
        "invoices",
        "invoice_items",
        "product_categories",
        "units",
        "inventory_items",
        "cash_transactions",
    ];
    for table in required_tables {
        if !table_exists(&conn, table) {
            return Err(format!(
                "Base de datos incompatible: falta la tabla {}",
                table
            ));
        }
    }

    let required_columns = [
        ("invoice_items", "category_snapshot"),
        ("product_categories", "code"),
        ("inventory_items", "unit_id"),
        ("inventory_items", "unit_snapshot"),
        ("invoices", "production_completed_at"),
        ("invoices", "cancelled_at"),
    ];
    for (table, column) in required_columns {
        if !column_exists(&conn, table, column) {
            return Err(format!(
                "Base de datos incompatible: falta la columna {}.{}",
                table, column
            ));
        }
    }
    Ok(())
}

/// Opens a shared SQLite connection for Tauri commands.
pub fn open_connection() -> Result<Connection, String> {
    let db_path = resolve_db_path()?;

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    migrate_legacy_db_if_needed(&db_path)?;

    Connection::open(&db_path).map_err(|err| err.to_string())
}

/// Ensures the SQLite file exists (schema is applied by Drizzle migrations / seed).
pub fn ensure_database_ready() -> Result<String, String> {
    let db_path = resolve_db_path()?;
    let conn = open_connection()?;
    let has_clients_table: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            params!["clients"],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if has_clients_table == 0 {
        return Err(format!(
            "Base de datos sin esquema (tabla clients no encontrada): {}",
            db_path.to_string_lossy()
        ));
    }
    Ok(db_path.to_string_lossy().to_string())
}
