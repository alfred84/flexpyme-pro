pub mod commands;
pub mod db;

#[cfg(not(debug_assertions))]
fn configure_release_database_path() -> Result<(), String> {
    let executable = std::env::current_exe()
        .map_err(|e| format!("No se pudo resolver la ruta del ejecutable: {}", e))?;
    let dir = executable
        .parent()
        .ok_or_else(|| "No se pudo resolver el directorio del ejecutable".to_string())?
        .to_path_buf();
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("No se pudo crear el directorio de datos: {}", e))?;
    db::set_release_db_path(dir.join("flexpyme.db"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            #[cfg(not(debug_assertions))]
            configure_release_database_path()?;
            db::init_database_schema_if_empty()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::healthcheck,
            commands::db_file_path,
            commands::db_status,
            commands::clients::clients_list,
            commands::clients::clients_get_by_id,
            commands::clients::clients_work_history,
            commands::clients::clients_create,
            commands::clients::clients_update,
            commands::clients::clients_soft_delete,
            commands::products::product_categories_list,
            commands::categories::get_categories,
            commands::categories::create_category,
            commands::categories::update_category,
            commands::categories::deactivate_category,
            commands::categories::reactivate_category,
            commands::units::get_units,
            commands::units::create_unit,
            commands::units::update_unit,
            commands::units::deactivate_unit,
            commands::stock::get_stock_items,
            commands::stock::get_stock_metrics,
            commands::products::formats_list,
            commands::products::prices_list,
            commands::products::prices_update,
            commands::products::prices_lookup,
            commands::invoices::invoices_list,
            commands::invoices::invoices_financial_list,
            commands::invoices::invoices_get_detail,
            commands::invoices::invoices_create,
            commands::invoices::invoices_update_production_status,
            commands::invoices::invoices_update_payment_status,
            commands::production::production_list,
            commands::production::production_get_detail,
            commands::production::production_export_in_date_range,
            commands::production::production_create,
            commands::reports::reports_summary,
            commands::reports::reports_top_debtors,
            commands::reports::reports_income_by_category,
            commands::reports::export_orders_csv,
            commands::reports::export_reports_xlsx,
            commands::reports::export_reports_pdf,
            commands::reports::export_clients_report,
            commands::reports::export_cashflow_report,
            commands::invoices::export_invoice_pdf,
            commands::invoices::get_invoice_payment_history,
            commands::invoices::get_invoice_metrics,
            commands::invoices::cancel_invoice,
            commands::formats::get_formats,
            commands::formats::create_format,
            commands::formats::update_format,
            commands::formats::deactivate_format,
            commands::work_types::get_work_types,
            commands::work_types::create_work_type,
            commands::work_types::update_work_type,
            commands::work_types::deactivate_work_type,
            commands::settings::settings_get_company,
            commands::settings::settings_save_company,
            commands::settings::settings_get_all,
            commands::settings::settings_set_value,
            commands::settings::settings_backup_database,
            commands::settings::settings_get_backup_overview,
            commands::settings::settings_set_backup_interval_days,
            commands::settings::settings_run_scheduled_backup_if_due,
            commands::settings::settings_restore_database,
            commands::settings::update_business_logo,
            commands::settings::remove_business_logo,
            commands::settings::get_db_location,
            commands::settings::open_db_folder,
            commands::employee_roles::get_employee_roles,
            commands::employee_roles::create_employee_role,
            commands::employee_roles::update_employee_role,
            commands::employee_roles::deactivate_employee_role,
            commands::products::cost_list_all,
            commands::products::cost_update,
            commands::cashier::cashier_sessions_for_invoice,
            commands::cashier::cashier_register_payment,
            commands::employees::employees_list,
            commands::employees::employees_get_by_id,
            commands::employees::employees_create,
            commands::employees::employees_update,
            commands::employees::employees_deactivate,
            commands::employees::employees_reactivate,
            commands::employees::cost_list_for_work_type,
            commands::employees::work_batch_create,
            commands::employees::work_batches_for_employee,
            commands::employees::work_batch_pay,
            commands::inventory::inventory_items_list,
            commands::inventory::inventory_item_get,
            commands::inventory::inventory_item_create,
            commands::inventory::inventory_item_update,
            commands::inventory::inventory_movement_register,
            commands::inventory::inventory_movements_for_item,
            commands::cashflow::cash_balance,
            commands::cashflow::cash_transactions_list,
            commands::cashflow::cash_daily_series,
            commands::cashflow::cash_transaction_create
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
