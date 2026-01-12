// Rename preview and execution commands for tidy-app GUI
// Command names use snake_case per architecture requirements
//
// Story 6.4: Visual Rename Review (AC1, AC5)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use thiserror::Error;
use ts_rs::TS;
use uuid::Uuid;

use super::scanner::FileInfo;

// =============================================================================
// Error Types
// =============================================================================

#[derive(Debug, Error)]
pub enum RenameError {
    #[error("Preview generation failed: {0}")]
    PreviewFailed(String),
    #[error("Rename operation failed: {0}")]
    RenameFailed(String),
    #[error("Validation failed: {0}")]
    ValidationFailed(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Serialize for RenameError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// =============================================================================
// Rename Types (matching @tidy-app/core schema)
// =============================================================================

/// Status of a rename proposal
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum RenameStatus {
    Ready,
    Conflict,
    MissingData,
    NoChange,
    InvalidName,
}

/// Reorganization mode determines how files are handled during rename operations.
///
/// - 'rename-only': Files stay in their current locations, only names change (safest)
/// - 'organize': Files are moved to new locations based on folder patterns
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum ReorganizationMode {
    /// Files stay in place, only names change (default, safest option)
    #[default]
    RenameOnly,
    /// Files are moved to new structure based on folder pattern
    Organize,
}

/// Options for the "organize" mode.
#[derive(Debug, Clone, Deserialize, Default, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct OrganizeOptions {
    /// Base destination directory for organized files.
    #[serde(default)]
    pub destination_directory: Option<String>,

    /// Folder pattern for organizing files (e.g., "{year}/{month}").
    pub folder_pattern: String,

    /// Whether to preserve the relative context from subfolders.
    #[serde(default)]
    pub preserve_context: bool,

    /// How many levels of parent folders to preserve when preserve_context is true.
    #[serde(default = "default_context_depth")]
    pub context_depth: i32,
}

fn default_context_depth() -> i32 {
    1
}

/// Action type for a file in the preview.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum FileActionType {
    /// File will only be renamed (stays in same folder)
    Rename,
    /// File will be moved to a different folder (may also be renamed)
    Move,
    /// File will not change
    NoChange,
    /// File has a conflict
    Conflict,
    /// File has an error
    Error,
}

/// Conflict information for a file.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct FileConflict {
    /// The type of conflict
    #[serde(rename = "type")]
    #[ts(rename = "type")]
    pub conflict_type: String,
    /// Human-readable description
    pub message: String,
    /// ID of the conflicting file (for duplicate-name conflicts)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicting_file_id: Option<String>,
    /// Path of the existing file (for file-exists conflicts)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_file_path: Option<String>,
}

/// Summary of preview actions by type.
#[derive(Debug, Clone, Serialize, Deserialize, Default, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct PreviewActionSummary {
    pub rename_count: usize,
    pub move_count: usize,
    pub no_change_count: usize,
    pub conflict_count: usize,
    pub error_count: usize,
}

/// Issue found with a rename proposal
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct RenameIssue {
    /// Issue code for programmatic handling
    pub code: String,
    /// Human-readable message
    pub message: String,
    /// Field or placeholder that caused the issue (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

/// A single file rename proposal
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct RenameProposal {
    /// Unique identifier for selection tracking
    pub id: String,
    /// Full path to original file
    pub original_path: String,
    /// Original filename (with extension)
    pub original_name: String,
    /// Proposed new filename (with extension)
    pub proposed_name: String,
    /// Full path with proposed name
    pub proposed_path: String,
    /// Status of this proposal
    pub status: RenameStatus,
    /// Issues found with this proposal
    pub issues: Vec<RenameIssue>,
    /// Metadata source badges (e.g., "EXIF", "PDF", "filename")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata_sources: Option<Vec<String>>,
    /// Whether this proposal involves moving to a different folder
    #[serde(default)]
    pub is_folder_move: bool,
    /// The destination folder path (if is_folder_move is true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub destination_folder: Option<String>,
    /// Action type for this proposal (rename, move, no-change, conflict, error)
    #[serde(default = "default_action_type")]
    pub action_type: FileActionType,
    /// Conflict details if status is Conflict
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflict: Option<FileConflict>,
}

fn default_action_type() -> FileActionType {
    FileActionType::Rename
}

/// Summary statistics for a rename preview
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct PreviewSummary {
    pub total: usize,
    pub ready: usize,
    pub conflicts: usize,
    pub missing_data: usize,
    pub no_change: usize,
    pub invalid_name: usize,
}

/// Complete rename preview result
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct RenamePreview {
    /// All file proposals
    pub proposals: Vec<RenameProposal>,
    /// Summary statistics
    pub summary: PreviewSummary,
    /// When the preview was generated
    pub generated_at: DateTime<Utc>,
    /// Template pattern used
    pub template_used: String,
    /// Action summary by type (rename vs move vs no-change etc.)
    #[serde(default)]
    pub action_summary: PreviewActionSummary,
    /// The reorganization mode used for this preview
    #[serde(default)]
    pub reorganization_mode: ReorganizationMode,
}

/// Outcome of a single file rename
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "lowercase")]
pub enum RenameOutcome {
    Success,
    Failed,
    Skipped,
}

/// Result of renaming a single file
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct FileRenameResult {
    pub proposal_id: String,
    pub original_path: String,
    pub original_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_name: Option<String>,
    pub outcome: RenameOutcome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Summary of batch rename results
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct BatchRenameSummary {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
}

/// Complete result of a batch rename operation
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct BatchRenameResult {
    pub success: bool,
    pub results: Vec<FileRenameResult>,
    pub summary: BatchRenameSummary,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub duration_ms: u64,
}

// =============================================================================
// Template Types
// =============================================================================

/// Case normalization style for filenames
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "kebab-case")]
pub enum CaseStyle {
    /// No transformation - keep original casing
    #[default]
    None,
    /// all lowercase
    Lowercase,
    /// ALL UPPERCASE
    Uppercase,
    /// First letter uppercase
    Capitalize,
    /// Each Word Capitalized
    TitleCase,
    /// words-separated-by-hyphens (RECOMMENDED)
    KebabCase,
    /// words_separated_by_underscores
    SnakeCase,
    /// wordsJoinedWithCamelCase
    CamelCase,
    /// WordsJoinedWithPascalCase
    PascalCase,
}

/// Options for generating a preview
#[derive(Debug, Clone, Deserialize, Default, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct GeneratePreviewOptions {
    /// Custom date format (default: YYYY-MM-DD)
    #[serde(default)]
    pub date_format: Option<String>,
    /// Folder structure pattern for organizing files (e.g., "{year}/{month}")
    /// DEPRECATED: Use reorganization_mode and organize_options instead
    #[serde(default)]
    pub folder_pattern: Option<String>,
    /// Base directory for folder organization (destination root)
    /// DEPRECATED: Use reorganization_mode and organize_options instead
    #[serde(default)]
    pub base_directory: Option<String>,
    /// Reorganization mode: 'rename-only' or 'organize'
    /// Default: 'rename-only' (safest - files stay in place)
    #[serde(default)]
    pub reorganization_mode: ReorganizationMode,
    /// Options for organize mode (required when reorganization_mode is 'organize')
    #[serde(default)]
    pub organize_options: Option<OrganizeOptions>,
    /// Case style for filename normalization
    #[serde(default)]
    pub case_style: CaseStyle,
    /// Strip existing date/counter patterns from filename before applying template
    /// This prevents duplicate dates when re-applying templates (e.g., "2024-01-15_2024-01-15_photo")
    /// Default: false (for backward compatibility)
    #[serde(default)]
    pub strip_existing_patterns: bool,
}

