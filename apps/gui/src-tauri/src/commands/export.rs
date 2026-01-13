// Export functionality for tidy-app GUI
// Command names use snake_case per architecture requirements
//
// Provides export of scan results and rename previews to JSON and CSV files.

use serde::{Deserialize, Serialize};
use std::fs;
use thiserror::Error;
use ts_rs::TS;

use crate::commands::rename::{PreviewSummary, RenamePreview, RenameProposal};
use crate::commands::scanner::{FileCategory, FileInfo};

// =============================================================================
// Export Format Types
// =============================================================================

/// Supported export file formats (FEAT-003)
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    /// JSON format (default) - full structured data
    #[default]
    Json,
    /// CSV format - tabular data for spreadsheets
    Csv,
}

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

// Use macro for Serialize implementation (QUAL-001)
crate::impl_serialize_as_string!(ExportError);

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
    /// Export format (default: JSON)
    #[serde(default)]
    pub format: ExportFormat,
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

/// Escape a field for CSV (double quotes and wrap if needed)
fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

/// Generate CSV content for files (FEAT-003)
fn generate_files_csv(files: &[FileInfo]) -> String {
    let mut csv = String::new();

    // Header
    csv.push_str("Path,Name,Extension,Size (bytes),Category,Created,Modified\n");

    // Data rows
    for file in files {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            csv_escape(&file.path),
            csv_escape(&file.full_name),
            csv_escape(&file.extension),
            file.size,
            csv_escape(&format!("{:?}", file.category)),
            csv_escape(&file.created_at.to_rfc3339()),
            csv_escape(&file.modified_at.to_rfc3339()),
        ));
    }

    csv
}

/// Generate CSV content for rename preview (FEAT-003)
fn generate_preview_csv(preview: &RenamePreview) -> String {
    let mut csv = String::new();

    // Header
    csv.push_str("Original Path,Original Name,New Name,New Path,Status,Folder Move\n");

    // Data rows
    for proposal in &preview.proposals {
        csv.push_str(&format!(
            "{},{},{},{},{},{}\n",
            csv_escape(&proposal.original_path),
            csv_escape(&proposal.original_name),
            csv_escape(&proposal.proposed_name),
            csv_escape(&proposal.proposed_path),
            csv_escape(&format!("{:?}", proposal.status)),
            proposal.is_folder_move,
        ));
    }

    csv
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Export scan results and preview to a file (JSON or CSV)
///
/// Opens native file save dialog and writes export data.
/// Supports JSON (full structured data) and CSV (tabular) formats.
///
/// Command name: export_results (snake_case per architecture)
#[tauri::command]
pub async fn export_results(
    app_handle: tauri::AppHandle,
    input: ExportInput,
) -> Result<ExportResult, ExportError> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    // Generate content based on format
    let (content, default_filename, file_filter) = match input.format {
        ExportFormat::Json => {
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

            let json_content = serde_json::to_string_pretty(&export_data)
                .map_err(|e| ExportError::SerializeError(e.to_string()))?;

            let filename = format!(
                "tidy-export-{}.json",
                chrono::Utc::now().format("%Y%m%d-%H%M%S")
            );

            (json_content, filename, ("JSON", vec!["json"]))
        }
        ExportFormat::Csv => {
            // Generate CSV based on whether preview exists
            let csv_content = if let Some(ref preview) = input.preview {
                generate_preview_csv(preview)
            } else {
                generate_files_csv(&input.files)
            };

            let filename = format!(
                "tidy-export-{}.csv",
                chrono::Utc::now().format("%Y%m%d-%H%M%S")
            );

            (csv_content, filename, ("CSV", vec!["csv"]))
        }
    };

    // Use async oneshot channel to avoid blocking async runtime
    let (tx, rx) = oneshot::channel();

    // Open save dialog with callback
    app_handle
        .dialog()
        .file()
        .set_file_name(&default_filename)
        .add_filter(file_filter.0, &file_filter.1)
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
    fs::write(&path, &content).map_err(|e| {
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

    #[test]
    fn test_csv_escape() {
        // Normal string - no escaping
        assert_eq!(csv_escape("hello"), "hello");

        // String with comma - quoted
        assert_eq!(csv_escape("hello,world"), "\"hello,world\"");

        // String with quotes - escaped and quoted
        assert_eq!(csv_escape("say \"hello\""), "\"say \"\"hello\"\"\"");

        // String with newline - quoted
        assert_eq!(csv_escape("line1\nline2"), "\"line1\nline2\"");
    }

    #[test]
    fn test_generate_files_csv() {
        let files = vec![
            mock_file("image1.jpg", FileCategory::Image, 1000),
            mock_file("doc.pdf", FileCategory::Document, 5000),
        ];

        let csv = generate_files_csv(&files);

        // Check header
        assert!(csv.starts_with("Path,Name,Extension,Size (bytes),Category,Created,Modified\n"));

        // Check data rows exist
        assert!(csv.contains("/test/image1.jpg"));
        assert!(csv.contains("image1.jpg"));
        assert!(csv.contains("/test/doc.pdf"));
        assert!(csv.contains("doc.pdf"));
        assert!(csv.contains("1000"));
        assert!(csv.contains("5000"));
    }

    #[test]
    fn test_export_format_default() {
        // Default should be JSON
        let format: ExportFormat = Default::default();
        matches!(format, ExportFormat::Json);
    }
}
