use chrono::{DateTime, Utc};
use serde::Serialize;
use std::path::Path;
use thiserror::Error;
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

/// Scan a folder and return information about all files within it
///
/// Command name: scan_folder (snake_case per architecture)
#[tauri::command]
pub async fn scan_folder(
    path: String,
    options: Option<ScanOptions>,
) -> Result<ScanResult, ScanError> {
    let folder_path = Path::new(&path);
    let options = options.unwrap_or_default();

    // Validate path exists
    if !folder_path.exists() {
        return Err(ScanError::PathNotFound(path));
    }

    // Validate it's a directory
    if !folder_path.is_dir() {
        return Err(ScanError::NotADirectory(path));
    }

    let mut files = Vec::new();
    let mut total_size: u64 = 0;

    // Configure walkdir based on recursive option
    let walker = if options.recursive {
        WalkDir::new(&path)
    } else {
        WalkDir::new(&path).max_depth(1)
    };

    // Normalize extensions to lowercase for comparison
    let extensions: Option<Vec<String>> = options
        .extensions
        .map(|exts| exts.iter().map(|e| e.to_lowercase()).collect());

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();

        // Skip directories
        if entry_path.is_dir() {
            continue;
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
            .strip_prefix(&path)
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

    let total_count = files.len();

    Ok(ScanResult {
        files,
        total_count,
        total_size,
    })
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
}