/// Options for executing renames
#[derive(Debug, Clone, Deserialize, Default, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct ExecuteRenameOptions {
    /// IDs of proposals to rename (if empty, renames all ready)
    #[serde(default)]
    pub proposal_ids: Option<Vec<String>>,
}

// =============================================================================
// Template Processing
// =============================================================================

/// Characters that are invalid in filenames
const INVALID_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];

/// Reserved Windows filenames
const RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Check if a filename is valid
fn is_valid_filename(name: &str) -> bool {
    if name.is_empty() || name.len() > 255 {
        return false;
    }

    // Check for invalid characters
    if name.chars().any(|c| INVALID_CHARS.contains(&c)) {
        return false;
    }

    // Check for reserved names (Windows)
    let name_upper = name.to_uppercase();
    let base_name = name_upper.split('.').next().unwrap_or("");
    if RESERVED_NAMES.contains(&base_name) {
        return false;
    }

    // Check for trailing spaces or dots
    if name.ends_with(' ') || name.ends_with('.') {
        return false;
    }

    true
}

// =============================================================================
// Pattern Stripping (for idempotent template application)
// =============================================================================

/// Common date patterns to strip from filenames
/// These patterns are matched at the start or end of the filename, with optional separators
const DATE_PATTERNS: &[&str] = &[
    // ISO format: YYYY-MM-DD, YYYY_MM_DD
    r"^\d{4}[-_]\d{2}[-_]\d{2}[-_ ]?",
    // Compact ISO: YYYYMMDD
    r"^\d{8}[-_ ]?",
    // European format: DD-MM-YYYY, DD_MM_YYYY
    r"^\d{2}[-_]\d{2}[-_]\d{4}[-_ ]?",
    // At the end: _YYYY-MM-DD, _YYYYMMDD
    r"[-_ ]\d{4}[-_]?\d{2}[-_]?\d{2}$",
];

/// Counter patterns to strip from filenames
const COUNTER_PATTERNS: &[&str] = &[
    // At the end: _001, _002, (1), (2), -01, -02
    r"[-_ ]\d{1,4}$",
    r"\(\d{1,4}\)$",
];

/// Clean a filename by removing existing date and counter patterns
/// This makes template application idempotent (applying the same template twice gives the same result)
fn clean_filename(name: &str) -> String {
    if name.is_empty() {
        return name.to_string();
    }

    let mut result = name.to_string();

    // Remove date patterns
    for pattern in DATE_PATTERNS {
        if let Ok(re) = regex_lite::Regex::new(pattern) {
            result = re.replace(&result, "").to_string();
        }
    }

    // Remove counter patterns
    for pattern in COUNTER_PATTERNS {
        if let Ok(re) = regex_lite::Regex::new(pattern) {
            result = re.replace(&result, "").to_string();
        }
    }

    // Clean up any remaining leading/trailing separators
    result = result.trim_matches(|c| c == '-' || c == '_' || c == ' ').to_string();

    // If we stripped everything, return original
    if result.is_empty() {
        return name.to_string();
    }

    result
}

/// Maximum filename length for most filesystems
const MAX_FILENAME_LENGTH: usize = 255;

/// Information about a sanitization change
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct SanitizeChange {
    #[serde(rename = "type")]
    #[ts(rename = "type")]
    pub change_type: String,
    pub original: String,
    pub replacement: String,
    pub message: String,
}

/// Result of sanitizing a filename
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct SanitizeResult {
    pub sanitized: String,
    pub original: String,
    pub changes: Vec<SanitizeChange>,
    pub was_modified: bool,
}

/// Sanitize a filename to be valid across operating systems.
/// Applies the following transformations:
/// 1. Replace invalid characters with replacement char
/// 2. Collapse consecutive replacement characters
/// 3. Handle Windows reserved names
/// 4. Fix trailing spaces and periods
/// 5. Truncate if too long
fn sanitize_filename(filename: &str, replacement: char) -> SanitizeResult {
    let mut changes: Vec<SanitizeChange> = Vec::new();
    let original = filename.to_string();

    // Handle empty filename
    if filename.is_empty() {
        return SanitizeResult {
            sanitized: filename.to_string(),
            original,
            changes,
            was_modified: false,
        };
    }

    let mut result: String = filename.to_string();

    // Step 1: Replace invalid characters
    let invalid_chars: Vec<char> = result.chars().filter(|c| INVALID_CHARS.contains(c)).collect();
    if !invalid_chars.is_empty() {
        let unique_chars: Vec<char> = {
            let mut seen = std::collections::HashSet::new();
            invalid_chars.into_iter().filter(|c| seen.insert(*c)).collect()
        };
        changes.push(SanitizeChange {
            change_type: "char_replacement".to_string(),
            original: unique_chars.iter().collect(),
            replacement: replacement.to_string().repeat(unique_chars.len()),
            message: format!(
                "Replaced invalid characters: {}",
                unique_chars.iter().map(|c| format!("\"{}\"", c)).collect::<Vec<_>>().join(", ")
            ),
        });
        result = result.chars().map(|c| if INVALID_CHARS.contains(&c) { replacement } else { c }).collect();
    }

    // Step 2: Collapse multiple consecutive replacement characters
    let replacement_str = replacement.to_string();
    let mut prev_result = String::new();
    while prev_result != result {
        prev_result = result.clone();
        result = result.replace(&format!("{}{}", replacement, replacement), &replacement_str);
    }

    // Step 3: Handle Windows reserved names
    let (name_part, ext_part) = split_filename(&result);
    if RESERVED_NAMES.contains(&name_part.to_uppercase().as_str()) {
        let new_name = format!("{}_file{}", name_part, ext_part);
        changes.push(SanitizeChange {
            change_type: "reserved_name".to_string(),
            original: name_part.to_string(),
            replacement: format!("{}_file", name_part),
            message: format!("\"{}\" is a reserved name on Windows", name_part),
        });
        result = new_name;
    }

    // Step 4: Fix trailing spaces and periods
    let (name_part, ext_part) = split_filename(&result);
    let trimmed_name: String = name_part.trim_end_matches(|c| c == '.' || c == ' ').to_string();
    if trimmed_name != name_part {
        let removed: String = name_part[trimmed_name.len()..].to_string();
        changes.push(SanitizeChange {
            change_type: "trailing_fix".to_string(),
            original: removed,
            replacement: String::new(),
            message: "Removed trailing spaces/periods (invalid on Windows)".to_string(),
        });
        result = format!("{}{}", trimmed_name, ext_part);
    }

    // Also fix trailing chars at end of whole filename (no extension case)
    let trimmed_full: String = result.trim_end_matches(|c| c == '.' || c == ' ').to_string();
    if trimmed_full != result && trimmed_name == name_part {
        let removed: String = result[trimmed_full.len()..].to_string();
        changes.push(SanitizeChange {
            change_type: "trailing_fix".to_string(),
            original: removed,
            replacement: String::new(),
            message: "Removed trailing spaces/periods (invalid on Windows)".to_string(),
        });
        result = trimmed_full;
    }

    // Step 5: Handle length truncation
    if result.len() > MAX_FILENAME_LENGTH {
        result = truncate_filename(&result, MAX_FILENAME_LENGTH, &mut changes);
    }

    let was_modified = result != filename;

    SanitizeResult {
        sanitized: result,
        original,
        changes,
        was_modified,
    }
}

