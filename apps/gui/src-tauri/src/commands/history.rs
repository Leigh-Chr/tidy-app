// History module for operation history - Story 9.1
// Enables undo functionality and operation review
//
// Command names use snake_case per architecture requirements

use chrono::Utc;
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
use thiserror::Error;
use ts_rs::TS;
use uuid::Uuid;

use super::error::{ErrorCategory, ErrorResponse};
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
    #[error("Failed to acquire lock: {0}")]
    LockFailed(String),
}

impl HistoryError {
    /// Convert to structured error response for frontend
    pub fn to_error_response(&self) -> ErrorResponse {
        match self {
            HistoryError::LoadFailed(msg) => ErrorResponse::new(
                "HISTORY_LOAD_FAILED",
                format!("Failed to load history: {}", msg),
                ErrorCategory::Config,
            )
            .with_suggestion("History may be corrupted. Try clearing history or check disk space."),

            HistoryError::SaveFailed(msg) => ErrorResponse::new(
                "HISTORY_SAVE_FAILED",
                format!("Failed to save history: {}", msg),
                ErrorCategory::Config,
            )
            .with_suggestion("Check write permissions in the configuration directory."),

            HistoryError::EntryNotFound(id) => ErrorResponse::new(
                "ENTRY_NOT_FOUND",
                format!("History entry not found: {}", id),
                ErrorCategory::Internal,
            ),

            HistoryError::UndoFailed(msg) => ErrorResponse::new(
                "UNDO_FAILED",
                format!("Failed to undo operation: {}", msg),
                ErrorCategory::Filesystem,
            )
            .with_suggestion("Some files may have been moved or deleted since the operation."),

            HistoryError::IoError(e) => ErrorResponse::new(
                "IO_ERROR",
                format!("IO error: {}", e),
                ErrorCategory::Filesystem,
            )
            .with_suggestion("Check file permissions and ensure the disk is accessible."),

            HistoryError::LockFailed(msg) => ErrorResponse::new(
                "LOCK_FAILED",
                format!("Failed to acquire lock: {}", msg),
                ErrorCategory::Internal,
            )
            .with_suggestion("Another operation may be in progress. Please try again."),
        }
    }
}

// Use macro for Serialize implementation (QUAL-001)
crate::impl_serialize_via_error_response!(HistoryError);

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

/// Maximum number of history entries to retain (MEM-P2-002)
/// Older entries are automatically pruned when this limit is exceeded
const MAX_HISTORY_ENTRIES: usize = 500;

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
// Storage Functions (with file locking to prevent race conditions)
// =============================================================================

/// Load history from disk (for read-only queries)
/// Uses shared lock to allow concurrent reads
#[tauri::command]
pub async fn load_history() -> Result<HistoryStore, HistoryError> {
    let path = get_history_path()?;

    if !path.exists() {
        return Ok(HistoryStore::default());
    }

    // Open file and acquire shared lock for reading
    let file = File::open(&path)?;
    file.lock_shared()
        .map_err(|e| HistoryError::LockFailed(format!("Shared lock: {}", e)))?;

    // Read contents while holding lock
    let mut contents = String::new();
    let mut reader = std::io::BufReader::new(&file);
    reader.read_to_string(&mut contents)?;

    // Lock is released when file is dropped
    let store: HistoryStore = serde_json::from_str(&contents)
        .map_err(|e| HistoryError::LoadFailed(e.to_string()))?;

    Ok(store)
}

/// Save history to disk (internal, requires exclusive access)
fn save_history_internal(store: &HistoryStore, file: &mut File) -> Result<(), HistoryError> {
    let contents = serde_json::to_string_pretty(store)
        .map_err(|e| HistoryError::SaveFailed(e.to_string()))?;

    // Truncate file and write new contents
    file.set_len(0)?;
    file.write_all(contents.as_bytes())?;
    file.sync_all()?; // Ensure data is flushed to disk

    Ok(())
}

/// Perform an atomic read-modify-write operation on the history store.
/// This function acquires an exclusive lock, reads the current state,
/// applies the modification function, and saves the result.
///
/// This prevents race conditions when multiple operations try to modify
/// the history concurrently.
fn with_locked_history<F, T>(modify_fn: F) -> Result<T, HistoryError>
where
    F: FnOnce(&mut HistoryStore) -> Result<T, HistoryError>,
{
    let path = get_history_path()?;

    // Open or create the file with read+write access
    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(&path)?;

    // Acquire exclusive lock for read-modify-write
    file.lock_exclusive()
        .map_err(|e| HistoryError::LockFailed(format!("Exclusive lock: {}", e)))?;

    // Read current contents
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;

    // Parse existing store or create default
    let mut store: HistoryStore = if contents.is_empty() {
        HistoryStore::default()
    } else {
        serde_json::from_str(&contents)
            .map_err(|e| HistoryError::LoadFailed(e.to_string()))?
    };

    // Apply the modification
    let result = modify_fn(&mut store)?;

    // Update last_modified timestamp
    store.last_modified = Utc::now().to_rfc3339();

    // Seek to beginning before writing
    use std::io::Seek;
    file.seek(std::io::SeekFrom::Start(0))?;

    // Save updated store
    save_history_internal(&store, &mut file)?;

    // Lock is released when file is dropped
    Ok(result)
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
/// Uses file locking to prevent race conditions with concurrent operations
/// Automatically prunes old entries when MAX_HISTORY_ENTRIES is exceeded (MEM-P2-002)
#[tauri::command]
pub async fn record_operation(
    result: BatchRenameResult,
) -> Result<OperationHistoryEntry, HistoryError> {
    // Create new entry before acquiring lock
    let entry = create_entry_from_result(&result);
    let entry_clone = entry.clone();

    // Use atomic read-modify-write with file locking
    with_locked_history(move |store| {
        // Prepend to entries (newest first)
        store.entries.insert(0, entry_clone);

        // MEM-P2-002: Prune old entries if we exceed the limit
        if store.entries.len() > MAX_HISTORY_ENTRIES {
            store.entries.truncate(MAX_HISTORY_ENTRIES);
        }

        Ok(())
    })?;

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
/// Uses file locking to prevent race conditions during the undone flag update
#[tauri::command]
pub async fn undo_operation(entry_id: String) -> Result<UndoResult, HistoryError> {
    // Step 1: Load history and get entry info (with shared lock, released quickly)
    let store = load_history().await?;

    // Find the entry
    let entry = store.entries
        .iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| HistoryError::EntryNotFound(entry_id.clone()))?;

    // Check if already undone
    if entry.undone {
        return Err(HistoryError::UndoFailed("Operation already undone".to_string()));
    }

    // Clone file info so we can release the lock before file operations
    let files_to_restore: Vec<_> = entry.files.clone();

    // Step 2: Perform file operations (no lock held - potentially slow I/O)
    let mut files_restored = 0;
    let mut files_failed = 0;
    let mut errors: Vec<String> = Vec::new();

    for file in &files_to_restore {
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

    // Step 3: Atomically mark entry as undone if at least some files were restored
    if files_restored > 0 {
        let entry_id_for_update = entry_id.clone();
        with_locked_history(move |store| {
            // Re-find the entry (store may have changed while we were doing file I/O)
            if let Some(entry) = store.entries.iter_mut().find(|e| e.id == entry_id_for_update) {
                entry.undone = true;
            }
            Ok(())
        })?;
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
/// Uses file locking to prevent race conditions
#[tauri::command]
pub async fn clear_history() -> Result<(), HistoryError> {
    with_locked_history(|store| {
        store.entries.clear();
        store.version = "1.0".to_string();
        Ok(())
    })
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
