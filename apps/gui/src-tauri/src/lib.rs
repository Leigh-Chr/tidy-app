// tidy-app Tauri backend
// Provides IPC bridge between React frontend and Rust/Node.js core

mod commands;

use commands::{
    analyze_files_with_llm, can_undo_operation, check_ollama_health, check_openai_health,
    clear_analysis_cache, clear_history, execute_rename, export_results, generate_preview,
    get_cache_stats, get_config, get_history_count, get_history_entry, get_version, load_history,
    list_ollama_models, list_openai_models, record_operation, reset_config, save_config,
    scan_folder, undo_operation,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window not found");

            // Apply vibrancy effects based on platform
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None);
            }

            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::apply_mica;
                // Try Mica first (Windows 11), falls back gracefully on older Windows
                let _ = apply_mica(&window, None);
            }

            // Linux: vibrancy depends on compositor, we skip it
            // The app will use CSS backdrop-blur as fallback

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_version,
            scan_folder,
            get_config,
            save_config,
            reset_config,
            generate_preview,
            execute_rename,
            export_results,
            check_ollama_health,
            list_ollama_models,
            check_openai_health,
            list_openai_models,
            analyze_files_with_llm,
            clear_analysis_cache,
            get_cache_stats,
            // History commands (Story 9.1)
            load_history,
            record_operation,
            get_history_entry,
            get_history_count,
            undo_operation,
            can_undo_operation,
            clear_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
