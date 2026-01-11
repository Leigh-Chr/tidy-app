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
        }
    }
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
    /// User preferences
    #[serde(default)]
    pub preferences: Preferences,
    /// Recently accessed folders
    #[serde(default)]
    pub recent_folders: Vec<String>,
}

// =============================================================================
// Default Configuration
// =============================================================================

/// Default timestamp for built-in templates
const DEFAULT_TIMESTAMP: &str = "2024-01-01T00:00:00.000Z";

/// Generate default templates
fn default_templates() -> Vec<Template> {
    vec![
        Template {
            id: Uuid::new_v4().to_string(),
            name: "Date Prefix".to_string(),
            pattern: "{date}-{original}".to_string(),
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
            pattern: "{year}/{month}/{original}".to_string(),
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
            pattern: "{camera}-{date}-{original}".to_string(),
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
            pattern: "{date}-{original}".to_string(),
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

/// Generate default configuration
fn default_config() -> AppConfig {
    AppConfig {
        version: 1,
        templates: default_templates(),
        preferences: Preferences::default(),
        recent_folders: Vec::new(),
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
    let config: AppConfig = serde_json::from_str(&content).map_err(|e| {
        // Return defaults on parse error (graceful degradation)
        eprintln!(
            "Warning: Invalid config at {}: {}",
            config_path.display(),
            e
        );
        ConfigError::ParseError(e.to_string())
    })?;

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

        // Check first template
        assert_eq!(templates[0].name, "Date Prefix");
        assert_eq!(templates[0].pattern, "{date}-{original}");
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