/// Split a filename into name and extension parts
fn split_filename(filename: &str) -> (String, String) {
    if filename.is_empty() {
        return (String::new(), String::new());
    }

    // Handle dotfiles like .gitignore
    if filename.starts_with('.') && !filename[1..].contains('.') {
        return (filename.to_string(), String::new());
    }

    match filename.rfind('.') {
        Some(0) | None => (filename.to_string(), String::new()),
        Some(pos) => (filename[..pos].to_string(), filename[pos..].to_string()),
    }
}

// =============================================================================
// Case Normalization
// =============================================================================

/// Default word separators
const WORD_SEPARATORS: &[char] = &[' ', '_', '-', '.'];

/// Split a string into words, handling various formats (spaces, underscores, hyphens, camelCase)
fn split_into_words(input: &str) -> Vec<String> {
    if input.is_empty() {
        return Vec::new();
    }

    let mut words: Vec<String> = Vec::new();
    let mut current_word = String::new();
    let mut prev_was_lowercase = false;

    for c in input.chars() {
        // Check for word separators
        if WORD_SEPARATORS.contains(&c) {
            if !current_word.is_empty() {
                words.push(current_word);
                current_word = String::new();
            }
            prev_was_lowercase = false;
            continue;
        }

        // Handle camelCase/PascalCase transitions
        let is_uppercase = c.is_uppercase();
        if is_uppercase && prev_was_lowercase && !current_word.is_empty() {
            words.push(current_word);
            current_word = String::new();
        }

        current_word.push(c);
        prev_was_lowercase = c.is_lowercase();
    }

    if !current_word.is_empty() {
        words.push(current_word);
    }

    words
}

/// Capitalize the first letter of a word
fn capitalize_word(word: &str) -> String {
    let mut chars = word.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().chain(chars.flat_map(char::to_lowercase)).collect(),
    }
}

/// Apply case normalization to a filename (name part only, not extension)
fn normalize_case(name: &str, style: &CaseStyle) -> String {
    if matches!(style, CaseStyle::None) || name.is_empty() {
        return name.to_string();
    }

    let words = split_into_words(name);

    match style {
        CaseStyle::None => name.to_string(),
        CaseStyle::Lowercase => words.iter().map(|w| w.to_lowercase()).collect::<Vec<_>>().join(" "),
        CaseStyle::Uppercase => words.iter().map(|w| w.to_uppercase()).collect::<Vec<_>>().join(" "),
        CaseStyle::Capitalize => {
            if let Some(first) = words.first() {
                let rest: Vec<String> = words.iter().skip(1).map(|w| w.to_lowercase()).collect();
                let mut result = capitalize_word(first);
                if !rest.is_empty() {
                    result.push(' ');
                    result.push_str(&rest.join(" "));
                }
                result
            } else {
                String::new()
            }
        }
        CaseStyle::TitleCase => words.iter().map(|w| capitalize_word(w)).collect::<Vec<_>>().join(" "),
        CaseStyle::KebabCase => words.iter().map(|w| w.to_lowercase()).collect::<Vec<_>>().join("-"),
        CaseStyle::SnakeCase => words.iter().map(|w| w.to_lowercase()).collect::<Vec<_>>().join("_"),
        CaseStyle::CamelCase => {
            words.iter().enumerate().map(|(i, w)| {
                if i == 0 { w.to_lowercase() } else { capitalize_word(w) }
            }).collect()
        }
        CaseStyle::PascalCase => words.iter().map(|w| capitalize_word(w)).collect(),
    }
}

/// Normalize a filename, applying case style to name part and lowercasing extension
fn normalize_filename(filename: &str, style: &CaseStyle) -> String {
    if matches!(style, CaseStyle::None) || filename.is_empty() {
        return filename.to_string();
    }

    // Handle hidden files (starting with .)
    let is_hidden = filename.starts_with('.');
    let working_name = if is_hidden { &filename[1..] } else { filename };

    // Split name and extension
    let (name, extension) = match working_name.rfind('.') {
        Some(0) | None => (working_name, ""),
        Some(pos) => (&working_name[..pos], &working_name[pos..]),
    };

    // Normalize the name part
    let normalized_name = normalize_case(name, style);

    // Extension is always lowercase
    let normalized_ext = extension.to_lowercase();

    // Reconstruct
    let prefix = if is_hidden { "." } else { "" };
    format!("{}{}{}", prefix, normalized_name, normalized_ext)
}

/// Truncate a filename while preserving the extension
fn truncate_filename(filename: &str, max_length: usize, changes: &mut Vec<SanitizeChange>) -> String {
    let (name_part, ext_part) = split_filename(filename);

    // Reserve space for extension
    let max_name_length = max_length.saturating_sub(ext_part.len());

    // Handle edge case where extension alone is too long
    if max_name_length < 1 {
        let result: String = filename.chars().take(max_length).collect();
        changes.push(SanitizeChange {
            change_type: "truncation".to_string(),
            original: filename.to_string(),
            replacement: result.clone(),
            message: format!("Truncated from {} to {} characters (extension too long)", filename.len(), max_length),
        });
        return result;
    }

    // Truncate with ellipsis
    let ellipsis = "...";
    let available_length = max_name_length.saturating_sub(ellipsis.len());

    let truncated_name = if available_length > 0 {
        let name_chars: Vec<char> = name_part.chars().collect();
        let truncated: String = name_chars.into_iter().take(available_length).collect();
        format!("{}{}", truncated, ellipsis)
    } else {
        name_part.chars().take(max_name_length).collect()
    };

    let result = format!("{}{}", truncated_name, ext_part);

    changes.push(SanitizeChange {
        change_type: "truncation".to_string(),
        original: filename.to_string(),
        replacement: result.clone(),
        message: format!("Truncated from {} to {} characters", filename.len(), result.len()),
    });

    result
}

