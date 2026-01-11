// tidy-app Tauri backend
// Provides IPC bridge between React frontend and Rust/Node.js core

mod commands;

use commands::{
    execute_rename, export_results, generate_preview, get_config, get_version, reset_config,
    save_config, scan_folder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_version,
            scan_folder,
            get_config,
            save_config,
            reset_config,
            generate_preview,
            execute_rename,
            export_results
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
