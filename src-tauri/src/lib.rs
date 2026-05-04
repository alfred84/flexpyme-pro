pub mod commands;
pub mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            commands::production::production_create,
            commands::reports::reports_summary,
            commands::reports::reports_top_debtors,
            commands::settings::settings_get_company,
            commands::settings::settings_save_company,
            commands::cashier::cashier_sessions_for_invoice,
            commands::cashier::cashier_register_payment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