/// Apply a template pattern to generate a new filename
fn apply_template(file: &FileInfo, pattern: &str, date_format: &str, strip_existing_patterns: bool) -> (String, Vec<String>) {
    let mut result = pattern.to_string();
    let mut sources: Vec<String> = Vec::new();

    // Get the name to use - either cleaned or original
    let name_to_use = if strip_existing_patterns {
        clean_filename(&file.name)
    } else {
        file.name.clone()
    };

    // Replace {name} or {original} with filename (without extension)
    if result.contains("{name}") || result.contains("{original}") {
        result = result.replace("{name}", &name_to_use);
        result = result.replace("{original}", &name_to_use);
        sources.push("filename".to_string());
    }

    // Replace {ext} with extension
    if result.contains("{ext}") {
        result = result.replace("{ext}", &file.extension);
    }

    // Replace {date} with file modification date
    if result.contains("{date}") {
        let date_str = format_date(&file.modified_at, date_format);
        result = result.replace("{date}", &date_str);
        sources.push("file-date".to_string());
    }

    // Replace {date:FORMAT} patterns
    let date_pattern = regex_lite::Regex::new(r"\{date:([^}]+)\}").unwrap();
    let mut new_result = result.clone();
    for cap in date_pattern.captures_iter(&result) {
        if let Some(format_match) = cap.get(1) {
            let custom_format = format_match.as_str();
            let date_str = format_date(&file.modified_at, custom_format);
            new_result = new_result.replace(&cap[0], &date_str);
            if !sources.contains(&"file-date".to_string()) {
                sources.push("file-date".to_string());
            }
        }
    }
    result = new_result;

    // Replace {year}, {month}, {day}
    if result.contains("{year}") {
        result = result.replace("{year}", &file.modified_at.format("%Y").to_string());
        if !sources.contains(&"file-date".to_string()) {
            sources.push("file-date".to_string());
        }
    }
    if result.contains("{month}") {
        result = result.replace("{month}", &file.modified_at.format("%m").to_string());
    }
    if result.contains("{day}") {
        result = result.replace("{day}", &file.modified_at.format("%d").to_string());
    }

    // Add extension if not already present in pattern
    if !result.contains('.') && !file.extension.is_empty() {
        result = format!("{}.{}", result, file.extension);
    } else if !result.ends_with(&format!(".{}", file.extension)) && !file.extension.is_empty() {
        // Ensure correct extension
        if let Some(pos) = result.rfind('.') {
            result = format!("{}.{}", &result[..pos], file.extension);
        }
    }

    // Sanitize the filename to ensure cross-platform compatibility
    let sanitized = sanitize_filename(&result, '_');

    (sanitized.sanitized, sources)
}

/// Format a date according to a pattern
fn format_date(date: &DateTime<Utc>, format: &str) -> String {
    // Convert common format tokens to chrono format
    let chrono_format = format
        .replace("YYYY", "%Y")
        .replace("MM", "%m")
        .replace("DD", "%d")
        .replace("HH", "%H")
        .replace("mm", "%M")
        .replace("ss", "%S");

    date.format(&chrono_format).to_string()
}

/// Apply a folder pattern to generate a destination folder path
fn apply_folder_pattern(file: &FileInfo, pattern: &str) -> String {
    let mut result = pattern.to_string();

    // Replace {year}, {month}, {day}
    result = result.replace("{year}", &file.modified_at.format("%Y").to_string());
    result = result.replace("{month}", &file.modified_at.format("%m").to_string());
    result = result.replace("{day}", &file.modified_at.format("%d").to_string());

    // Replace {category} with file category
    let category_str = match file.category {
        super::scanner::FileCategory::Image => "Images",
        super::scanner::FileCategory::Document => "Documents",
        super::scanner::FileCategory::Video => "Videos",
        super::scanner::FileCategory::Audio => "Audio",
        super::scanner::FileCategory::Archive => "Archives",
        super::scanner::FileCategory::Code => "Code",
        super::scanner::FileCategory::Data => "Data",
        super::scanner::FileCategory::Other => "Other",
    };
    result = result.replace("{category}", category_str);

    // Replace {extension} or {ext}
    result = result.replace("{extension}", &file.extension);
    result = result.replace("{ext}", &file.extension);

    // Normalize path separators
    result = result.replace('\\', "/");

    // Remove leading/trailing slashes and collapse multiple slashes
    result = result.trim_matches('/').to_string();
    while result.contains("//") {
        result = result.replace("//", "/");
    }

    result
}

// =============================================================================
// Preview Generation
// =============================================================================

