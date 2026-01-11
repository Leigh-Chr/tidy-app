// LLM commands for tidy-app GUI
// Command names use snake_case per architecture requirements
//
// Provides health check and model discovery for Ollama and OpenAI integration

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

// =============================================================================
// Response Types
// =============================================================================

/// Health status for Ollama connection
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    /// Whether Ollama is reachable and responding
    pub available: bool,
    /// Number of models installed
    pub model_count: Option<u32>,
    /// Timestamp of health check
    pub checked_at: String,
}

/// Model information from Ollama
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaModel {
    /// Model name with tag (e.g., 'mistral:latest')
    pub name: String,
    /// Model size in bytes
    pub size: u64,
    /// Model family (e.g., 'mistral', 'llama')
    pub family: Option<String>,
}

// =============================================================================
// Ollama API Response Types
// =============================================================================

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelInfo>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelInfo {
    name: String,
    size: u64,
    #[serde(default)]
    details: Option<OllamaModelDetails>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelDetails {
    family: Option<String>,
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Check Ollama health status
///
/// Attempts to connect to Ollama API and verify it's responding.
/// Returns availability status and model count.
///
/// Command name: check_ollama_health (snake_case per architecture)
#[tauri::command]
pub async fn check_ollama_health(base_url: String, timeout_ms: u64) -> Result<HealthStatus, String> {
    let client = Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    let checked_at = chrono::Utc::now().to_rfc3339();

    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<OllamaTagsResponse>().await {
                    Ok(data) => Ok(HealthStatus {
                        available: true,
                        model_count: Some(data.models.len() as u32),
                        checked_at,
                    }),
                    Err(_) => Ok(HealthStatus {
                        available: true,
                        model_count: None,
                        checked_at,
                    }),
                }
            } else {
                Ok(HealthStatus {
                    available: false,
                    model_count: None,
                    checked_at,
                })
            }
        }
        Err(e) => {
            if e.is_timeout() {
                Err("Connection timed out. Is Ollama running?".to_string())
            } else if e.is_connect() {
                Ok(HealthStatus {
                    available: false,
                    model_count: None,
                    checked_at,
                })
            } else {
                Err(format!("Connection failed: {}", e))
            }
        }
    }
}

/// List installed Ollama models
///
/// Retrieves all locally installed models from Ollama.
/// Returns model names, sizes, and families.
///
/// Command name: list_ollama_models (snake_case per architecture)
#[tauri::command]
pub async fn list_ollama_models(
    base_url: String,
    timeout_ms: u64,
) -> Result<Vec<OllamaModel>, String> {
    let client = Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Connection timed out. Is Ollama running?".to_string()
            } else if e.is_connect() {
                "Cannot connect to Ollama. Is it running?".to_string()
            } else {
                format!("Request failed: {}", e)
            }
        })?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned error: {}", response.status()));
    }

    let data: OllamaTagsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let models: Vec<OllamaModel> = data
        .models
        .into_iter()
        .map(|m| OllamaModel {
            name: m.name,
            size: m.size,
            family: m.details.and_then(|d| d.family),
        })
        .collect();

    Ok(models)
}

// =============================================================================
// OpenAI API Types
// =============================================================================

#[derive(Debug, Deserialize)]
struct OpenAiModelsResponse {
    data: Vec<OpenAiModelInfo>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModelInfo {
    id: String,
    owned_by: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorResponse {
    error: OpenAiErrorDetail,
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorDetail {
    message: String,
    #[serde(rename = "type")]
    error_type: Option<String>,
}

/// OpenAI model information
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiModel {
    /// Model ID (e.g., 'gpt-4o', 'gpt-4o-mini')
    pub id: String,
    /// Display name
    pub name: String,
    /// Whether this model supports vision
    pub supports_vision: bool,
}

// =============================================================================
// OpenAI Tauri Commands
// =============================================================================

/// Check OpenAI health status
///
/// Attempts to connect to OpenAI API and verify the API key works.
/// Returns availability status.
///
/// Command name: check_openai_health (snake_case per architecture)
#[tauri::command]
pub async fn check_openai_health(
    api_key: String,
    base_url: String,
    timeout_ms: u64,
) -> Result<HealthStatus, String> {
    let client = Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let checked_at = chrono::Utc::now().to_rfc3339();

    // Check for empty API key
    if api_key.is_empty() {
        return Ok(HealthStatus {
            available: false,
            model_count: None,
            checked_at,
        });
    }

    match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<OpenAiModelsResponse>().await {
                    Ok(data) => Ok(HealthStatus {
                        available: true,
                        model_count: Some(data.data.len() as u32),
                        checked_at,
                    }),
                    Err(_) => Ok(HealthStatus {
                        available: true,
                        model_count: None,
                        checked_at,
                    }),
                }
            } else if response.status().as_u16() == 401 {
                Err("Invalid API key".to_string())
            } else if response.status().as_u16() == 429 {
                Err("Rate limit exceeded. Please try again later.".to_string())
            } else {
                // Try to get error message from response
                let error_msg = match response.json::<OpenAiErrorResponse>().await {
                    Ok(err) => err.error.message,
                    Err(_) => "Unknown error".to_string(),
                };
                Err(error_msg)
            }
        }
        Err(e) => {
            if e.is_timeout() {
                Err("Connection timed out".to_string())
            } else if e.is_connect() {
                Ok(HealthStatus {
                    available: false,
                    model_count: None,
                    checked_at,
                })
            } else {
                Err(format!("Connection failed: {}", e))
            }
        }
    }
}

