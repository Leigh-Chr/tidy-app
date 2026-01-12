// History module for operation history - Story 9.1
// Enables undo functionality and operation review
//
// Command names use snake_case per architecture requirements

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;
use ts_rs::TS;
use uuid::Uuid;

use super::rename::{BatchRenameResult, FileRenameResult, RenameOutcome};

// =============================================================================
// Error Types
// =============================================================================

#[derive(Debug, Error)]
pub enum HistoryError {
    #[error("Failed to load history: {0}")]
    LoadFailed(String),
    #[error("Failed to save history: {0}")]
    SaveFailed(String),
    #[error("Entry not found: {0}")]
    EntryNotFound(String),
    #[error("Undo failed: {0}")]
    UndoFailed(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Serialize for HistoryError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// =============================================================================
// History Types
// =============================================================================

/// Operation type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "lowercase")]
pub enum OperationType {
    Rename,
    Move,
}

/// Record of a single file operation
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryRecord {
    pub original_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_path: Option<String>,
    pub is_move_operation: bool,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Summary of an operation
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OperationSummary {
    pub succeeded: usize,
    pub skipped: usize,
    pub failed: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub directories_created: Option<usize>,
}

/// A single operation history entry
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OperationHistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub operation_type: OperationType,
    pub file_count: usize,
    pub summary: OperationSummary,
    pub duration_ms: u64,
    pub files: Vec<FileHistoryRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub directories_created: Option<Vec<String>>,
    #[serde(default)]
    pub undone: bool,
}

/// The history store containing all entries
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct HistoryStore {
    pub version: String,
    pub entries: Vec<OperationHistoryEntry>,
    pub last_modified: String,
}

impl Default for HistoryStore {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            entries: Vec::new(),
            last_modified: Utc::now().to_rfc3339(),
        }
    }
}

/// Result of an undo operation
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct UndoResult {
    pub success: bool,
    pub entry_id: String,
    pub files_restored: usize,
    pub files_failed: usize,
    pub errors: Vec<String>,
}

// =============================================================================
// History File Path
// =============================================================================

const HISTORY_FILENAME: &str = "history.json";

/// Get the path to the history file
fn get_history_path() -> Result<PathBuf, HistoryError> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| HistoryError::LoadFailed("Could not find config directory".to_string()))?;

    let tidy_dir = config_dir.join("tidy-app");

    // Create directory if it doesn't exist
    if !tidy_dir.exists() {
        fs::create_dir_all(&tidy_dir)?;
    }

    Ok(tidy_dir.join(HISTORY_FILENAME))
}

// =============================================================================
// Storage Functions
// =============================================================================

/// Load history from disk
#[tauri::command]
pub async fn load_history() -> Result<HistoryStore, HistoryError> {
    let path = get_history_path()?;

    if !path.exists() {
        return Ok(HistoryStore::default());
    }

    let contents = fs::read_to_string(&path)?;
    let store: HistoryStore = serde_json::from_str(&contents)
        .map_err(|e| HistoryError::LoadFailed(e.to_string()))?;

    Ok(store)
}

/// Save history to disk
async fn save_history(store: &HistoryStore) -> Result<(), HistoryError> {
    let path = get_history_path()?;

    let contents = serde_json::to_string_pretty(store)
        .map_err(|e| HistoryError::SaveFailed(e.to_string()))?;

    fs::write(&path, contents)?;

    Ok(())
}

// =============================================================================
// Recording Functions
// =============================================================================

/// Determine operation type from results
fn determine_operation_type(_results: &[FileRenameResult]) -> OperationType {
    // Check if any file has is_folder_move true
    // For now, we treat all as rename since is_folder_move isn't in FileRenameResult
    // This will need to be updated when move operations are properly tracked
    OperationType::Rename
}

/// Create a history entry from a batch rename result
pub fn create_entry_from_result(result: &BatchRenameResult) -> OperationHistoryEntry {
    let id = Uuid::new_v4().to_string();
    let timestamp = Utc::now().to_rfc3339();

    let files: Vec<FileHistoryRecord> = result.results.iter().map(|r| {
        FileHistoryRecord {
            original_path: r.original_path.clone(),
            new_path: r.new_path.clone(),
            is_move_operation: false, // Will be updated when move tracking is added
            success: r.outcome == RenameOutcome::Success,
            error: r.error.clone(),
        }
    }).collect();

    let operation_type = determine_operation_type(&result.results);

    OperationHistoryEntry {
        id,
        timestamp,
        operation_type,
        file_count: result.results.len(),
        summary: OperationSummary {
            succeeded: result.summary.succeeded,
            skipped: result.summary.skipped,
            failed: result.summary.failed,
            directories_created: None,
        },
        duration_ms: result.duration_ms,
        files,
        directories_created: None,
        undone: false,
    }
}

