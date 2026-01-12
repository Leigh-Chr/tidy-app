use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use thiserror::Error;
use uuid::Uuid;
use walkdir::WalkDir;

/// Error types for scan operations
#[derive(Debug, Error)]
pub enum ScanError {
    #[error("Path does not exist: {0}")]
    PathNotFound(String),
    #[error("Not a directory: {0}")]
    NotADirectory(String),
    #[error("Failed to scan: {0}")]
    IoError(#[from] std::io::Error),
}

impl Serialize for ScanError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// File category based on extension
#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum FileCategory {
    Image,
    Document,
    Video,
    Audio,
    Archive,
    Code,
    Data,
    Other,
}

/// Metadata capability level
#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MetadataCapability {
    None,
    Basic,
    Extended,
    Full,
}

/// Information about a scanned file
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    /// Full absolute path to the file
    pub path: String,
    /// Filename without extension
    pub name: String,
    /// File extension (without dot)
    pub extension: String,
    /// Full filename with extension
    pub full_name: String,
    /// File size in bytes
    pub size: u64,
    /// File creation timestamp
    pub created_at: DateTime<Utc>,
    /// File modification timestamp
    pub modified_at: DateTime<Utc>,
    /// Path relative to scan root
    pub relative_path: String,
    /// File category based on extension
    pub category: FileCategory,
    /// Whether metadata extraction is supported
    pub metadata_supported: bool,
    /// Level of metadata capability
    pub metadata_capability: MetadataCapability,
}

/// Options for folder scanning
#[derive(Debug, Clone, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    /// Scan subdirectories recursively (default: false)
    #[serde(default)]
    pub recursive: bool,
    /// Filter by file extensions (without dot, e.g., ["jpg", "png"])
    #[serde(default)]
    pub extensions: Option<Vec<String>>,
}

/// Result of a folder scan
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    /// List of scanned files
    pub files: Vec<FileInfo>,
    /// Total number of files found
    pub total_count: usize,
    /// Total size in bytes
    pub total_size: u64,
    /// Scan session ID (for tracking/cancellation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// Whether the scan was cancelled
    #[serde(default)]
    pub cancelled: bool,
}

// =============================================================================
// Progress Reporting Types
// =============================================================================

/// Progress event payload for scan operations
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    /// Scan session ID
    pub session_id: String,
    /// Current file being processed
    pub current_file: String,
    /// Number of files discovered so far
    pub discovered: usize,
    /// Number of files processed (after filtering)
    pub processed: usize,
    /// Current phase of scanning
    pub phase: ScanPhase,
    /// Whether scan is complete
    pub complete: bool,
    /// Error message if any
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Phases of scanning operation
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ScanPhase {
    /// Initial phase - preparing to scan
    Starting,
    /// Walking directory tree
    Discovering,
    /// Processing discovered files
    Processing,
    /// Scan complete
    Complete,
    /// Scan was cancelled
    Cancelled,
}

// =============================================================================
// Cancellation Support
// =============================================================================

/// A cancellation token for async operations
#[derive(Clone)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self::new()
    }
}

/// State for managing active scan sessions
pub struct ScanState {
    /// Active scan sessions with their cancellation tokens
    sessions: Mutex<HashMap<String, CancellationToken>>,
}

impl ScanState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Create a new scan session and return its ID
    pub fn create_session(&self) -> (String, CancellationToken) {
        let session_id = Uuid::new_v4().to_string();
        let token = CancellationToken::new();

        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), token.clone());

        (session_id, token)
    }

    /// Cancel a scan session by ID
    pub fn cancel_session(&self, session_id: &str) -> bool {
        let sessions = self.sessions.lock().unwrap();
        if let Some(token) = sessions.get(session_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    /// Remove a completed session
    pub fn remove_session(&self, session_id: &str) {
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(session_id);
    }

    /// Get active session count
    pub fn active_count(&self) -> usize {
        self.sessions.lock().unwrap().len()
    }
}

impl Default for ScanState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get category for a file extension
fn get_category_for_extension(ext: &str) -> FileCategory {
    let ext_lower = ext.to_lowercase();
    match ext_lower.as_str() {
        // Images
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" | "tiff" | "tif"
        | "heic" | "heif" | "raw" | "cr2" | "nef" | "arw" | "dng" => FileCategory::Image,
        // Documents
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp"
        | "txt" | "rtf" | "md" | "csv" => FileCategory::Document,
        // Video
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpeg" | "mpg" => {
            FileCategory::Video
        }
        // Audio
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "opus" => FileCategory::Audio,
        // Archives
        "zip" | "tar" | "gz" | "bz2" | "xz" | "7z" | "rar" | "iso" => FileCategory::Archive,
        // Code
        "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "go" | "java" | "c" | "cpp" | "h" | "hpp"
        | "cs" | "rb" | "php" | "swift" | "kt" | "scala" | "html" | "css" | "scss" | "less"
        | "json" | "yaml" | "yml" | "xml" | "toml" | "sql" | "sh" | "bash" | "ps1" => {
            FileCategory::Code
        }
        // Data
        "db" | "sqlite" | "mdb" | "accdb" => FileCategory::Data,
        // Other
        _ => FileCategory::Other,
    }
}