/// List available OpenAI models
///
/// Returns recommended models for use with tidy-app.
/// These are the models that work well for file analysis.
///
/// Command name: list_openai_models (snake_case per architecture)
#[tauri::command]
pub async fn list_openai_models() -> Result<Vec<OpenAiModel>, String> {
    // Return recommended models (we don't actually fetch from API as
    // OpenAI has many models and most aren't suitable for our use case)
    Ok(vec![
        OpenAiModel {
            id: "gpt-4o".to_string(),
            name: "GPT-4o".to_string(),
            supports_vision: true,
        },
        OpenAiModel {
            id: "gpt-4o-mini".to_string(),
            name: "GPT-4o Mini".to_string(),
            supports_vision: true,
        },
        OpenAiModel {
            id: "gpt-4-turbo".to_string(),
            name: "GPT-4 Turbo".to_string(),
            supports_vision: true,
        },
        OpenAiModel {
            id: "gpt-3.5-turbo".to_string(),
            name: "GPT-3.5 Turbo".to_string(),
            supports_vision: false,
        },
    ])
}

// =============================================================================
// LLM Analysis Types
// =============================================================================

/// AI-suggested name and folder for a file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSuggestion {
    /// The suggested filename (without extension)
    pub suggested_name: String,
    /// Confidence level (0.0 - 1.0)
    pub confidence: f32,
    /// Brief reasoning for the suggestion
    pub reasoning: String,
    /// Keywords extracted from the content
    pub keywords: Vec<String>,
    /// Whether to keep the original filename (true when original is already good)
    #[serde(default)]
    pub keep_original: bool,
    /// Suggested folder path for organization (e.g., "Projects/2024")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggested_folder: Option<String>,
    /// Confidence level for folder suggestion (0.0 - 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_confidence: Option<f32>,
}

/// Result of analyzing a single file
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAnalysisResult {
    /// Original file path
    pub file_path: String,
    /// AI suggestion (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<AiSuggestion>,
    /// Error message (if failed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Whether this file was skipped (e.g., not supported)
    pub skipped: bool,
    /// Source of analysis (llm, vision, fallback)
    pub source: String,
}

/// Batch analysis result
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchAnalysisResult {
    /// Results for each file
    pub results: Vec<FileAnalysisResult>,
    /// Total files processed
    pub total: usize,
    /// Files successfully analyzed
    pub analyzed: usize,
    /// Files that failed
    pub failed: usize,
    /// Files that were skipped
    pub skipped: usize,
    /// Whether LLM was available
    pub llm_available: bool,
}

/// Request for OpenAI Chat Completion
#[derive(Debug, Serialize)]
struct OpenAiChatRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Debug, Serialize)]
struct OpenAiMessage {
    role: String,
    content: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: OpenAiResponseMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponseMessage {
    content: String,
}

/// Request for Ollama generate
#[derive(Debug, Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    system: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: f32,
    num_predict: u32,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
    response: String,
}

// =============================================================================
// LLM Analysis Prompts
// =============================================================================

const NAMING_SYSTEM_PROMPT: &str = r#"You are a file naming and organization assistant. Your job is to evaluate existing filenames and suggest improvements ONLY when beneficial, and to suggest appropriate folder organization.