/// Record an operation to history
#[tauri::command]
pub async fn record_operation(
    result: BatchRenameResult,
) -> Result<OperationHistoryEntry, HistoryError> {
    // Load existing history
    let mut store = load_history().await?;

    // Create new entry
    let entry = create_entry_from_result(&result);

    // Prepend to entries (newest first)
    store.entries.insert(0, entry.clone());
    store.last_modified = Utc::now().to_rfc3339();

    // Save updated history
    save_history(&store).await?;

    Ok(entry)
}

// =============================================================================
// Query Functions
// =============================================================================

/// Get a specific history entry by ID
#[tauri::command]
pub async fn get_history_entry(entry_id: String) -> Result<OperationHistoryEntry, HistoryError> {
    let store = load_history().await?;

    store.entries
        .into_iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| HistoryError::EntryNotFound(entry_id))
}

/// Get history count
#[tauri::command]
pub async fn get_history_count() -> Result<usize, HistoryError> {
    let store = load_history().await?;
    Ok(store.entries.len())
}

// =============================================================================
// Undo Functions
// =============================================================================

/// Undo an operation by restoring files to their original locations
#[tauri::command]
pub async fn undo_operation(entry_id: String) -> Result<UndoResult, HistoryError> {
    // Load history
    let mut store = load_history().await?;

    // Find the entry
    let entry_index = store.entries
        .iter()
        .position(|e| e.id == entry_id)
        .ok_or_else(|| HistoryError::EntryNotFound(entry_id.clone()))?;

    let entry = &store.entries[entry_index];

    // Check if already undone
    if entry.undone {
        return Err(HistoryError::UndoFailed("Operation already undone".to_string()));
    }

    let mut files_restored = 0;
    let mut files_failed = 0;
    let mut errors: Vec<String> = Vec::new();

    // Restore each file
    for file in &entry.files {
        if !file.success {
            // Skip files that weren't successfully renamed
            continue;
        }

        if let Some(new_path) = &file.new_path {
            // Check if new file exists
            let new_path_obj = std::path::Path::new(new_path);
            if !new_path_obj.exists() {
                errors.push(format!("File not found: {}", new_path));
                files_failed += 1;
                continue;
            }

            // Attempt to restore
            match fs::rename(new_path, &file.original_path) {
                Ok(_) => {
                    files_restored += 1;
                }
                Err(e) => {
                    errors.push(format!("Failed to restore {}: {}", new_path, e));
                    files_failed += 1;
                }
            }
        }
    }

    // Mark entry as undone if at least some files were restored
    if files_restored > 0 {
        store.entries[entry_index].undone = true;
        store.last_modified = Utc::now().to_rfc3339();
        save_history(&store).await?;
    }

    Ok(UndoResult {
        success: files_failed == 0 && files_restored > 0,
        entry_id,
        files_restored,
        files_failed,
        errors,
    })
}

/// Check if an operation can be undone
#[tauri::command]
pub async fn can_undo_operation(entry_id: String) -> Result<bool, HistoryError> {
    let store = load_history().await?;

    let entry = store.entries
        .iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| HistoryError::EntryNotFound(entry_id))?;

    // Can undo if not already undone and has successful file operations
    Ok(!entry.undone && entry.files.iter().any(|f| f.success && f.new_path.is_some()))
}

/// Clear all history
#[tauri::command]
pub async fn clear_history() -> Result<(), HistoryError> {
    let store = HistoryStore::default();
    save_history(&store).await
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::rename::BatchRenameSummary;

    fn create_test_result() -> BatchRenameResult {
        BatchRenameResult {
            success: true,
            results: vec![
                FileRenameResult {
                    proposal_id: "test-1".to_string(),
                    original_path: "/tmp/test1.jpg".to_string(),
                    original_name: "test1.jpg".to_string(),
                    new_path: Some("/tmp/renamed1.jpg".to_string()),
                    new_name: Some("renamed1.jpg".to_string()),
                    outcome: RenameOutcome::Success,
                    error: None,
                },
            ],
            summary: BatchRenameSummary {
                total: 1,
                succeeded: 1,
                failed: 0,
                skipped: 0,
            },
            started_at: Utc::now(),
            completed_at: Utc::now(),
            duration_ms: 100,
        }
    }

    #[test]
    fn test_create_entry_from_result() {
        let result = create_test_result();
        let entry = create_entry_from_result(&result);

        assert!(!entry.id.is_empty());
        assert_eq!(entry.file_count, 1);
        assert_eq!(entry.summary.succeeded, 1);
        assert!(!entry.undone);
    }

    #[test]
    fn test_determine_operation_type() {
        let results = vec![
            FileRenameResult {
                proposal_id: "test-1".to_string(),
                original_path: "/tmp/test1.jpg".to_string(),
                original_name: "test1.jpg".to_string(),
                new_path: Some("/tmp/renamed1.jpg".to_string()),
                new_name: Some("renamed1.jpg".to_string()),
                outcome: RenameOutcome::Success,
                error: None,
            },
        ];

        let op_type = determine_operation_type(&results);
        assert_eq!(op_type, OperationType::Rename);
    }
}
