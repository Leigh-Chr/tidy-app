// Configuration commands for tidy-app GUI
// Command names use snake_case per architecture requirements
//
// Implements config loading/saving compatible with @tidy-app/core schema

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;
use uuid::Uuid;

// =============================================================================
// Error Types
// =============================================================================

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Failed to read config: {0}")]
    ReadError(String),
    #[error("Failed to write config: {0}")]
    WriteError(String),
    #[error("Invalid config format: {0}")]
    ParseError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Serialize for ConfigError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// =============================================================================
// Config Types (matching @tidy-app/core schema)
// =============================================================================

/// Template for renaming files
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    /// Unique identifier (UUID)
    pub id: String,
    /// Template name (1-100 chars)
    pub name: String,
    /// Naming pattern (1-500 chars)
    pub pattern: String,
    /// Optional file type filters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_types: Option<Vec<String>>,
    /// Whether this is the default template
    #[serde(default)]
    pub is_default: bool,
    /// Creation timestamp (ISO datetime)
    pub created_at: String,
    /// Last update timestamp (ISO datetime)
    pub updated_at: String,
}

/// Output format options
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Table,
    Json,
    Plain,
}

impl Default for OutputFormat {
    fn default() -> Self {
        OutputFormat::Table
    }
}

/// Case normalization style for filenames
///
/// Controls how filenames are normalized for consistency.
/// Default: kebab-case (modern, URL-friendly, widely compatible)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum CaseStyle {
    /// No transformation - keep original casing
    None,
    /// all lowercase
    Lowercase,
    /// ALL UPPERCASE
    Uppercase,
    /// First letter uppercase
    Capitalize,
    /// Each Word Capitalized
    TitleCase,
    /// words-separated-by-hyphens (RECOMMENDED - default)
    KebabCase,
    /// words_separated_by_underscores
    SnakeCase,
    /// wordsJoinedWithCamelCase
    CamelCase,
    /// WordsJoinedWithPascalCase
    PascalCase,
}

impl Default for CaseStyle {
    fn default() -> Self {
        CaseStyle::KebabCase
    }
}

/// User preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    /// Default output format (table/json/plain)
    #[serde(default)]
    pub default_output_format: OutputFormat,
    /// Whether to use color output
    #[serde(default = "default_true")]
    pub color_output: bool,
    /// Whether to confirm before applying renames
    #[serde(default = "default_true")]
    pub confirm_before_apply: bool,
    /// Whether to scan subdirectories
    #[serde(default)]
    pub recursive_scan: bool,
    /// Case normalization style for filenames (default: kebab-case)
    #[serde(default)]
    pub case_normalization: CaseStyle,
}

fn default_true() -> bool {
    true
}

impl Default for Preferences {
    fn default() -> Self {
        Preferences {
            default_output_format: OutputFormat::Table,
            color_output: true,
            confirm_before_apply: true,
            recursive_scan: false,
            case_normalization: CaseStyle::KebabCase,
        }
    }
}

// =============================================================================
// Ollama Configuration (LLM Integration)
// =============================================================================

/// Model selection for Ollama
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OllamaModelsConfig {
    /// Model for text generation/inference
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inference: Option<String>,
    /// Vision-capable model for image analysis
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vision: Option<String>,
}

/// File type preset for LLM analysis
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileTypePreset {
    Images,
    #[default]
    Documents,
    Text,
    All,
    Custom,
}

/// Offline mode behavior
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OfflineMode {
    #[default]
    Auto,
    Enabled,
    Disabled,
}

/// LLM provider type
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LlmProvider {
    #[default]
    Ollama,
    Openai,
}

fn default_openai_url() -> String {
    "https://api.openai.com/v1".to_string()
}

fn default_openai_model() -> String {
    "gpt-4o-mini".to_string()
}

fn default_openai_vision_model() -> String {
    "gpt-4o".to_string()
}

/// OpenAI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiConfig {
    /// API key (empty if not configured)
    #[serde(default)]
    pub api_key: String,
    /// API base URL (for Azure OpenAI or proxies)
    #[serde(default = "default_openai_url")]
    pub base_url: String,
    /// Model to use for text analysis
    #[serde(default = "default_openai_model")]
    pub model: String,
    /// Model to use for vision analysis
    #[serde(default = "default_openai_vision_model")]
    pub vision_model: String,
}

impl Default for OpenAiConfig {
    fn default() -> Self {
        OpenAiConfig {
            api_key: String::new(),
            base_url: default_openai_url(),
            model: default_openai_model(),
            vision_model: default_openai_vision_model(),
        }
    }
}