CRITICAL RULE: The original filename often contains valuable information (dates, project codes, version numbers, identifiers). You MUST preserve these elements unless they are clearly wrong.

FILENAME Guidelines:
- Use kebab-case (lowercase with hyphens)
- Be concise but descriptive (2-5 words)
- Include relevant dates if found (YYYY-MM-DD format at start)
- Omit file extension in suggestion
- Extract key themes, topics, or subjects
- For documents: focus on topic/purpose
- For code: focus on functionality/module name
- For data: focus on dataset description

FOLDER Guidelines:
- Suggest a logical folder path based on content type and context
- Use forward slashes for path separators (e.g., "Projects/2024")
- Keep folder names short and meaningful (1-3 words each)
- Consider categories like: Documents, Projects, Archives, Personal, Work, Finances, Photos, etc.
- Include year/month when content has clear temporal context
- Include project/client names when identifiable
- Maximum 3 levels deep (e.g., "Work/Projects/ClientName")
- Leave suggestedFolder empty or null if no clear organization is apparent

IMPORTANT - When to keep the original name (set keepOriginal: true):
- The original name is already descriptive and meaningful
- The original contains important identifiers, codes, or references
- The content doesn't provide significantly better naming information
- Any improvement would lose important context from the original

When suggesting a new name:
- Merge relevant parts of the original with new insights from content
- Preserve dates, version numbers, project codes from the original
- Only change what genuinely improves clarity"#;

