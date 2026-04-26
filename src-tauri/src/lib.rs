mod commands;
mod db;

use db::connection::open_database;
use db::repository::Database;
use db::DatabaseState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let connection = open_database(app.handle())?;
            let database = Database::new(connection);

            app.manage(DatabaseState::new(database));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::documents::list_documents,
            commands::documents::create_document,
            commands::documents::open_document,
            commands::documents::open_last_opened_document,
            commands::documents::create_child_node,
            commands::documents::select_node,
            commands::documents::set_node_collapsed,
            commands::documents::update_node_content,
            commands::documents::set_node_learning_status,
            commands::documents::rename_node,
            commands::documents::delete_leaf_node,
            commands::documents::delete_document,
            commands::documents::set_document_viewport
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