/// Generate a rename preview for files using a template
///
/// Command name: generate_preview (snake_case per architecture)
#[tauri::command]
pub async fn generate_preview(
    files: Vec<FileInfo>,
    template_pattern: String,
    options: Option<GeneratePreviewOptions>,
) -> Result<RenamePreview, RenameError> {
    let options = options.unwrap_or_default();
    let date_format = options.date_format.as_deref().unwrap_or("YYYY-MM-DD");

    // Determine reorganization mode and settings
    // Support both new API (reorganization_mode + organize_options) and legacy API (folder_pattern + base_directory)
    let (reorg_mode, folder_pattern, base_directory) = match &options.reorganization_mode {
        ReorganizationMode::Organize => {
            if let Some(ref org_opts) = options.organize_options {
                (
                    ReorganizationMode::Organize,
                    Some(org_opts.folder_pattern.as_str()),
                    org_opts.destination_directory.as_deref(),
                )
            } else {
                // Organize mode but no options - fall back to legacy
                (
                    if options.folder_pattern.is_some() { ReorganizationMode::Organize } else { ReorganizationMode::RenameOnly },
                    options.folder_pattern.as_deref(),
                    options.base_directory.as_deref(),
                )
            }
        }
        ReorganizationMode::RenameOnly => {
            // Check if legacy folder_pattern is provided (backward compatibility)
            if options.folder_pattern.is_some() {
                (
                    ReorganizationMode::Organize,
                    options.folder_pattern.as_deref(),
                    options.base_directory.as_deref(),
                )
            } else {
                (ReorganizationMode::RenameOnly, None, None)
            }
        }
    };

    let mut proposals: Vec<RenameProposal> = Vec::new();
    let mut proposed_paths: HashMap<String, Vec<String>> = HashMap::new();

    // Get options
    let case_style = &options.case_style;
    let strip_existing_patterns = options.strip_existing_patterns;

    // First pass: generate proposals
    for file in &files {
        let id = Uuid::new_v4().to_string();
        let (raw_proposed_name, metadata_sources) = apply_template(file, &template_pattern, date_format, strip_existing_patterns);

        // Apply case normalization
        let proposed_name = normalize_filename(&raw_proposed_name, case_style);

        // Determine destination directory based on reorganization mode
        let (dest_dir, is_folder_move, destination_folder) = match reorg_mode {
            ReorganizationMode::Organize => {
                if let Some(pattern) = folder_pattern {
                    // Apply folder pattern
                    let folder_path = apply_folder_pattern(file, pattern);

                    // Combine with base directory if provided
                    let full_dest = match base_directory {
                        Some(base) => format!("{}/{}", base.trim_end_matches('/'), folder_path),
                        None => {
                            // Use source directory as base
                            let source_dir = Path::new(&file.path)
                                .parent()
                                .map(|p| p.to_string_lossy().to_string())
                                .unwrap_or_default();
                            if source_dir.is_empty() {
                                folder_path.clone()
                            } else {
                                format!("{}/{}", source_dir.trim_end_matches('/'), folder_path)
                            }
                        }
                    };

                    // Check if this is actually a move (different from source directory)
                    let source_dir = Path::new(&file.path)
                        .parent()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let is_move = full_dest != source_dir;
                    (full_dest.clone(), is_move, if is_move { Some(folder_path) } else { None })
                } else {
                    // No folder pattern - use original directory
                    let dir = Path::new(&file.path)
                        .parent()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();
                    (dir, false, None)
                }
            }
            ReorganizationMode::RenameOnly => {
                // Rename only - files stay in their original directories
                let dir = Path::new(&file.path)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                (dir, false, None)
            }
        };

        let proposed_path = if dest_dir.is_empty() {
            proposed_name.clone()
        } else {
            format!("{}/{}", dest_dir, proposed_name)
        };

        let mut issues: Vec<RenameIssue> = Vec::new();
        let mut status = RenameStatus::Ready;
        let mut action_type = if is_folder_move { FileActionType::Move } else { FileActionType::Rename };

        // Check for no change (both name and location)
        if proposed_name == file.full_name && !is_folder_move {
            status = RenameStatus::NoChange;
            action_type = FileActionType::NoChange;
        }

        // Check for invalid filename
        if !is_valid_filename(&proposed_name) {
            issues.push(RenameIssue {
                code: "INVALID_NAME".to_string(),
                message: "Proposed filename contains invalid characters".to_string(),
                field: None,
            });
            status = RenameStatus::InvalidName;
            action_type = FileActionType::Error;
        }

        // Track for conflict detection
        let path_key = proposed_path.to_lowercase();
        proposed_paths
            .entry(path_key)
            .or_default()
            .push(id.clone());

        proposals.push(RenameProposal {
            id,
            original_path: file.path.clone(),
            original_name: file.full_name.clone(),
            proposed_name,
            proposed_path,
            status,
            issues,
            metadata_sources: if metadata_sources.is_empty() {
                None
            } else {
                Some(metadata_sources)
            },
            is_folder_move,
            destination_folder,
            action_type,
            conflict: None,
        });
    }

    // Second pass: detect batch conflicts (duplicate names in same destination)
    for (path_key, ids) in &proposed_paths {
        if ids.len() > 1 {
            // Find the first file ID to reference in conflict details
            let first_id = ids.first().cloned();

            for (idx, id) in ids.iter().enumerate() {
                if let Some(proposal) = proposals.iter_mut().find(|p| p.id == *id) {
                    if proposal.status == RenameStatus::Ready {
                        proposal.status = RenameStatus::Conflict;
                        proposal.action_type = FileActionType::Conflict;
                        proposal.issues.push(RenameIssue {
                            code: "DUPLICATE_NAME".to_string(),
                            message: format!("Another file would have the same name ({})", path_key),
                            field: None,
                        });
                        // Set conflict details
                        proposal.conflict = Some(FileConflict {
                            conflict_type: "duplicate-name".to_string(),
                            message: "Another file in this batch would have the same name".to_string(),
                            conflicting_file_id: if idx > 0 { first_id.clone() } else { ids.get(1).cloned() },
                            existing_file_path: None,
                        });
                    }
                }
            }
        }
    }

    // Third pass: check for filesystem conflicts (file already exists at target)
    for proposal in &mut proposals {
        if proposal.status == RenameStatus::Ready {
            // Check if target already exists (and isn't the source file)
            let target_path = Path::new(&proposal.proposed_path);
            if target_path.exists() && proposal.proposed_path != proposal.original_path {
                proposal.status = RenameStatus::Conflict;
                proposal.action_type = FileActionType::Conflict;
                proposal.issues.push(RenameIssue {
                    code: "FILE_EXISTS".to_string(),
                    message: "A file with this name already exists".to_string(),
                    field: None,
                });
                proposal.conflict = Some(FileConflict {
                    conflict_type: "file-exists".to_string(),
                    message: "A file already exists at the proposed path".to_string(),
                    conflicting_file_id: None,
                    existing_file_path: Some(proposal.proposed_path.clone()),
                });
            }
        }
    }

    // Calculate legacy summary (for backward compatibility)
    let summary = PreviewSummary {
        total: proposals.len(),
        ready: proposals.iter().filter(|p| p.status == RenameStatus::Ready).count(),
        conflicts: proposals.iter().filter(|p| p.status == RenameStatus::Conflict).count(),
        missing_data: proposals.iter().filter(|p| p.status == RenameStatus::MissingData).count(),
        no_change: proposals.iter().filter(|p| p.status == RenameStatus::NoChange).count(),
        invalid_name: proposals.iter().filter(|p| p.status == RenameStatus::InvalidName).count(),
    };

    // Calculate action summary (new, clearer summary)
    let action_summary = PreviewActionSummary {
        rename_count: proposals.iter().filter(|p| p.action_type == FileActionType::Rename).count(),
        move_count: proposals.iter().filter(|p| p.action_type == FileActionType::Move).count(),
        no_change_count: proposals.iter().filter(|p| p.action_type == FileActionType::NoChange).count(),
        conflict_count: proposals.iter().filter(|p| p.action_type == FileActionType::Conflict).count(),
        error_count: proposals.iter().filter(|p| p.action_type == FileActionType::Error).count(),
    };

    Ok(RenamePreview {
        proposals,
        summary,
        generated_at: Utc::now(),
        template_used: template_pattern,
        action_summary,
        reorganization_mode: reorg_mode,
    })
}

// =============================================================================
// Rename Execution
// =============================================================================