fn create_analysis_prompt(content: &str, file_type: &str, original_name: &str, existing_folders: &[String]) -> String {
    let folder_context = if existing_folders.is_empty() {
        "No existing folders found. You may suggest new folder names.".to_string()
    } else {
        format!(
            "Existing folders in this directory:\n{}\n\nPrefer using existing folders when appropriate, or suggest new ones if needed.",
            existing_folders.iter().map(|f| format!("- {}", f)).collect::<Vec<_>>().join("\n")
        )
    };

    format!(
        r#"Evaluate whether this file needs renaming and suggest an improved name if beneficial. Also suggest an appropriate folder for organization.

Current filename: "{}"
File type: {}

{}

Content:
---
{}
---

Evaluate the current filename against the content. If the original name is already good, set keepOriginal to true and return the original name. Only suggest a different name if it would be a significant improvement.

For folder organization, analyze the content to determine the most logical folder path. Consider the document type, subject matter, dates, and any identifiable projects or categories. When possible, use existing folders that match the content.

Respond ONLY with valid JSON in this exact format (no other text):
{{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation", "keywords": ["keyword1", "keyword2"], "keepOriginal": false, "suggestedFolder": "Category/Subcategory", "folderConfidence": 0.75}}"#,
        original_name, file_type, folder_context, content
    )
}

fn create_vision_prompt(original_name: &str, existing_folders: &[String]) -> String {
    let folder_context = if existing_folders.is_empty() {
        "No existing folders found. You may suggest new folder names.".to_string()
    } else {
        format!(
            "Existing folders in this directory:\n{}\n\nPrefer using existing folders when appropriate, or suggest new ones if needed.",
            existing_folders.iter().map(|f| format!("- {}", f)).collect::<Vec<_>>().join("\n")
        )
    };

    format!(
        r#"Evaluate this image and decide if the current filename needs improvement. Also suggest an appropriate folder for organization.

Current filename: "{}"

{}

FILENAME Guidelines:
- Use kebab-case (lowercase with hyphens)
- Be concise but descriptive (2-5 words)
- If you can identify a date, include it at the start (YYYY-MM-DD)
- Focus on: subject, scene, key objects, mood/style
- Omit the file extension

FOLDER Guidelines:
- Suggest a logical folder path based on image content
- Use forward slashes for path separators (e.g., "Photos/2024")
- Consider categories like: Photos, Screenshots, Documents, Work, Personal, Travel, Events, etc.
- Include year/month when identifiable from image
- Maximum 3 levels deep
- When possible, use existing folders that match the content

IMPORTANT: If the current filename is already descriptive and meaningful (contains relevant subject, date, or context), set keepOriginal to true. Only suggest a new name if it would be a significant improvement.

Preserve any dates, identifiers, or codes from the original filename if they appear relevant.

Respond ONLY with valid JSON in this exact format (no other text):
{{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation", "keywords": ["keyword1", "keyword2"], "keepOriginal": false, "suggestedFolder": "Photos/Category", "folderConfidence": 0.75}}"#,
        original_name, folder_context
    )
}

/// Parse AI suggestion from JSON response
fn parse_ai_suggestion(response: &str) -> Option<AiSuggestion> {
    // Try to extract JSON from the response
    let json_str = if let Some(start) = response.find('{') {
        if let Some(end) = response.rfind('}') {
            &response[start..=end]
        } else {
            response
        }
    } else {
        response
    };

    serde_json::from_str::<AiSuggestion>(json_str).ok()
}

// =============================================================================
// File Content Extraction
// =============================================================================

/// Supported text file extensions
const TEXT_EXTENSIONS: &[&str] = &[
    "txt", "md", "markdown", "rst", "json", "yaml", "yml", "toml", "xml",
    "html", "htm", "css", "js", "ts", "jsx", "tsx", "py", "rs", "go",
    "java", "kt", "swift", "c", "cpp", "h", "hpp", "cs", "rb", "php",
    "sh", "bash", "zsh", "fish", "ps1", "sql", "csv", "log", "ini", "conf",
    "cfg", "env", "dockerfile", "makefile", "cmake",
];

/// Image extensions supported by vision models
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp"];

/// Check if file is an image
fn is_image_file(path: &str) -> bool {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    IMAGE_EXTENSIONS.contains(&ext.as_str())
}

/// Check if file is extractable text
fn is_text_file(path: &str) -> bool {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    TEXT_EXTENSIONS.contains(&ext.as_str())
}

/// Extract text content from a file (limited)
fn extract_file_content(path: &str, max_chars: usize) -> Result<String, String> {
    use std::fs;
    use std::io::Read;

    let mut file = fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut content = String::new();
    let mut buffer = vec![0u8; max_chars + 100];

    let bytes_read = file.read(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Try to convert to UTF-8
    content = String::from_utf8_lossy(&buffer[..bytes_read])
        .chars()
        .take(max_chars)
        .collect();

    Ok(content)
}

/// Encode image to base64 for vision APIs
fn encode_image_base64(path: &str) -> Result<String, String> {
    use std::fs;
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let bytes = fs::read(path)
        .map_err(|e| format!("Failed to read image: {}", e))?;

    Ok(STANDARD.encode(&bytes))
}

/// Get MIME type for image
fn get_image_mime_type(path: &str) -> &'static str {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/jpeg",
    }
}

// =============================================================================
// LLM Analysis Commands
// =============================================================================

use super::config::{OllamaConfig, LlmProvider};

/// Scan existing folder structure in a directory (max 2 levels deep)
fn scan_folder_structure(base_path: &str) -> Vec<String> {
    let mut folders = Vec::new();
    let base = std::path::Path::new(base_path);

    if !base.is_dir() {
        return folders;
    }

    // Scan first level
    if let Ok(entries) = std::fs::read_dir(base) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    // Skip hidden folders
                    if !name.starts_with('.') {
                        folders.push(name.to_string());

                        // Scan second level
                        if let Ok(sub_entries) = std::fs::read_dir(&path) {
                            for sub_entry in sub_entries.filter_map(|e| e.ok()) {
                                let sub_path = sub_entry.path();
                                if sub_path.is_dir() {
                                    if let Some(sub_name) = sub_path.file_name().and_then(|n| n.to_str()) {
                                        if !sub_name.starts_with('.') {
                                            folders.push(format!("{}/{}", name, sub_name));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    folders.sort();
    folders
}

/// Analyze files with LLM to get naming suggestions
///
/// Command name: analyze_files_with_llm (snake_case per architecture)
#[tauri::command]
pub async fn analyze_files_with_llm(
    file_paths: Vec<String>,
    config: OllamaConfig,
    base_path: Option<String>,
) -> Result<BatchAnalysisResult, String> {
    let total = file_paths.len();
    let mut results: Vec<FileAnalysisResult> = Vec::new();
    let mut analyzed = 0;
    let mut failed = 0;
    let mut skipped = 0;

    // Scan existing folder structure for context
    let existing_folders = base_path
        .as_ref()
        .map(|p| scan_folder_structure(p))
        .unwrap_or_default();

    // Check if LLM is enabled
    if !config.enabled {
        // Return all as skipped when LLM is disabled
        for file_path in file_paths {
            results.push(FileAnalysisResult {
                file_path,
                suggestion: None,
                error: Some("LLM analysis is disabled".to_string()),
                skipped: true,
                source: "disabled".to_string(),
            });
            skipped += 1;
        }
        return Ok(BatchAnalysisResult {
            results,
            total,
            analyzed,
            failed,
            skipped,
            llm_available: false,
        });
    }

    let client = Client::builder()
        .timeout(Duration::from_millis(config.timeout))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Process each file
    for file_path in file_paths {
        let result = analyze_single_file(&client, &file_path, &config, &existing_folders).await;

        match &result.suggestion {
            Some(_) => analyzed += 1,
            None if result.skipped => skipped += 1,
            None => failed += 1,
        }

        results.push(result);
    }

    Ok(BatchAnalysisResult {
        results,
        total,
        analyzed,
        failed,
        skipped,
        llm_available: true,
    })
}

/// Analyze a single file
async fn analyze_single_file(
    client: &Client,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
) -> FileAnalysisResult {
    // Check if it's an image and vision is enabled
    if is_image_file(file_path) && config.vision_enabled {
        return analyze_image_file(client, file_path, config, existing_folders).await;
    }

    // Check if it's a text file we can analyze
    if !is_text_file(file_path) {
        return FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some("File type not supported for analysis".to_string()),
            skipped: true,
            source: "unsupported".to_string(),
        };
    }

    // Extract content
    let content = match extract_file_content(file_path, 4000) {
        Ok(c) => c,
        Err(e) => {
            return FileAnalysisResult {
                file_path: file_path.to_string(),
                suggestion: None,
                error: Some(e),
                skipped: false,
                source: "error".to_string(),
            };
        }
    };

    if content.trim().is_empty() {
        return FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some("File is empty".to_string()),
            skipped: true,
            source: "empty".to_string(),
        };
    }

    // Get file extension
    let ext = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("txt");

    // Call appropriate provider
    match config.provider {
        LlmProvider::Openai => analyze_with_openai(client, &content, ext, file_path, config, existing_folders).await,
        LlmProvider::Ollama => analyze_with_ollama(client, &content, ext, file_path, config, existing_folders).await,
    }
}

/// Analyze an image file with vision model
async fn analyze_image_file(
    client: &Client,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
) -> FileAnalysisResult {
    // Encode image
    let base64_image = match encode_image_base64(file_path) {
        Ok(b) => b,
        Err(e) => {
            return FileAnalysisResult {
                file_path: file_path.to_string(),
                suggestion: None,
                error: Some(e),
                skipped: false,
                source: "error".to_string(),
            };
        }
    };

    let mime_type = get_image_mime_type(file_path);

    match config.provider {
        LlmProvider::Openai => analyze_image_with_openai(client, &base64_image, mime_type, file_path, config, existing_folders).await,
        LlmProvider::Ollama => analyze_image_with_ollama(client, &base64_image, file_path, config, existing_folders).await,
    }
}

/// Analyze content with OpenAI
async fn analyze_with_openai(
    client: &Client,
    content: &str,
    file_type: &str,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
) -> FileAnalysisResult {
    let api_key = &config.openai.api_key;
    if api_key.is_empty() {
        return FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some("OpenAI API key not configured".to_string()),
            skipped: false,
            source: "error".to_string(),
        };
    }

    // Extract original filename (without extension) for the prompt
    let original_name = std::path::Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let url = format!("{}/chat/completions", config.openai.base_url.trim_end_matches('/'));
    let prompt = create_analysis_prompt(content, file_type, original_name, existing_folders);

    let request = OpenAiChatRequest {
        model: config.openai.model.clone(),
        messages: vec![
            OpenAiMessage {
                role: "system".to_string(),
                content: serde_json::Value::String(NAMING_SYSTEM_PROMPT.to_string()),
            },
            OpenAiMessage {
                role: "user".to_string(),
                content: serde_json::Value::String(prompt),
            },
        ],
        temperature: 0.3,
        max_tokens: 500,
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<OpenAiChatResponse>().await {
                    Ok(data) => {
                        if let Some(choice) = data.choices.first() {
                            if let Some(suggestion) = parse_ai_suggestion(&choice.message.content) {
                                return FileAnalysisResult {
                                    file_path: file_path.to_string(),
                                    suggestion: Some(suggestion),
                                    error: None,
                                    skipped: false,
                                    source: "openai".to_string(),
                                };
                            }
                        }
                        FileAnalysisResult {
                            file_path: file_path.to_string(),
                            suggestion: None,
                            error: Some("Failed to parse AI response".to_string()),
                            skipped: false,
                            source: "error".to_string(),
                        }
                    }
                    Err(e) => FileAnalysisResult {
                        file_path: file_path.to_string(),
                        suggestion: None,
                        error: Some(format!("Failed to parse response: {}", e)),
                        skipped: false,
                        source: "error".to_string(),
                    },
                }
            } else {
                let status = resp.status();
                let error_msg = if status.as_u16() == 429 {
                    "Rate limit or billing issue - check your OpenAI billing at platform.openai.com/settings/organization/billing".to_string()
                } else if status.as_u16() == 401 {
                    "Invalid API key - check your OpenAI API key in settings".to_string()
                } else {
                    format!("API error: {}", status)
                };
                FileAnalysisResult {
                    file_path: file_path.to_string(),
                    suggestion: None,
                    error: Some(error_msg),
                    skipped: false,
                    source: "error".to_string(),
                }
            }
        }
        Err(e) => FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some(format!("Request failed: {}", e)),
            skipped: false,
            source: "error".to_string(),
        },
    }
}

/// Analyze content with Ollama
async fn analyze_with_ollama(
    client: &Client,
    content: &str,
    file_type: &str,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
) -> FileAnalysisResult {
    let model = match &config.models.inference {
        Some(m) => m.clone(),
        None => {
            return FileAnalysisResult {
                file_path: file_path.to_string(),
                suggestion: None,
                error: Some("No inference model configured".to_string()),
                skipped: false,
                source: "error".to_string(),
            };
        }
    };

    // Extract original filename (without extension) for the prompt
    let original_name = std::path::Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let url = format!("{}/api/generate", config.base_url.trim_end_matches('/'));
    let prompt = create_analysis_prompt(content, file_type, original_name, existing_folders);

    let request = OllamaGenerateRequest {
        model,
        prompt,
        system: NAMING_SYSTEM_PROMPT.to_string(),
        stream: false,
        options: OllamaOptions {
            temperature: 0.3,
            num_predict: 500,
        },
    };

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<OllamaGenerateResponse>().await {
                    Ok(data) => {
                        if let Some(suggestion) = parse_ai_suggestion(&data.response) {
                            FileAnalysisResult {
                                file_path: file_path.to_string(),
                                suggestion: Some(suggestion),
                                error: None,
                                skipped: false,
                                source: "ollama".to_string(),
                            }
                        } else {
                            FileAnalysisResult {
                                file_path: file_path.to_string(),
                                suggestion: None,
                                error: Some("Failed to parse AI response".to_string()),
                                skipped: false,
                                source: "error".to_string(),
                            }
                        }
                    }
                    Err(e) => FileAnalysisResult {
                        file_path: file_path.to_string(),
                        suggestion: None,
                        error: Some(format!("Failed to parse response: {}", e)),
                        skipped: false,
                        source: "error".to_string(),
                    },
                }
            } else {
                FileAnalysisResult {
                    file_path: file_path.to_string(),
                    suggestion: None,
                    error: Some(format!("Ollama error: {}", resp.status())),
                    skipped: false,
                    source: "error".to_string(),
                }
            }
        }
        Err(e) => FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some(format!("Request failed: {}", e)),
            skipped: false,
            source: "error".to_string(),
        },
    }
}