/// Get metadata capability for a file extension
fn get_metadata_capability(ext: &str) -> MetadataCapability {
    let ext_lower = ext.to_lowercase();
    match ext_lower.as_str() {
        // Full metadata support (EXIF)
        "jpg" | "jpeg" | "tiff" | "tif" | "heic" | "heif" => MetadataCapability::Full,
        // Extended metadata (some EXIF fields)
        "png" | "webp" | "gif" => MetadataCapability::Extended,
        // Basic metadata (PDF, Office)
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" => MetadataCapability::Basic,
        // No special metadata
        _ => MetadataCapability::None,
    }
}

/// Check if metadata extraction is supported
fn is_metadata_supported(ext: &str) -> bool {
    !matches!(get_metadata_capability(ext), MetadataCapability::None)
}

/// Internal scan implementation with optional progress reporting and cancellation
fn scan_folder_internal(
    path: &str,
    options: &ScanOptions,
    cancel_token: Option<&CancellationToken>,
    progress_callback: Option<&dyn Fn(usize, &str)>,
) -> Result<(Vec<FileInfo>, u64, bool), ScanError> {
    let folder_path = Path::new(path);

    // Validate path exists
    if !folder_path.exists() {
        return Err(ScanError::PathNotFound(path.to_string()));
    }

    // Validate it's a directory
    if !folder_path.is_dir() {
        return Err(ScanError::NotADirectory(path.to_string()));
    }

    let mut files = Vec::new();
    let mut total_size: u64 = 0;
    let mut discovered: usize = 0;

    // Configure walkdir based on recursive option
    let walker = if options.recursive {
        WalkDir::new(path)
    } else {
        WalkDir::new(path).max_depth(1)
    };

    // Normalize extensions to lowercase for comparison
    let extensions: Option<Vec<String>> = options
        .extensions
        .as_ref()
        .map(|exts| exts.iter().map(|e| e.to_lowercase()).collect());

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        // Check for cancellation
        if let Some(token) = cancel_token {
            if token.is_cancelled() {
                return Ok((files, total_size, true)); // true = cancelled
            }
        }

        let entry_path = entry.path();

        // Skip directories
        if entry_path.is_dir() {
            continue;
        }

        discovered += 1;

        // Report progress every 10 files or for the first file
        if let Some(callback) = progress_callback {
            if discovered == 1 || discovered % 10 == 0 {
                let file_name = entry_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                callback(discovered, file_name);
            }
        }

        // Get file metadata
        let metadata = match entry_path.metadata() {
            Ok(m) => m,
            Err(e) => {
                // Skip files we can't read metadata for
                eprintln!("Warning: Could not read metadata for {:?}: {}", entry_path, e);
                continue;
            }
        };

        // Extract file info
        let file_name = entry_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let extension = entry_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();

        // Filter by extension if specified
        if let Some(ref exts) = extensions {
            if !exts.is_empty() && !exts.contains(&extension.to_lowercase()) {
                continue;
            }
        }

        let name = entry_path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let relative_path = entry_path
            .strip_prefix(path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_name.clone());

        let size = metadata.len();
        total_size += size;

        // Get timestamps
        let created_at = metadata
            .created()
            .map(|t| DateTime::<Utc>::from(t))
            .unwrap_or_else(|_| Utc::now());

        let modified_at = metadata
            .modified()
            .map(|t| DateTime::<Utc>::from(t))
            .unwrap_or_else(|_| Utc::now());

        let category = get_category_for_extension(&extension);
        let metadata_capability = get_metadata_capability(&extension);
        let metadata_supported = is_metadata_supported(&extension);

        files.push(FileInfo {
            path: entry_path.to_string_lossy().to_string(),
            name,
            extension,
            full_name: file_name,
            size,
            created_at,
            modified_at,
            relative_path,
            category,
            metadata_supported,
            metadata_capability,
        });
    }

    Ok((files, total_size, false)) // false = not cancelled
}