/// Execute batch rename operation on selected proposals
///
/// Command name: execute_rename (snake_case per architecture)
#[tauri::command]
pub async fn execute_rename(
    proposals: Vec<RenameProposal>,
    options: Option<ExecuteRenameOptions>,
) -> Result<BatchRenameResult, RenameError> {
    let started_at = Utc::now();
    let options = options.unwrap_or_default();

    // Filter to only rename specified IDs (or all ready if none specified)
    let selected_ids: Option<HashSet<String>> = options
        .proposal_ids
        .map(|ids| ids.into_iter().collect());

    let mut results: Vec<FileRenameResult> = Vec::new();

    for proposal in &proposals {
        // Check if this proposal should be processed
        let should_process = match &selected_ids {
            Some(ids) => ids.contains(&proposal.id),
            None => true, // Process all if no IDs specified
        };

        if !should_process {
            results.push(FileRenameResult {
                proposal_id: proposal.id.clone(),
                original_path: proposal.original_path.clone(),
                original_name: proposal.original_name.clone(),
                new_path: None,
                new_name: None,
                outcome: RenameOutcome::Skipped,
                error: Some("Not selected".to_string()),
            });
            continue;
        }

        // Skip non-ready proposals
        if proposal.status != RenameStatus::Ready {
            results.push(FileRenameResult {
                proposal_id: proposal.id.clone(),
                original_path: proposal.original_path.clone(),
                original_name: proposal.original_name.clone(),
                new_path: None,
                new_name: None,
                outcome: RenameOutcome::Skipped,
                error: Some(format!("Status: {:?}", proposal.status)),
            });
            continue;
        }

        // Skip if no change needed (and not a folder move)
        if proposal.original_name == proposal.proposed_name && !proposal.is_folder_move {
            results.push(FileRenameResult {
                proposal_id: proposal.id.clone(),
                original_path: proposal.original_path.clone(),
                original_name: proposal.original_name.clone(),
                new_path: None,
                new_name: None,
                outcome: RenameOutcome::Skipped,
                error: Some("No change needed".to_string()),
            });
            continue;
        }

        // Create destination directory if it's a folder move
        if proposal.is_folder_move {
            if let Some(parent) = Path::new(&proposal.proposed_path).parent() {
                if !parent.exists() {
                    if let Err(e) = fs::create_dir_all(parent) {
                        results.push(FileRenameResult {
                            proposal_id: proposal.id.clone(),
                            original_path: proposal.original_path.clone(),
                            original_name: proposal.original_name.clone(),
                            new_path: None,
                            new_name: None,
                            outcome: RenameOutcome::Failed,
                            error: Some(format!("Failed to create directory: {}", e)),
                        });
                        continue;
                    }
                }
            }
        }

        // Attempt the rename/move
        match fs::rename(&proposal.original_path, &proposal.proposed_path) {
            Ok(_) => {
                results.push(FileRenameResult {
                    proposal_id: proposal.id.clone(),
                    original_path: proposal.original_path.clone(),
                    original_name: proposal.original_name.clone(),
                    new_path: Some(proposal.proposed_path.clone()),
                    new_name: Some(proposal.proposed_name.clone()),
                    outcome: RenameOutcome::Success,
                    error: None,
                });
            }
            Err(e) => {
                results.push(FileRenameResult {
                    proposal_id: proposal.id.clone(),
                    original_path: proposal.original_path.clone(),
                    original_name: proposal.original_name.clone(),
                    new_path: None,
                    new_name: None,
                    outcome: RenameOutcome::Failed,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    let completed_at = Utc::now();
    let duration_ms = (completed_at - started_at).num_milliseconds() as u64;

    let summary = BatchRenameSummary {
        total: results.len(),
        succeeded: results.iter().filter(|r| r.outcome == RenameOutcome::Success).count(),
        failed: results.iter().filter(|r| r.outcome == RenameOutcome::Failed).count(),
        skipped: results.iter().filter(|r| r.outcome == RenameOutcome::Skipped).count(),
    };

    let success = summary.failed == 0;

    Ok(BatchRenameResult {
        success,
        results,
        summary,
        started_at,
        completed_at,
        duration_ms,
    })
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::scanner::{FileCategory, MetadataCapability};
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file_info(name: &str, ext: &str, path: &str) -> FileInfo {
        FileInfo {
            path: path.to_string(),
            name: name.to_string(),
            extension: ext.to_string(),
            full_name: if ext.is_empty() {
                name.to_string()
            } else {
                format!("{}.{}", name, ext)
            },
            size: 1024,
            created_at: Utc::now(),
            modified_at: Utc::now(),
            relative_path: format!("{}.{}", name, ext),
            category: FileCategory::Image,
            metadata_supported: true,
            metadata_capability: MetadataCapability::Full,
        }
    }

    #[test]
    fn test_is_valid_filename() {
        assert!(is_valid_filename("test.jpg"));
        assert!(is_valid_filename("my-photo_2024.png"));
        assert!(!is_valid_filename("test/file.jpg")); // Contains /
        assert!(!is_valid_filename("test:file.jpg")); // Contains :
        assert!(!is_valid_filename("CON.txt")); // Reserved name
        assert!(!is_valid_filename("")); // Empty
        assert!(!is_valid_filename("test.")); // Trailing dot
    }

    #[test]
    fn test_apply_template_basic() {
        let file = create_test_file_info("photo", "jpg", "/home/user/photo.jpg");
        let (result, sources) = apply_template(&file, "{name}.{ext}", "YYYY-MM-DD", false);
        assert_eq!(result, "photo.jpg");
        assert!(sources.contains(&"filename".to_string()));
    }

    #[test]
    fn test_apply_template_with_date() {
        let mut file = create_test_file_info("photo", "jpg", "/home/user/photo.jpg");
        file.modified_at = DateTime::parse_from_rfc3339("2024-07-15T10:30:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let (result, sources) = apply_template(&file, "{date}_{name}.{ext}", "YYYY-MM-DD", false);
        assert_eq!(result, "2024-07-15_photo.jpg");
        assert!(sources.contains(&"file-date".to_string()));
    }

    #[test]
    fn test_apply_template_custom_date_format() {
        let mut file = create_test_file_info("photo", "jpg", "/home/user/photo.jpg");
        file.modified_at = DateTime::parse_from_rfc3339("2024-07-15T10:30:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let (result, _) = apply_template(&file, "{date:YYYYMMDD}_{name}.{ext}", "YYYY-MM-DD", false);
        assert_eq!(result, "20240715_photo.jpg");
    }

    #[tokio::test]
    async fn test_generate_preview_basic() {
        let files = vec![
            create_test_file_info("photo1", "jpg", "/tmp/photo1.jpg"),
            create_test_file_info("photo2", "jpg", "/tmp/photo2.jpg"),
        ];

        let result = generate_preview(files, "{name}_renamed.{ext}".to_string(), None)
            .await
            .unwrap();

        assert_eq!(result.proposals.len(), 2);
        assert_eq!(result.summary.total, 2);
        assert_eq!(result.proposals[0].proposed_name, "photo1_renamed.jpg");
        assert_eq!(result.proposals[1].proposed_name, "photo2_renamed.jpg");
    }

    #[tokio::test]
    async fn test_generate_preview_detects_no_change() {
        let files = vec![create_test_file_info("photo", "jpg", "/tmp/photo.jpg")];

        let result = generate_preview(files, "{name}.{ext}".to_string(), None)
            .await
            .unwrap();

        assert_eq!(result.proposals[0].status, RenameStatus::NoChange);
        assert_eq!(result.summary.no_change, 1);
    }

    #[tokio::test]
    async fn test_generate_preview_detects_conflicts() {
        let files = vec![
            create_test_file_info("photo1", "jpg", "/tmp/photo1.jpg"),
            create_test_file_info("photo2", "jpg", "/tmp/photo2.jpg"),
        ];

        // Template that produces same output for different files
        let result = generate_preview(files, "output.{ext}".to_string(), None)
            .await
            .unwrap();

        assert_eq!(result.summary.conflicts, 2);
    }

    #[tokio::test]
    async fn test_execute_rename_success() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("test.jpg");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"test content").unwrap();

        let proposal = RenameProposal {
            id: "test-id".to_string(),
            original_path: file_path.to_string_lossy().to_string(),
            original_name: "test.jpg".to_string(),
            proposed_name: "renamed.jpg".to_string(),
            proposed_path: dir.path().join("renamed.jpg").to_string_lossy().to_string(),
            status: RenameStatus::Ready,
            issues: vec![],
            metadata_sources: None,
            is_folder_move: false,
            destination_folder: None,
            action_type: FileActionType::Rename,
            conflict: None,
        };

        let result = execute_rename(vec![proposal], None).await.unwrap();

        assert!(result.success);
        assert_eq!(result.summary.succeeded, 1);
        assert!(dir.path().join("renamed.jpg").exists());
        assert!(!file_path.exists());
    }

    #[tokio::test]
    async fn test_execute_rename_skips_non_ready() {
        let proposal = RenameProposal {
            id: "test-id".to_string(),
            original_path: "/tmp/test.jpg".to_string(),
            original_name: "test.jpg".to_string(),
            proposed_name: "renamed.jpg".to_string(),
            proposed_path: "/tmp/renamed.jpg".to_string(),
            status: RenameStatus::Conflict,
            issues: vec![],
            metadata_sources: None,
            is_folder_move: false,
            destination_folder: None,
            action_type: FileActionType::Conflict,
            conflict: None,
        };

        let result = execute_rename(vec![proposal], None).await.unwrap();

        assert!(result.success);
        assert_eq!(result.summary.skipped, 1);
        assert_eq!(result.summary.succeeded, 0);
    }

    #[tokio::test]
    async fn test_execute_rename_with_selection() {
        let dir = TempDir::new().unwrap();

        // Create two files
        let file1_path = dir.path().join("test1.jpg");
        let file2_path = dir.path().join("test2.jpg");
        File::create(&file1_path).unwrap().write_all(b"1").unwrap();
        File::create(&file2_path).unwrap().write_all(b"2").unwrap();

        let proposals = vec![
            RenameProposal {
                id: "id-1".to_string(),
                original_path: file1_path.to_string_lossy().to_string(),
                original_name: "test1.jpg".to_string(),
                proposed_name: "renamed1.jpg".to_string(),
                proposed_path: dir.path().join("renamed1.jpg").to_string_lossy().to_string(),
                status: RenameStatus::Ready,
                issues: vec![],
                metadata_sources: None,
                is_folder_move: false,
                destination_folder: None,
                action_type: FileActionType::Rename,
                conflict: None,
            },
            RenameProposal {
                id: "id-2".to_string(),
                original_path: file2_path.to_string_lossy().to_string(),
                original_name: "test2.jpg".to_string(),
                proposed_name: "renamed2.jpg".to_string(),
                proposed_path: dir.path().join("renamed2.jpg").to_string_lossy().to_string(),
                status: RenameStatus::Ready,
                issues: vec![],
                metadata_sources: None,
                is_folder_move: false,
                destination_folder: None,
                action_type: FileActionType::Rename,
                conflict: None,
            },
        ];

        // Only rename the first file
        let options = ExecuteRenameOptions {
            proposal_ids: Some(vec!["id-1".to_string()]),
        };

        let result = execute_rename(proposals, Some(options)).await.unwrap();

        assert!(result.success);
        assert_eq!(result.summary.succeeded, 1);
        assert_eq!(result.summary.skipped, 1);
        assert!(dir.path().join("renamed1.jpg").exists());
        assert!(file2_path.exists()); // Second file should not be renamed
    }

    // =============================================================================
    // Sanitization Tests
    // =============================================================================

    #[test]
    fn test_sanitize_filename_no_change() {
        let result = sanitize_filename("valid_filename.jpg", '_');
        assert_eq!(result.sanitized, "valid_filename.jpg");
        assert!(!result.was_modified);
        assert!(result.changes.is_empty());
    }

    #[test]
    fn test_sanitize_filename_replaces_invalid_chars() {
        let result = sanitize_filename("photo:2024.jpg", '_');
        assert_eq!(result.sanitized, "photo_2024.jpg");
        assert!(result.was_modified);
        assert_eq!(result.changes.len(), 1);
        assert_eq!(result.changes[0].change_type, "char_replacement");
    }

    #[test]
    fn test_sanitize_filename_collapses_multiple_replacements() {
        let result = sanitize_filename("test::file.jpg", '_');
        assert_eq!(result.sanitized, "test_file.jpg");
        assert!(result.was_modified);
    }

    #[test]
    fn test_sanitize_filename_handles_reserved_names() {
        let result = sanitize_filename("CON.txt", '_');
        assert_eq!(result.sanitized, "CON_file.txt");
        assert!(result.was_modified);
        assert!(result.changes.iter().any(|c| c.change_type == "reserved_name"));
    }

    #[test]
    fn test_sanitize_filename_fixes_trailing_spaces() {
        let result = sanitize_filename("test .jpg", '_');
        assert_eq!(result.sanitized, "test.jpg");
        assert!(result.was_modified);
    }

    #[test]
    fn test_sanitize_filename_fixes_trailing_dots() {
        let result = sanitize_filename("test..jpg", '_');
        assert_eq!(result.sanitized, "test.jpg");
        assert!(result.was_modified);
    }

    #[test]
    fn test_split_filename() {
        assert_eq!(split_filename("file.txt"), ("file".to_string(), ".txt".to_string()));
        assert_eq!(split_filename("file.tar.gz"), ("file.tar".to_string(), ".gz".to_string()));
        assert_eq!(split_filename(".gitignore"), (".gitignore".to_string(), String::new()));
        assert_eq!(split_filename("noextension"), ("noextension".to_string(), String::new()));
        assert_eq!(split_filename(""), (String::new(), String::new()));
    }

    #[test]
    fn test_apply_template_sanitizes_output() {
        // Create a file with invalid characters in the name
        let file = create_test_file_info("photo:test", "jpg", "/home/user/photo:test.jpg");
        let (result, _) = apply_template(&file, "{name}.{ext}", "YYYY-MM-DD", false);
        // The sanitization should replace : with _
        assert_eq!(result, "photo_test.jpg");
    }

    // =============================================================================
    // Case Normalization Tests
    // =============================================================================

    #[test]
    fn test_split_into_words_simple() {
        let words = split_into_words("hello world");
        assert_eq!(words, vec!["hello", "world"]);
    }

    #[test]
    fn test_split_into_words_with_separators() {
        let words = split_into_words("hello-world_test");
        assert_eq!(words, vec!["hello", "world", "test"]);
    }

    #[test]
    fn test_split_into_words_camel_case() {
        let words = split_into_words("helloWorldTest");
        assert_eq!(words, vec!["hello", "World", "Test"]);
    }

    #[test]
    fn test_split_into_words_pascal_case() {
        let words = split_into_words("HelloWorldTest");
        assert_eq!(words, vec!["Hello", "World", "Test"]);
    }

    #[test]
    fn test_capitalize_word() {
        assert_eq!(capitalize_word("hello"), "Hello");
        assert_eq!(capitalize_word("HELLO"), "Hello");
        assert_eq!(capitalize_word(""), "");
    }

    #[test]
    fn test_normalize_case_none() {
        assert_eq!(normalize_case("Hello World", &CaseStyle::None), "Hello World");
    }

    #[test]
    fn test_normalize_case_lowercase() {
        assert_eq!(normalize_case("Hello World", &CaseStyle::Lowercase), "hello world");
    }

    #[test]
    fn test_normalize_case_uppercase() {
        assert_eq!(normalize_case("Hello World", &CaseStyle::Uppercase), "HELLO WORLD");
    }

    #[test]
    fn test_normalize_case_capitalize() {
        assert_eq!(normalize_case("hello world", &CaseStyle::Capitalize), "Hello world");
        assert_eq!(normalize_case("HELLO WORLD", &CaseStyle::Capitalize), "Hello world");
    }

    #[test]
    fn test_normalize_case_title_case() {
        assert_eq!(normalize_case("hello world", &CaseStyle::TitleCase), "Hello World");
    }

    #[test]
    fn test_normalize_case_kebab_case() {
        assert_eq!(normalize_case("Hello World", &CaseStyle::KebabCase), "hello-world");
        assert_eq!(normalize_case("helloWorld", &CaseStyle::KebabCase), "hello-world");
    }

    #[test]
    fn test_normalize_case_snake_case() {
        assert_eq!(normalize_case("Hello World", &CaseStyle::SnakeCase), "hello_world");
        assert_eq!(normalize_case("helloWorld", &CaseStyle::SnakeCase), "hello_world");
    }

    #[test]
    fn test_normalize_case_camel_case() {
        assert_eq!(normalize_case("hello world", &CaseStyle::CamelCase), "helloWorld");
        assert_eq!(normalize_case("Hello World", &CaseStyle::CamelCase), "helloWorld");
    }

    #[test]
    fn test_normalize_case_pascal_case() {
        assert_eq!(normalize_case("hello world", &CaseStyle::PascalCase), "HelloWorld");
    }

    #[test]
    fn test_normalize_filename_preserves_extension() {
        assert_eq!(normalize_filename("Hello World.JPG", &CaseStyle::KebabCase), "hello-world.jpg");
        assert_eq!(normalize_filename("My Document.PDF", &CaseStyle::SnakeCase), "my_document.pdf");
    }

    #[test]
    fn test_normalize_filename_handles_hidden_files() {
        assert_eq!(normalize_filename(".Hidden File.txt", &CaseStyle::KebabCase), ".hidden-file.txt");
    }

    #[test]
    fn test_normalize_filename_none_style() {
        assert_eq!(normalize_filename("Hello World.JPG", &CaseStyle::None), "Hello World.JPG");
    }

    #[tokio::test]
    async fn test_generate_preview_with_case_normalization() {
        let files = vec![create_test_file_info("My Photo", "JPG", "/tmp/My Photo.JPG")];

        let options = GeneratePreviewOptions {
            case_style: CaseStyle::KebabCase,
            ..Default::default()
        };

        let result = generate_preview(files, "{name}.{ext}".to_string(), Some(options))
            .await
            .unwrap();

        assert_eq!(result.proposals[0].proposed_name, "my-photo.jpg");
    }

    // =============================================================================
    // Pattern Stripping Tests
    // =============================================================================

    #[test]
    fn test_clean_filename_no_patterns() {
        assert_eq!(clean_filename("photo"), "photo");
        assert_eq!(clean_filename("my-vacation-pic"), "my-vacation-pic");
    }

    #[test]
    fn test_clean_filename_iso_date_prefix() {
        assert_eq!(clean_filename("2024-01-15_photo"), "photo");
        assert_eq!(clean_filename("2024-01-15-photo"), "photo");
        assert_eq!(clean_filename("2024_01_15_photo"), "photo");
    }

    #[test]
    fn test_clean_filename_compact_date_prefix() {
        assert_eq!(clean_filename("20240115_photo"), "photo");
        assert_eq!(clean_filename("20240115-photo"), "photo");
    }

    #[test]
    fn test_clean_filename_date_suffix() {
        assert_eq!(clean_filename("photo_2024-01-15"), "photo");
        assert_eq!(clean_filename("photo-20240115"), "photo");
    }

    #[test]
    fn test_clean_filename_counter_suffix() {
        assert_eq!(clean_filename("photo_001"), "photo");
        assert_eq!(clean_filename("photo-02"), "photo");
        assert_eq!(clean_filename("photo(3)"), "photo");
    }

    #[test]
    fn test_clean_filename_multiple_patterns() {
        assert_eq!(clean_filename("2024-01-15_photo_001"), "photo");
    }

    #[test]
    fn test_clean_filename_preserves_non_date_numbers() {
        // Numbers that aren't dates should be preserved
        assert_eq!(clean_filename("photo123"), "photo123");
        assert_eq!(clean_filename("vacation2024"), "vacation2024");
    }

    #[test]
    fn test_clean_filename_empty_result_returns_original() {
        // If cleaning would result in empty string, return original
        assert_eq!(clean_filename("2024-01-15"), "2024-01-15");
        assert_eq!(clean_filename("001"), "001");
    }

    #[tokio::test]
    async fn test_generate_preview_with_strip_existing_patterns() {
        // Simulate a file that was already renamed with a date prefix
        let files = vec![create_test_file_info("2024-01-15_photo", "jpg", "/tmp/2024-01-15_photo.jpg")];

        // Without stripping - would create duplicate date
        let options_no_strip = GeneratePreviewOptions {
            strip_existing_patterns: false,
            ..Default::default()
        };

        let result = generate_preview(files.clone(), "{date}_{name}.{ext}".to_string(), Some(options_no_strip))
            .await
            .unwrap();

        // The date appears twice because {name} includes the existing date
        assert!(result.proposals[0].proposed_name.contains("2024"));
        assert!(result.proposals[0].proposed_name.matches("2024").count() >= 1);

        // With stripping - clean result
        let options_strip = GeneratePreviewOptions {
            strip_existing_patterns: true,
            ..Default::default()
        };

        let result = generate_preview(files, "{date}_{name}.{ext}".to_string(), Some(options_strip))
            .await
            .unwrap();

        // The date should only appear once
        let date_count = result.proposals[0].proposed_name.matches('-').count();
        // ISO date has 2 dashes (YYYY-MM-DD), plus 1 underscore separator = clean format
        assert!(date_count <= 3, "Expected clean date format, got: {}", result.proposals[0].proposed_name);
    }

    #[tokio::test]
    async fn test_strip_existing_patterns_idempotent() {
        // Apply template to a clean file
        let files = vec![create_test_file_info("vacation", "jpg", "/tmp/vacation.jpg")];

        let options = GeneratePreviewOptions {
            strip_existing_patterns: true,
            ..Default::default()
        };

        let result1 = generate_preview(files, "{date}_{name}.{ext}".to_string(), Some(options.clone()))
            .await
            .unwrap();

        let first_name = &result1.proposals[0].proposed_name;

        // Now simulate applying to the already-renamed file
        let renamed_files = vec![create_test_file_info(
            first_name.strip_suffix(".jpg").unwrap_or(first_name),
            "jpg",
            &format!("/tmp/{}", first_name)
        )];

        let result2 = generate_preview(renamed_files, "{date}_{name}.{ext}".to_string(), Some(options))
            .await
            .unwrap();

        // With strip_existing_patterns=true, applying the same template twice
        // should give similar results (idempotent)
        assert!(
            result2.proposals[0].proposed_name.ends_with("_vacation.jpg"),
            "Expected idempotent result ending with _vacation.jpg, got: {}",
            result2.proposals[0].proposed_name
        );
    }
}