/// File type configuration for LLM analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmFileTypes {
    /// Preset category
    #[serde(default)]
    pub preset: FileTypePreset,
    /// Explicit extensions to include
    #[serde(default)]
    pub included_extensions: Vec<String>,
    /// Extensions to exclude
    #[serde(default)]
    pub excluded_extensions: Vec<String>,
    /// Skip files with rich metadata
    #[serde(default = "default_true")]
    pub skip_with_metadata: bool,
}

impl Default for LlmFileTypes {
    fn default() -> Self {
        LlmFileTypes {
            preset: FileTypePreset::Documents,
            included_extensions: Vec::new(),
            excluded_extensions: Vec::new(),
            skip_with_metadata: true,
        }
    }
}

fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

fn default_timeout() -> u64 {
    30000
}

fn default_max_image_size() -> u64 {
    20 * 1024 * 1024 // 20MB
}

fn default_health_timeout() -> u64 {
    5000
}

/// Complete Ollama configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaConfig {
    /// Whether LLM integration is enabled
    #[serde(default)]
    pub enabled: bool,
    /// Which LLM provider to use
    #[serde(default)]
    pub provider: LlmProvider,
    /// Ollama API base URL
    #[serde(default = "default_ollama_url")]
    pub base_url: String,
    /// Request timeout in milliseconds
    #[serde(default = "default_timeout")]
    pub timeout: u64,
    /// Preferred models (for Ollama)
    #[serde(default)]
    pub models: OllamaModelsConfig,
    /// File type configuration
    #[serde(default)]
    pub file_types: LlmFileTypes,
    /// Enable vision model analysis
    #[serde(default)]
    pub vision_enabled: bool,
    /// Skip images with EXIF metadata
    #[serde(default = "default_true")]
    pub skip_images_with_exif: bool,
    /// Max image size for vision analysis
    #[serde(default = "default_max_image_size")]
    pub max_image_size: u64,
    /// Offline mode behavior
    #[serde(default)]
    pub offline_mode: OfflineMode,
    /// Health check timeout
    #[serde(default = "default_health_timeout")]
    pub health_check_timeout: u64,
    /// OpenAI configuration (used when provider is 'openai')
    #[serde(default)]
    pub openai: OpenAiConfig,
}

impl Default for OllamaConfig {
    fn default() -> Self {
        OllamaConfig {
            enabled: false,
            provider: LlmProvider::Ollama,
            base_url: default_ollama_url(),
            timeout: default_timeout(),
            models: OllamaModelsConfig::default(),
            file_types: LlmFileTypes::default(),
            vision_enabled: false,
            skip_images_with_exif: true,
            max_image_size: default_max_image_size(),
            offline_mode: OfflineMode::Auto,
            health_check_timeout: default_health_timeout(),
            openai: OpenAiConfig::default(),
        }
    }
}

// =============================================================================
// Folder Structure Types (File Organization)
// =============================================================================

/// A folder structure definition for organizing files into directories
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderStructure {
    /// Unique identifier (UUID)
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Folder pattern using placeholders (e.g., "{year}/{month}")
    pub pattern: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Whether this structure is active
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Priority for ordering (lower = higher priority)
    #[serde(default)]
    pub priority: u32,
    /// Creation timestamp (ISO datetime)
    pub created_at: String,
    /// Last update timestamp (ISO datetime)
    pub updated_at: String,
}

/// Complete application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    /// Config schema version
    pub version: u8,
    /// Saved templates
    #[serde(default)]
    pub templates: Vec<Template>,
    /// Folder structures for file organization
    #[serde(default = "default_folder_structures")]
    pub folder_structures: Vec<FolderStructure>,
    /// User preferences
    #[serde(default)]
    pub preferences: Preferences,
    /// Recently accessed folders
    #[serde(default)]
    pub recent_folders: Vec<String>,
    /// Ollama/LLM configuration
    #[serde(default)]
    pub ollama: OllamaConfig,
}

// =============================================================================
// Default Configuration
// =============================================================================

/// Default timestamp for built-in templates
const DEFAULT_TIMESTAMP: &str = "2024-01-01T00:00:00.000Z";