/// Analyze image with OpenAI Vision
async fn analyze_image_with_openai(
    client: &Client,
    base64_image: &str,
    mime_type: &str,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
) -> FileAnalysisResult {
    let api_key = &config.openai.api_key;
    if api_key.is_empty() {
        return FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some("OpenAI API key not configured".to_string()),
            skipped: false,
            source: "error".to_string(),
        };
    }

    // Extract original filename (without extension) for the prompt
    let original_name = std::path::Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let url = format!("{}/chat/completions", config.openai.base_url.trim_end_matches('/'));
    let prompt = create_vision_prompt(original_name, existing_folders);

    // Create multimodal content
    let content = serde_json::json!([
        {
            "type": "text",
            "text": prompt
        },
        {
            "type": "image_url",
            "image_url": {
                "url": format!("data:{};base64,{}", mime_type, base64_image)
            }
        }
    ]);

    let request = OpenAiChatRequest {
        model: config.openai.vision_model.clone(),
        messages: vec![
            OpenAiMessage {
                role: "system".to_string(),
                content: serde_json::Value::String(NAMING_SYSTEM_PROMPT.to_string()),
            },
            OpenAiMessage {
                role: "user".to_string(),
                content,
            },
        ],
        temperature: 0.3,
        max_tokens: 500,
    };

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<OpenAiChatResponse>().await {
                    Ok(data) => {
                        if let Some(choice) = data.choices.first() {
                            if let Some(suggestion) = parse_ai_suggestion(&choice.message.content) {
                                return FileAnalysisResult {
                                    file_path: file_path.to_string(),
                                    suggestion: Some(suggestion),
                                    error: None,
                                    skipped: false,
                                    source: "openai-vision".to_string(),
                                };
                            }
                        }
                        FileAnalysisResult {
                            file_path: file_path.to_string(),
                            suggestion: None,
                            error: Some("Failed to parse vision response".to_string()),
                            skipped: false,
                            source: "error".to_string(),
                        }
                    }
                    Err(e) => FileAnalysisResult {
                        file_path: file_path.to_string(),
                        suggestion: None,
                        error: Some(format!("Failed to parse response: {}", e)),
                        skipped: false,
                        source: "error".to_string(),
                    },
                }
            } else {
                let status = resp.status();
                let error_msg = if status.as_u16() == 429 {
                    "Rate limit or billing issue - check your OpenAI billing at platform.openai.com/settings/organization/billing".to_string()
                } else if status.as_u16() == 401 {
                    "Invalid API key - check your OpenAI API key in settings".to_string()
                } else if status.as_u16() == 400 {
                    "Bad request - the image may be too large or in an unsupported format".to_string()
                } else {
                    format!("Vision API error: {}", status)
                };
                FileAnalysisResult {
                    file_path: file_path.to_string(),
                    suggestion: None,
                    error: Some(error_msg),
                    skipped: false,
                    source: "error".to_string(),
                }
            }
        }
        Err(e) => FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some(format!("Vision request failed: {}", e)),
            skipped: false,
            source: "error".to_string(),
        },
    }
}

