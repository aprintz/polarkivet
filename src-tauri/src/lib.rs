mod commands;
mod config;
mod db;
mod scanner;
mod thumbs;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir)?;
            db::init(&app_dir).expect("failed to initialise database");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scanner::scan_directory,
            commands::list_images,
            commands::search_images,
            commands::get_config,
            commands::save_config,
            commands::clear_index,
            commands::get_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
