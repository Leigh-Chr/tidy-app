//! # Tauri Commands Module
//!
//! This module contains all IPC commands exposed to the frontend.
//! Commands use snake_case naming per architecture requirements.
//!
//! ## Command Categories
//!
//! - **Scanner** (`scan_folder`, `scan_folder_with_progress`, `cancel_scan`, `get_active_scans`)
//!   - Scan directories for files with filtering and cancellation support
//!   - Returns `FileInfo` objects with metadata and category information
//!
//! - **Rename** (`generate_preview`, `execute_rename`)
//!   - Generate rename proposals using template patterns
//!   - Execute batch renames with conflict detection
//!
//! - **History** (`record_operation`, `load_history`, `undo_operation`, etc.)
//!   - Track rename operations for undo/restore functionality
//!   - Persist history to disk in JSON format
//!
//! - **Config** (`get_config`, `save_config`, `reset_config`)
//!   - Manage user preferences and templates
//!   - Stored in OS-appropriate config directory
//!
//! - **Export** (`export_results`)
//!   - Export scan results to JSON format
//!
//! - **LLM** (`analyze_files_with_llm`, `check_ollama_health`, etc.)
//!   - AI-powered file analysis with Ollama or OpenAI
//!   - Caches results in memory to avoid redundant analysis
//!
//! - **Version** (`get_version`)
//!   - Get application version information
//!
//! ## Error Handling
//!
//! All commands return `Result<T, ErrorType>` where errors are serialized
//! as structured `ErrorResponse` objects for consistent frontend handling.
//! See [`error`] module for error types.

mod config;
pub mod error;
mod export;
mod history;
mod llm;
mod rename;
mod scanner;
mod security;
mod version;

pub use config::{get_config, reset_config, save_config};
pub use export::export_results;
pub use history::{
    can_undo_operation, clear_history, get_history_count, get_history_entry, load_history,
    record_operation, undo_operation,
};
pub use llm::{analyze_files_with_llm, check_ollama_health, check_openai_health, clear_analysis_cache, get_cache_stats, list_ollama_models, list_openai_models};
pub use rename::{execute_rename, generate_preview};
pub use scanner::{cancel_scan, get_active_scans, scan_folder, scan_folder_with_progress, ScanState};
pub use version::get_version;
