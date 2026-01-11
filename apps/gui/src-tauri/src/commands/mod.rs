// Tauri commands for tidy-app GUI
// Command names use snake_case per architecture requirements

mod config;
mod export;
mod llm;
mod rename;
mod scanner;
mod version;

pub use config::{get_config, reset_config, save_config};
pub use export::export_results;
pub use llm::{analyze_files_with_llm, check_ollama_health, check_openai_health, clear_analysis_cache, get_cache_stats, list_ollama_models, list_openai_models};
pub use rename::{execute_rename, generate_preview};
pub use scanner::scan_folder;
pub use version::get_version;