/// Scan a folder and return information about all files within it
///
/// Command name: scan_folder (snake_case per architecture)
#[tauri::command]
pub async fn scan_folder(
    path: String,
    options: Option<ScanOptions>,
) -> Result<ScanResult, ScanError> {
    let options = options.unwrap_or_default();
    let (files, total_size, cancelled) = scan_folder_internal(&path, &options, None, None)?;
    let total_count = files.len();

    Ok(ScanResult {
        files,
        total_count,
        total_size,
        session_id: None,
        cancelled,
    })
}

/// Scan a folder with progress reporting and cancellation support
///
/// Emits "scan-progress" events to the window during the scan
/// Returns a session_id that can be used to cancel the scan
///
/// Command name: scan_folder_with_progress (snake_case per architecture)
#[tauri::command]
pub async fn scan_folder_with_progress(
    window: tauri::Window,
    scan_state: tauri::State<'_, ScanState>,
    path: String,
    options: Option<ScanOptions>,
) -> Result<ScanResult, ScanError> {
    let options = options.unwrap_or_default();

    // Create a scan session
    let (session_id, cancel_token) = scan_state.create_session();

    // Emit starting progress
    let _ = window.emit("scan-progress", ScanProgress {
        session_id: session_id.clone(),
        current_file: String::new(),
        discovered: 0,
        processed: 0,
        phase: ScanPhase::Starting,
        complete: false,
        error: None,
    });

    // Create a channel for progress updates
    let window_clone = window.clone();
    let session_id_clone = session_id.clone();

    // Run the scan with progress callback
    let progress_callback = |discovered: usize, current_file: &str| {
        let _ = window_clone.emit("scan-progress", ScanProgress {
            session_id: session_id_clone.clone(),
            current_file: current_file.to_string(),
            discovered,
            processed: 0, // Will be updated at the end
            phase: ScanPhase::Discovering,
            complete: false,
            error: None,
        });
    };

    let result = scan_folder_internal(&path, &options, Some(&cancel_token), Some(&progress_callback));

    // Clean up session
    scan_state.remove_session(&session_id);

    match result {
        Ok((files, total_size, cancelled)) => {
            let total_count = files.len();

            // Emit completion progress
            let _ = window.emit("scan-progress", ScanProgress {
                session_id: session_id.clone(),
                current_file: String::new(),
                discovered: total_count,
                processed: total_count,
                phase: if cancelled { ScanPhase::Cancelled } else { ScanPhase::Complete },
                complete: true,
                error: None,
            });

            Ok(ScanResult {
                files,
                total_count,
                total_size,
                session_id: Some(session_id),
                cancelled,
            })
        }
        Err(e) => {
            // Emit error progress
            let _ = window.emit("scan-progress", ScanProgress {
                session_id: session_id.clone(),
                current_file: String::new(),
                discovered: 0,
                processed: 0,
                phase: ScanPhase::Complete,
                complete: true,
                error: Some(e.to_string()),
            });

            Err(e)
        }
    }
}

/// Cancel an active scan session
///
/// Command name: cancel_scan (snake_case per architecture)
#[tauri::command]
pub async fn cancel_scan(
    scan_state: tauri::State<'_, ScanState>,
    session_id: String,
) -> Result<bool, String> {
    Ok(scan_state.cancel_session(&session_id))
}