/// Analyze image with Ollama Vision
async fn analyze_image_with_ollama(
    client: &Client,
    base64_image: &str,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
) -> FileAnalysisResult {
    let model = match &config.models.vision {
        Some(m) => m.clone(),
        None => {
            return FileAnalysisResult {
                file_path: file_path.to_string(),
                suggestion: None,
                error: Some("No vision model configured".to_string()),
                skipped: false,
                source: "error".to_string(),
            };
        }
    };

    // Extract original filename (without extension) for the prompt
    let original_name = std::path::Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");

    let url = format!("{}/api/generate", config.base_url.trim_end_matches('/'));
    let prompt = create_vision_prompt(original_name, existing_folders);

    // Ollama vision request format
    let request = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "images": [base64_image],
        "stream": false,
        "options": {
            "temperature": 0.3,
            "num_predict": 500
        }
    });

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.json::<OllamaGenerateResponse>().await {
                    Ok(data) => {
                        if let Some(suggestion) = parse_ai_suggestion(&data.response) {
                            FileAnalysisResult {
                                file_path: file_path.to_string(),
                                suggestion: Some(suggestion),
                                error: None,
                                skipped: false,
                                source: "ollama-vision".to_string(),
                            }
                        } else {
                            FileAnalysisResult {
                                file_path: file_path.to_string(),
                                suggestion: None,
                                error: Some("Failed to parse vision response".to_string()),
                                skipped: false,
                                source: "error".to_string(),
                            }
                        }
                    }
                    Err(e) => FileAnalysisResult {
                        file_path: file_path.to_string(),
                        suggestion: None,
                        error: Some(format!("Failed to parse response: {}", e)),
                        skipped: false,
                        source: "error".to_string(),
                    },
                }
            } else {
                FileAnalysisResult {
                    file_path: file_path.to_string(),
                    suggestion: None,
                    error: Some(format!("Ollama vision error: {}", resp.status())),
                    skipped: false,
                    source: "error".to_string(),
                }
            }
        }
        Err(e) => FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some(format!("Vision request failed: {}", e)),
            skipped: false,
            source: "error".to_string(),
        },
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ai_suggestion_valid() {
        let json = r#"{"suggestedName": "my-document", "confidence": 0.9, "reasoning": "Document about X", "keywords": ["doc", "x"]}"#;
        let suggestion = parse_ai_suggestion(json).unwrap();
        assert_eq!(suggestion.suggested_name, "my-document");
        assert!((suggestion.confidence - 0.9).abs() < 0.01);
        assert_eq!(suggestion.reasoning, "Document about X");
        assert_eq!(suggestion.keywords, vec!["doc", "x"]);
    }

    #[test]
    fn test_parse_ai_suggestion_with_extra_text() {
        let response = r#"Here's my suggestion:
{"suggestedName": "test-file", "confidence": 0.85, "reasoning": "Test", "keywords": ["test"]}
Hope this helps!"#;
        let suggestion = parse_ai_suggestion(response).unwrap();
        assert_eq!(suggestion.suggested_name, "test-file");
    }

    #[test]
    fn test_parse_ai_suggestion_invalid() {
        let invalid = "not a json response";
        assert!(parse_ai_suggestion(invalid).is_none());
    }

    #[test]
    fn test_is_image_file() {
        assert!(is_image_file("/path/to/photo.jpg"));
        assert!(is_image_file("/path/to/photo.JPEG"));
        assert!(is_image_file("/path/to/photo.png"));
        assert!(is_image_file("/path/to/photo.gif"));
        assert!(is_image_file("/path/to/photo.webp"));
        assert!(!is_image_file("/path/to/doc.pdf"));
        assert!(!is_image_file("/path/to/code.ts"));
    }

    #[test]
    fn test_is_text_file() {
        assert!(is_text_file("/path/to/readme.md"));
        assert!(is_text_file("/path/to/code.ts"));
        assert!(is_text_file("/path/to/config.json"));
        assert!(is_text_file("/path/to/script.py"));
        assert!(!is_text_file("/path/to/photo.jpg"));
        assert!(!is_text_file("/path/to/doc.pdf"));
    }

    #[test]
    fn test_get_image_mime_type() {
        assert_eq!(get_image_mime_type("/path/photo.jpg"), "image/jpeg");
        assert_eq!(get_image_mime_type("/path/photo.jpeg"), "image/jpeg");
        assert_eq!(get_image_mime_type("/path/photo.png"), "image/png");
        assert_eq!(get_image_mime_type("/path/photo.gif"), "image/gif");
        assert_eq!(get_image_mime_type("/path/photo.webp"), "image/webp");
    }

    #[test]
    fn test_ai_suggestion_serialization() {
        let suggestion = AiSuggestion {
            suggested_name: "my-file".to_string(),
            confidence: 0.85,
            reasoning: "Based on content".to_string(),
            keywords: vec!["key1".to_string(), "key2".to_string()],
            keep_original: false,
            suggested_folder: Some("Projects/2024".to_string()),
            folder_confidence: Some(0.75),
        };

        let json = serde_json::to_string(&suggestion).unwrap();
        assert!(json.contains("\"suggestedName\":\"my-file\""));
        assert!(json.contains("\"confidence\":0.85"));
        assert!(json.contains("\"suggestedFolder\":\"Projects/2024\""));
    }

    #[test]
    fn test_file_analysis_result_serialization() {
        let result = FileAnalysisResult {
            file_path: "/path/to/file.txt".to_string(),
            suggestion: Some(AiSuggestion {
                suggested_name: "test".to_string(),
                confidence: 0.9,
                reasoning: "Test".to_string(),
                keywords: vec![],
                keep_original: false,
                suggested_folder: None,
                folder_confidence: None,
            }),
            error: None,
            skipped: false,
            source: "ollama".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"filePath\":\"/path/to/file.txt\""));
        assert!(json.contains("\"source\":\"ollama\""));
        assert!(!json.contains("\"error\"")); // Skipped in serialization
    }

    #[test]
    fn test_health_status_serialization() {
        let status = HealthStatus {
            available: true,
            model_count: Some(5),
            checked_at: "2026-01-11T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"available\":true"));
        assert!(json.contains("\"modelCount\":5"));
        assert!(json.contains("\"checkedAt\":"));
    }

    #[test]
    fn test_ollama_model_serialization() {
        let model = OllamaModel {
            name: "mistral:latest".to_string(),
            size: 4_000_000_000,
            family: Some("mistral".to_string()),
        };

        let json = serde_json::to_string(&model).unwrap();
        assert!(json.contains("\"name\":\"mistral:latest\""));
        assert!(json.contains("\"size\":4000000000"));
        assert!(json.contains("\"family\":\"mistral\""));
    }
}