/// Generate default templates
///
/// Note: Templates use {name} placeholder which uses AI suggestion if available,
/// otherwise falls back to original filename. Use {original} to always keep
/// the original filename, or {ai} for AI-only suggestions.
fn default_templates() -> Vec<Template> {
    vec![
        Template {
            id: Uuid::new_v4().to_string(),
            name: "Date Prefix".to_string(),
            pattern: "{date}-{name}".to_string(),
            file_types: Some(vec![
                "jpg".to_string(),
                "jpeg".to_string(),
                "png".to_string(),
                "heic".to_string(),
                "webp".to_string(),
                "gif".to_string(),
            ]),
            is_default: true,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
        Template {
            id: Uuid::new_v4().to_string(),
            name: "Year/Month Folders".to_string(),
            pattern: "{year}/{month}/{name}".to_string(),
            file_types: Some(vec![
                "jpg".to_string(),
                "jpeg".to_string(),
                "png".to_string(),
                "heic".to_string(),
                "webp".to_string(),
                "gif".to_string(),
            ]),
            is_default: false,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
        Template {
            id: Uuid::new_v4().to_string(),
            name: "Camera + Date".to_string(),
            pattern: "{camera}-{date}-{name}".to_string(),
            file_types: Some(vec![
                "jpg".to_string(),
                "jpeg".to_string(),
                "png".to_string(),
                "heic".to_string(),
            ]),
            is_default: false,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
        Template {
            id: Uuid::new_v4().to_string(),
            name: "Document Date".to_string(),
            pattern: "{date}-{name}".to_string(),
            file_types: Some(vec![
                "pdf".to_string(),
                "docx".to_string(),
                "xlsx".to_string(),
                "pptx".to_string(),
            ]),
            is_default: false,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
    ]
}

/// Generate default folder structures
fn default_folder_structures() -> Vec<FolderStructure> {
    vec![
        FolderStructure {
            id: Uuid::new_v4().to_string(),
            name: "By Year".to_string(),
            pattern: "{year}".to_string(),
            description: Some("Organize files by year".to_string()),
            enabled: true,
            priority: 10,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
        FolderStructure {
            id: Uuid::new_v4().to_string(),
            name: "By Year and Month".to_string(),
            pattern: "{year}/{month}".to_string(),
            description: Some("Organize files by year and month".to_string()),
            enabled: true,
            priority: 20,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
        FolderStructure {
            id: Uuid::new_v4().to_string(),
            name: "By Category".to_string(),
            pattern: "{category}".to_string(),
            description: Some("Organize files by type (images, documents, etc.)".to_string()),
            enabled: true,
            priority: 30,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
        FolderStructure {
            id: Uuid::new_v4().to_string(),
            name: "By Year/Month/Day".to_string(),
            pattern: "{year}/{month}/{day}".to_string(),
            description: Some("Organize files by full date hierarchy".to_string()),
            enabled: false,
            priority: 40,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        },
    ]
}

/// Generate default configuration
fn default_config() -> AppConfig {
    AppConfig {
        version: 1,
        templates: default_templates(),
        folder_structures: default_folder_structures(),
        preferences: Preferences::default(),
        recent_folders: Vec::new(),
        ollama: OllamaConfig::default(),
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        default_config()
    }
}

// =============================================================================
// Path Utilities
// =============================================================================

/// Get the configuration directory path
/// Uses standard OS paths:
/// - Linux: ~/.config/tidy-app/
/// - macOS: ~/Library/Application Support/tidy-app/
/// - Windows: %APPDATA%/tidy-app/
fn get_config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("tidy-app")
}

/// Get the configuration file path
fn get_config_path() -> PathBuf {
    get_config_dir().join("config.json")
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Load application configuration from disk
///
/// Returns default configuration if:
/// - Config file doesn't exist
/// - Config file is invalid JSON
/// - Config file fails validation
///
/// Command name: get_config (snake_case per architecture)
#[tauri::command]
pub async fn get_config() -> Result<AppConfig, ConfigError> {
    let config_path = get_config_path();

    // Return defaults if file doesn't exist
    if !config_path.exists() {
        return Ok(default_config());
    }

    // Read file contents
    let content = fs::read_to_string(&config_path).map_err(|e| {
        ConfigError::ReadError(format!("Failed to read {}: {}", config_path.display(), e))
    })?;

    // Handle empty file
    if content.trim().is_empty() {
        return Ok(default_config());
    }

    // Parse JSON
    let mut config: AppConfig = serde_json::from_str(&content).map_err(|e| {
        // Return defaults on parse error (graceful degradation)
        eprintln!(
            "Warning: Invalid config at {}: {}",
            config_path.display(),
            e
        );
        ConfigError::ParseError(e.to_string())
    })?;

    // Migration: ensure folder_structures has defaults if empty
    if config.folder_structures.is_empty() {
        config.folder_structures = default_folder_structures();
    }

    Ok(config)
}

/// Save application configuration to disk
///
/// Creates config directory if it doesn't exist.
/// Validates config before saving.
///
/// Command name: save_config (snake_case per architecture)
#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), ConfigError> {
    let config_dir = get_config_dir();
    let config_path = get_config_path();

    // Create directory if needed
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| {
            ConfigError::WriteError(format!(
                "Failed to create config directory {}: {}",
                config_dir.display(),
                e
            ))
        })?;
    }

    // Serialize with pretty formatting
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| ConfigError::WriteError(format!("Failed to serialize config: {}", e)))?;

    // Write to file
    fs::write(&config_path, content).map_err(|e| {
        ConfigError::WriteError(format!("Failed to write {}: {}", config_path.display(), e))
    })?;

    Ok(())
}

/// Reset configuration to defaults
///
/// Deletes existing config file and returns default configuration.
///
/// Command name: reset_config (snake_case per architecture)
#[tauri::command]
pub async fn reset_config() -> Result<AppConfig, ConfigError> {
    let config_path = get_config_path();

    // Delete existing config if it exists
    if config_path.exists() {
        fs::remove_file(&config_path).map_err(|e| {
            ConfigError::WriteError(format!(
                "Failed to delete {}: {}",
                config_path.display(),
                e
            ))
        })?;
    }

    Ok(default_config())
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = default_config();
        assert_eq!(config.version, 1);
        assert_eq!(config.templates.len(), 4);
        assert!(config.preferences.confirm_before_apply);
        assert!(!config.preferences.recursive_scan);
    }

    #[test]
    fn test_default_templates() {
        let templates = default_templates();
        assert_eq!(templates.len(), 4);

        // Check first template (uses {name} for smart AI/original naming)
        assert_eq!(templates[0].name, "Date Prefix");
        assert_eq!(templates[0].pattern, "{date}-{name}");
        assert!(templates[0].is_default);

        // Check that only one is default
        let default_count = templates.iter().filter(|t| t.is_default).count();
        assert_eq!(default_count, 1);
    }

    #[test]
    fn test_preferences_default() {
        let prefs = Preferences::default();
        assert_eq!(prefs.default_output_format, OutputFormat::Table);
        assert!(prefs.color_output);
        assert!(prefs.confirm_before_apply);
        assert!(!prefs.recursive_scan);
        assert_eq!(prefs.case_normalization, CaseStyle::KebabCase);
    }

    #[test]
    fn test_config_serialization() {
        let config = default_config();
        let json = serde_json::to_string(&config).unwrap();

        // Verify camelCase field names
        assert!(json.contains("\"version\":"));
        assert!(json.contains("\"templates\":"));
        assert!(json.contains("\"isDefault\":"));
        assert!(json.contains("\"fileTypes\":"));
        assert!(json.contains("\"createdAt\":"));
        assert!(json.contains("\"recentFolders\":"));
    }

    #[test]
    fn test_config_deserialization() {
        let json = r#"{
            "version": 1,
            "templates": [],
            "preferences": {
                "defaultOutputFormat": "json",
                "colorOutput": false,
                "confirmBeforeApply": true,
                "recursiveScan": true
            },
            "recentFolders": ["/home/user/documents"]
        }"#;

        let config: AppConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.version, 1);
        assert_eq!(config.templates.len(), 0);
        assert_eq!(config.preferences.default_output_format, OutputFormat::Json);
        assert!(!config.preferences.color_output);
        assert!(config.preferences.recursive_scan);
        assert_eq!(config.recent_folders.len(), 1);
    }

    #[test]
    fn test_template_serialization() {
        let template = Template {
            id: "test-uuid".to_string(),
            name: "Test".to_string(),
            pattern: "{date}".to_string(),
            file_types: Some(vec!["jpg".to_string()]),
            is_default: true,
            created_at: DEFAULT_TIMESTAMP.to_string(),
            updated_at: DEFAULT_TIMESTAMP.to_string(),
        };

        let json = serde_json::to_string(&template).unwrap();
        assert!(json.contains("\"isDefault\":true"));
        assert!(json.contains("\"fileTypes\":[\"jpg\"]"));
    }

    #[test]
    fn test_output_format_serialization() {
        assert_eq!(
            serde_json::to_string(&OutputFormat::Table).unwrap(),
            "\"table\""
        );
        assert_eq!(
            serde_json::to_string(&OutputFormat::Json).unwrap(),
            "\"json\""
        );
        assert_eq!(
            serde_json::to_string(&OutputFormat::Plain).unwrap(),
            "\"plain\""
        );
    }
}