/// Get the number of active scan sessions
///
/// Command name: get_active_scans (snake_case per architecture)
#[tauri::command]
pub async fn get_active_scans(
    scan_state: tauri::State<'_, ScanState>,
) -> Result<usize, String> {
    Ok(scan_state.active_count())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_files(dir: &TempDir) -> std::io::Result<()> {
        // Create some test files
        let mut f = File::create(dir.path().join("test.jpg"))?;
        f.write_all(b"fake jpg")?;

        let mut f = File::create(dir.path().join("document.pdf"))?;
        f.write_all(b"fake pdf")?;

        let mut f = File::create(dir.path().join("code.rs"))?;
        f.write_all(b"fn main() {}")?;

        // Create a subdirectory with files
        fs::create_dir(dir.path().join("subdir"))?;
        let mut f = File::create(dir.path().join("subdir").join("nested.txt"))?;
        f.write_all(b"nested file")?;

        Ok(())
    }

    #[tokio::test]
    async fn test_scan_folder_basic() {
        let dir = TempDir::new().unwrap();
        create_test_files(&dir).unwrap();

        let result = scan_folder(dir.path().to_string_lossy().to_string(), None)
            .await
            .unwrap();

        // Non-recursive should find 3 files (not the nested one)
        assert_eq!(result.total_count, 3);
    }

    #[tokio::test]
    async fn test_scan_folder_recursive() {
        let dir = TempDir::new().unwrap();
        create_test_files(&dir).unwrap();

        let result = scan_folder(
            dir.path().to_string_lossy().to_string(),
            Some(ScanOptions {
                recursive: true,
                extensions: None,
            }),
        )
        .await
        .unwrap();

        // Recursive should find 4 files
        assert_eq!(result.total_count, 4);
    }

    #[tokio::test]
    async fn test_scan_folder_extension_filter() {
        let dir = TempDir::new().unwrap();
        create_test_files(&dir).unwrap();

        let result = scan_folder(
            dir.path().to_string_lossy().to_string(),
            Some(ScanOptions {
                recursive: false,
                extensions: Some(vec!["jpg".to_string()]),
            }),
        )
        .await
        .unwrap();

        assert_eq!(result.total_count, 1);
        assert_eq!(result.files[0].extension, "jpg");
    }

    #[tokio::test]
    async fn test_scan_folder_path_not_found() {
        let result = scan_folder("/nonexistent/path/12345".to_string(), None).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_get_category_for_extension() {
        assert_eq!(get_category_for_extension("jpg"), FileCategory::Image);
        assert_eq!(get_category_for_extension("PDF"), FileCategory::Document);
        assert_eq!(get_category_for_extension("rs"), FileCategory::Code);
        assert_eq!(get_category_for_extension("xyz"), FileCategory::Other);
    }

    // =============================================================================
    // Cancellation Tests
    // =============================================================================

    #[test]
    fn test_cancellation_token_default() {
        let token = CancellationToken::new();
        assert!(!token.is_cancelled());
    }

    #[test]
    fn test_cancellation_token_cancel() {
        let token = CancellationToken::new();
        assert!(!token.is_cancelled());

        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn test_cancellation_token_clone() {
        let token = CancellationToken::new();
        let token_clone = token.clone();

        // Cancel original
        token.cancel();

        // Clone should also be cancelled (shared atomic)
        assert!(token_clone.is_cancelled());
    }

    #[test]
    fn test_scan_state_create_session() {
        let state = ScanState::new();
        assert_eq!(state.active_count(), 0);

        let (session_id, _token) = state.create_session();
        assert!(!session_id.is_empty());
        assert_eq!(state.active_count(), 1);
    }

    #[test]
    fn test_scan_state_cancel_session() {
        let state = ScanState::new();
        let (session_id, token) = state.create_session();

        assert!(!token.is_cancelled());

        let cancelled = state.cancel_session(&session_id);
        assert!(cancelled);
        assert!(token.is_cancelled());
    }

    #[test]
    fn test_scan_state_cancel_nonexistent_session() {
        let state = ScanState::new();
        let cancelled = state.cancel_session("nonexistent-id");
        assert!(!cancelled);
    }

    #[test]
    fn test_scan_state_remove_session() {
        let state = ScanState::new();
        let (session_id, _token) = state.create_session();
        assert_eq!(state.active_count(), 1);

        state.remove_session(&session_id);
        assert_eq!(state.active_count(), 0);
    }

    #[test]
    fn test_scan_internal_with_cancellation() {
        let dir = TempDir::new().unwrap();
        create_test_files(&dir).unwrap();

        // Test without cancellation
        let token = CancellationToken::new();
        let (files, _size, cancelled) = scan_folder_internal(
            &dir.path().to_string_lossy(),
            &ScanOptions::default(),
            Some(&token),
            None,
        ).unwrap();

        assert!(!cancelled);
        assert_eq!(files.len(), 3);
    }

    #[test]
    fn test_scan_internal_cancelled() {
        let dir = TempDir::new().unwrap();
        create_test_files(&dir).unwrap();

        // Test with pre-cancelled token
        let token = CancellationToken::new();
        token.cancel();

        let (files, _size, cancelled) = scan_folder_internal(
            &dir.path().to_string_lossy(),
            &ScanOptions::default(),
            Some(&token),
            None,
        ).unwrap();

        assert!(cancelled);
        assert_eq!(files.len(), 0); // Should be empty since cancelled immediately
    }

    #[test]
    fn test_scan_result_has_cancelled_field() {
        let dir = TempDir::new().unwrap();
        create_test_files(&dir).unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(scan_folder(
            dir.path().to_string_lossy().to_string(),
            None,
        )).unwrap();

        assert!(!result.cancelled);
        assert!(result.session_id.is_none()); // Basic scan_folder doesn't have session
    }
}
