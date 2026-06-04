pub mod commands;
pub mod db;

#[cfg(not(debug_assertions))]
use tauri::Manager;

#[cfg(not(debug_assertions))]
fn configure_release_database_path(app: &tauri::App) -> Result<(), String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("No se pudo resolver app_local_data_dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear el directorio de datos: {}", e))?;
    db::set_release_db_path(dir.join("flexpyme.db"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            configure_release_database_path(app)?;
            #[cfg(debug_assertions)]
            let _ = app;
            db::init_database_schema_if_empty()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::healthcheck,
            commands::db_file_path,
            commands::db_status,
            commands::clients::clients_list,
            commands::clients::clients_get_by_id,
            commands::clients::clients_create,
            commands::clients::clients_update,
            commands::clients::clients_soft_delete,
            commands::products::product_categories_list,
            commands::products::formats_list,
            commands::products::prices_list,
            commands::products::prices_update,
            commands::products::prices_lookup,
            commands::invoices::invoices_list,
            commands::invoices::invoices_get_detail,
            commands::invoices::invoices_create,
            commands::production::production_list,
            commands::production::production_get_detail,
            commands::production::production_export_in_date_range,
            commands::production::production_create,
            commands::reports::reports_summary,
            commands::reports::reports_top_debtors,
            commands::settings::settings_get_company,
            commands::settings::settings_save_company,
            commands::settings::settings_get_all,
            commands::settings::settings_set_value,
            commands::cashier::cashier_sessions_for_invoice,
            commands::cashier::cashier_register_payment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
