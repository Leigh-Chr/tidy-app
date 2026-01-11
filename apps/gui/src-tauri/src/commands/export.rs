// Export functionality for tidy-app GUI
// Command names use snake_case per architecture requirements
//
// Provides export of scan results and rename previews to JSON files.

use serde::{Deserialize, Serialize};
use std::fs;
use thiserror::Error;

use crate::commands::rename::{PreviewSummary, RenamePreview, RenameProposal};
use crate::commands::scanner::{FileCategory, FileInfo};

// =============================================================================
// Error Types
// =============================================================================

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("Failed to write export: {0}")]
    WriteError(String),
    #[error("Failed to serialize export data: {0}")]
    SerializeError(String),
    #[error("Export cancelled by user")]
    Cancelled,
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Serialize for ExportError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// =============================================================================
// Export Types (matching CLI JSON output)
// =============================================================================

/// Statistics about scanned files
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportStatistics {
    pub total: u32,
    pub by_category: std::collections::HashMap<FileCategory, u32>,
    pub total_size: u64,
}

/// Scan result section of export
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportScanResult {
    pub folder: String,
    pub files: Vec<FileInfo>,
    pub statistics: ExportStatistics,
    pub scanned_at: String,
}

/// Preview section of export
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreview {
    pub proposals: Vec<RenameProposal>,
    pub summary: PreviewSummary,
    pub template_used: String,
}

/// Complete export data structure (matches CLI --format json)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportData {
    pub scan_result: ExportScanResult,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<ExportPreview>,
    pub exported_at: String,
    pub version: String,
}

/// Input for export command
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportInput {
    pub folder: String,
    pub files: Vec<FileInfo>,
    pub preview: Option<RenamePreview>,
}

/// Result of save dialog
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// Path where file was saved
    pub path: String,
    /// Size of exported file in bytes
    pub size: u64,
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Compute statistics from files
fn compute_statistics(files: &[FileInfo]) -> ExportStatistics {
    let mut by_category: std::collections::HashMap<FileCategory, u32> =
        std::collections::HashMap::new();
    let mut total_size: u64 = 0;

    for file in files {
        *by_category.entry(file.category.clone()).or_insert(0) += 1;
        total_size += file.size;
    }

    ExportStatistics {
        total: files.len() as u32,
        by_category,
        total_size,
    }
}

/// Get current timestamp as ISO string
fn current_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Export scan results and preview to a JSON file
///
/// Opens native file save dialog and writes export data.
/// Matches CLI --format json output structure.
///
/// Command name: export_results (snake_case per architecture)
#[tauri::command]
pub async fn export_results(
    app_handle: tauri::AppHandle,
    input: ExportInput,
) -> Result<ExportResult, ExportError> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    // Build export data
    let export_data = ExportData {
        scan_result: ExportScanResult {
            folder: input.folder.clone(),
            files: input.files.clone(),
            statistics: compute_statistics(&input.files),
            scanned_at: current_timestamp(),
        },
        preview: input.preview.map(|p| ExportPreview {
            proposals: p.proposals,
            summary: p.summary,
            template_used: p.template_used,
        }),
        exported_at: current_timestamp(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };

    // Serialize to pretty JSON
    let json_content = serde_json::to_string_pretty(&export_data)
        .map_err(|e| ExportError::SerializeError(e.to_string()))?;

    // Generate default filename
    let default_filename = format!(
        "tidy-export-{}.json",
        chrono::Utc::now().format("%Y%m%d-%H%M%S")
    );

    // Use async oneshot channel to avoid blocking async runtime
    let (tx, rx) = oneshot::channel();

    // Open save dialog with callback
    app_handle
        .dialog()
        .file()
        .set_file_name(&default_filename)
        .add_filter("JSON", &["json"])
        .add_filter("All Files", &["*"])
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    // Await dialog result asynchronously
    let file_path = rx.await.map_err(|_| ExportError::Cancelled)?;

    // Handle dialog result
    let path = match file_path {
        Some(p) => p.into_path().map_err(|e| {
            ExportError::WriteError(e.to_string())
        })?,
        None => return Err(ExportError::Cancelled),
    };

    // Write to file
    fs::write(&path, &json_content).map_err(|e| {
        ExportError::WriteError(format!("Failed to write {}: {}", path.display(), e))
    })?;

    // Get file size
    let metadata = fs::metadata(&path).map_err(|e| {
        ExportError::WriteError(format!("Failed to read metadata: {}", e))
    })?;

    Ok(ExportResult {
        path: path.to_string_lossy().to_string(),
        size: metadata.len(),
    })
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::scanner::MetadataCapability;
    use chrono::Utc;

    fn mock_file(name: &str, category: FileCategory, size: u64) -> FileInfo {
        FileInfo {
            path: format!("/test/{}", name),
            name: name.split('.').next().unwrap().to_string(),
            extension: name.split('.').last().unwrap().to_string(),
            full_name: name.to_string(),
            size,
            created_at: Utc::now(),
            modified_at: Utc::now(),
            relative_path: name.to_string(),
            category,
            metadata_supported: true,
            metadata_capability: MetadataCapability::Full,
        }
    }

    #[test]
    fn test_compute_statistics() {
        let files = vec![
            mock_file("image1.jpg", FileCategory::Image, 1000),
            mock_file("image2.png", FileCategory::Image, 2000),
            mock_file("doc.pdf", FileCategory::Document, 5000),
        ];

        let stats = compute_statistics(&files);

        assert_eq!(stats.total, 3);
        assert_eq!(stats.total_size, 8000);
        assert_eq!(stats.by_category.get(&FileCategory::Image), Some(&2));
        assert_eq!(stats.by_category.get(&FileCategory::Document), Some(&1));
    }

    #[test]
    fn test_export_data_serialization() {
        let files = vec![mock_file("test.jpg", FileCategory::Image, 1000)];
        let stats = compute_statistics(&files);

        let export_data = ExportData {
            scan_result: ExportScanResult {
                folder: "/test/folder".to_string(),
                files: files.clone(),
                statistics: stats,
                scanned_at: "2026-01-01T12:00:00Z".to_string(),
            },
            preview: None,
            exported_at: "2026-01-01T12:00:00Z".to_string(),
            version: "0.2.0".to_string(),
        };

        let json = serde_json::to_string(&export_data).unwrap();

        // Verify camelCase field names
        assert!(json.contains("\"scanResult\":"));
        assert!(json.contains("\"exportedAt\":"));
        assert!(json.contains("\"totalSize\":"));
        assert!(json.contains("\"byCategory\":"));
    }

    #[test]
    fn test_export_error_serialization() {
        let error = ExportError::Cancelled;
        let json = serde_json::to_string(&error).unwrap();
        assert_eq!(json, "\"Export cancelled by user\"");
    }
}
