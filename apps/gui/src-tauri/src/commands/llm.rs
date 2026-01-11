// LLM commands for tidy-app GUI
// Command names use snake_case per architecture requirements
//
// Provides health check and model discovery for Ollama and OpenAI integration

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, Semaphore};
use lazy_static::lazy_static;
use tauri::Emitter;

// =============================================================================
// Session Cache for Analysis Results
// =============================================================================

/// Cache entry with timestamp
#[derive(Debug, Clone)]
struct CacheEntry {
    suggestion: AiSuggestion,
    cached_at: std::time::Instant,
}

/// Session cache for analysis results (in-memory, cleared on restart)
lazy_static! {
    static ref ANALYSIS_CACHE: Mutex<HashMap<String, CacheEntry>> = Mutex::new(HashMap::new());
    /// Semaphore to limit concurrent LLM requests (avoid overwhelming the server)
    static ref LLM_SEMAPHORE: Semaphore = Semaphore::new(3); // Max 3 concurrent requests
}

/// Cache TTL (24 hours)
const CACHE_TTL_SECS: u64 = 24 * 60 * 60;

/// Maximum content size to analyze (tokens ~ chars/4, target ~2000 tokens)
const MAX_CONTENT_CHARS: usize = 8000;

/// Maximum retries for rate-limited requests
const MAX_RETRIES: u32 = 3;

/// Base delay for exponential backoff (in milliseconds)
const BASE_RETRY_DELAY_MS: u64 = 1000;

/// Check cache for existing result
async fn get_cached_result(file_path: &str, content_hash: &str) -> Option<AiSuggestion> {
    let cache = ANALYSIS_CACHE.lock().await;
    let key = format!("{}:{}", file_path, content_hash);

    if let Some(entry) = cache.get(&key) {
        if entry.cached_at.elapsed().as_secs() < CACHE_TTL_SECS {
            return Some(entry.suggestion.clone());
        }
    }
    None
}

/// Store result in cache
async fn cache_result(file_path: &str, content_hash: &str, suggestion: &AiSuggestion) {
    let mut cache = ANALYSIS_CACHE.lock().await;
    let key = format!("{}:{}", file_path, content_hash);

    cache.insert(key, CacheEntry {
        suggestion: suggestion.clone(),
        cached_at: std::time::Instant::now(),
    });

    // Cleanup old entries if cache is too large (>1000 entries)
    if cache.len() > 1000 {
        let now = std::time::Instant::now();
        cache.retain(|_, entry| now.duration_since(entry.cached_at).as_secs() < CACHE_TTL_SECS);
    }
}

/// Simple hash for content (for cache key)
fn hash_content(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Hash file metadata for image caching (path + size + modified time)
fn hash_file_metadata(file_path: &str) -> Option<String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let metadata = std::fs::metadata(file_path).ok()?;
    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    metadata.len().hash(&mut hasher);
    if let Ok(modified) = metadata.modified() {
        modified.hash(&mut hasher);
    }
    Some(format!("{:x}", hasher.finish()))
}

/// Calculate exponential backoff delay
fn calculate_backoff_delay(attempt: u32) -> Duration {
    let delay_ms = BASE_RETRY_DELAY_MS * 2u64.pow(attempt);
    // Cap at 30 seconds
    Duration::from_millis(delay_ms.min(30_000))
}

/// Check if an error is retryable (rate limit or temporary server error)
fn is_retryable_error(status: u16) -> bool {
    status == 429 || status == 503 || status == 502 || status == 500
}

// =============================================================================
// Pre-filtering for Filename Quality
// =============================================================================

/// Patterns that indicate a low-quality filename worth analyzing
const LOW_QUALITY_PATTERNS: &[&str] = &[
    // Generic camera/device names
    "img_", "img-", "image_", "image-", "photo_", "photo-",
    "dsc_", "dsc-", "dcim", "pic_", "pic-",
    // Screenshots (EN + FR)
    "screenshot", "screen_shot", "screen-shot", "screen shot",
    "capture", "capture d'", "capture_", "captura",
    // Generic document names (EN + FR)
    "document", "doc_", "doc-", "file_", "file-", "fichier",
    "untitled", "sans titre", "sans_titre", "nouveau",
    // Copies
    "copy of", "copy_of", "copy-of", "copie de", "copie_de", "copie-",
    "(1)", "(2)", "(3)", "(4)", "(5)", " - copy", " - copie",
    // New/temp files
    "new ", "new_", "new-", "tmp", "temp_", "temp-",
    // Downloads and misc
    "download", "télécharg", "telecharge", "image0", "photo0",
    // WhatsApp, Telegram, etc.
    "whatsapp", "telegram", "signal-", "img-20", "vid-20",
];

/// Patterns that indicate a GOOD descriptive filename (should skip analysis)
/// These are ONLY used for text files, not images
const GOOD_FILENAME_PATTERNS: &[&str] = &[
    // Date patterns suggest intentional naming
    "2020", "2021", "2022", "2023", "2024", "2025", "2026",
    // Common good prefixes (EN)
    "invoice", "receipt", "report", "contract", "agreement",
    "meeting", "minutes", "project", "proposal", "budget",
    "presentation", "summary", "analysis", "review", "notes",
    // Common good prefixes (FR)
    "facture", "recu", "rapport", "contrat", "accord",
    "reunion", "compte-rendu", "projet", "proposition", "devis",
    "presentation", "resume", "analyse", "revue", "bilan",
];

/// Check if a filename appears to need renaming (pre-filter)
/// Returns true if the file should be analyzed by AI, false if it can be skipped
/// NOTE: This should NOT be used for images - images should always use vision model
fn needs_ai_analysis(file_path: &str) -> (bool, Option<String>) {
    let filename = std::path::Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let filename_lower = filename.to_lowercase();

    // Check for low-quality patterns - these NEED analysis
    for pattern in LOW_QUALITY_PATTERNS {
        if filename_lower.contains(pattern) {
            return (true, None);
        }
    }

    // Check for UUID-like patterns (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    if regex_lite::Regex::new(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")
        .map(|re| re.is_match(&filename_lower))
        .unwrap_or(false)
    {
        return (true, None);
    }

    // Check for random hex/alphanumeric suffixes (e.g., "document_a8f3b2c1")
    if regex_lite::Regex::new(r"[_-][a-f0-9]{6,}$")
        .map(|re| re.is_match(&filename_lower))
        .unwrap_or(false)
    {
        return (true, None);
    }

    // Check for mostly digits (>50%)
    let digit_count = filename.chars().filter(|c| c.is_ascii_digit()).count();
    if filename.len() > 4 && (digit_count as f32 / filename.len() as f32) > 0.5 {
        return (true, None);
    }

    // If filename is too short, needs analysis
    if filename.len() < 10 {
        return (true, None);
    }

    // Check for good filename patterns - these can be skipped
    for pattern in GOOD_FILENAME_PATTERNS {
        if filename_lower.starts_with(pattern) || filename_lower.contains(pattern) {
            let skip_reason = format!(
                "Filename '{}' matches good naming pattern",
                filename
            );
            return (false, Some(skip_reason));
        }
    }

    // Default: analyze to be safe (more conservative approach)
    (true, None)
}

/// Truncate content intelligently for token economy
fn truncate_content_smart(content: &str, max_chars: usize) -> String {
    if content.len() <= max_chars {
        return content.to_string();
    }

    // For code files, prioritize the beginning (imports, definitions)
    // and a sample from the middle
    let first_half = max_chars * 2 / 3;
    let second_half = max_chars - first_half - 20; // 20 chars for separator

    let start: String = content.chars().take(first_half).collect();
    let end_start = content.len().saturating_sub(second_half);
    let end: String = content.chars().skip(end_start).collect();

    format!("{}\n\n[... truncated ...]\n\n{}", start, end)
}

// =============================================================================
// Folder Context Filtering
// =============================================================================

/// Keywords for different file type categories
const IMAGE_FOLDER_KEYWORDS: &[&str] = &[
    "photo", "image", "picture", "screenshot", "capture", "wallpaper",
    "travel", "vacation", "event", "portrait", "gallery",
];

const DOCUMENT_FOLDER_KEYWORDS: &[&str] = &[
    "document", "doc", "report", "letter", "invoice", "contract",
    "resume", "cv", "manual", "guide", "notes", "meeting",
];

const CODE_FOLDER_KEYWORDS: &[&str] = &[
    "project", "src", "source", "code", "lib", "app", "module",
    "component", "test", "spec", "util", "helper",
];

/// Filter existing folders to show only relevant ones based on file type
fn filter_folders_for_file_type(existing_folders: &[String], file_path: &str) -> Vec<String> {
    // If few folders, return all
    if existing_folders.len() <= 10 {
        return existing_folders.to_vec();
    }

    let keywords = if is_image_file(file_path) {
        IMAGE_FOLDER_KEYWORDS
    } else if is_text_file(file_path) {
        // Check if it's a code file
        let ext = std::path::Path::new(file_path)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let code_extensions = &["js", "ts", "jsx", "tsx", "py", "rs", "go", "java", "kt", "swift", "c", "cpp", "rb", "php"];
        if code_extensions.contains(&ext.as_str()) {
            CODE_FOLDER_KEYWORDS
        } else {
            DOCUMENT_FOLDER_KEYWORDS
        }
    } else {
        // Generic - return top-level folders only
        return existing_folders.iter()
            .filter(|f| !f.contains('/'))
            .take(15)
            .cloned()
            .collect();
    };

    // Filter folders that match keywords
    let mut relevant: Vec<String> = existing_folders.iter()
        .filter(|folder| {
            let folder_lower = folder.to_lowercase();
            keywords.iter().any(|kw| folder_lower.contains(kw))
        })
        .cloned()
        .collect();

    // Add common top-level folders
    for folder in existing_folders {
        if !folder.contains('/') && !relevant.contains(folder) {
            relevant.push(folder.clone());
        }
        if relevant.len() >= 15 {
            break;
        }
    }

    // If still nothing found, return top folders
    if relevant.is_empty() {
        return existing_folders.iter().take(15).cloned().collect();
    }

    relevant.sort();
    relevant
}

// =============================================================================
// Folder Consolidation (Post-processing)
// =============================================================================

/// Minimum number of files required to justify a new folder
const MIN_FILES_PER_FOLDER: usize = 3;

/// Maximum folder depth allowed
const MAX_FOLDER_DEPTH: usize = 2;

/// Maximum Levenshtein distance to consider folders as similar
const MAX_SIMILARITY_DISTANCE: usize = 3;

/// Normalize a folder name to kebab-case, lowercase, no accents
fn normalize_folder_name(name: &str) -> String {
    let normalized: String = name
        .chars()
        .map(|c| match c {
            // Common accented characters to ASCII
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' | 'À' | 'Á' | 'Â' | 'Ã' | 'Ä' | 'Å' => 'a',
            'è' | 'é' | 'ê' | 'ë' | 'È' | 'É' | 'Ê' | 'Ë' => 'e',
            'ì' | 'í' | 'î' | 'ï' | 'Ì' | 'Í' | 'Î' | 'Ï' => 'i',
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'Ò' | 'Ó' | 'Ô' | 'Õ' | 'Ö' => 'o',
            'ù' | 'ú' | 'û' | 'ü' | 'Ù' | 'Ú' | 'Û' | 'Ü' => 'u',
            'ñ' | 'Ñ' => 'n',
            'ç' | 'Ç' => 'c',
            // Keep path separators
            '/' => '/',
            // Convert spaces and underscores to hyphens
            ' ' | '_' => '-',
            // Keep alphanumeric and hyphens
            c if c.is_ascii_alphanumeric() || c == '-' => c.to_ascii_lowercase(),
            // Remove other characters
            _ => '-',
        })
        .collect();

    // Clean up multiple consecutive hyphens and trim
    let mut result = String::new();
    let mut last_was_hyphen = true; // Start as true to trim leading hyphens in segments

    for c in normalized.chars() {
        if c == '/' {
            // Trim trailing hyphen from previous segment
            while result.ends_with('-') {
                result.pop();
            }
            result.push('/');
            last_was_hyphen = true; // Treat as hyphen for next segment start
        } else if c == '-' {
            if !last_was_hyphen && !result.ends_with('/') {
                result.push('-');
                last_was_hyphen = true;
            }
        } else {
            result.push(c);
            last_was_hyphen = false;
        }
    }

    // Trim trailing hyphens
    while result.ends_with('-') {
        result.pop();
    }

    result
}

/// Calculate Levenshtein distance between two strings
fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let len1 = s1.len();
    let len2 = s2.len();

    if len1 == 0 { return len2; }
    if len2 == 0 { return len1; }

    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();

    let mut matrix: Vec<Vec<usize>> = vec![vec![0; len2 + 1]; len1 + 1];

    for i in 0..=len1 {
        matrix[i][0] = i;
    }
    for j in 0..=len2 {
        matrix[0][j] = j;
    }

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] { 0 } else { 1 };
            matrix[i][j] = std::cmp::min(
                std::cmp::min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1       // insertion
                ),
                matrix[i - 1][j - 1] + cost    // substitution
            );
        }
    }

    matrix[len1][len2]
}

/// Check if two folder names are similar (after normalization)
fn folders_are_similar(folder1: &str, folder2: &str) -> bool {
    if folder1 == folder2 {
        return true;
    }

    // Short strings need exact match
    if folder1.len() < 5 || folder2.len() < 5 {
        return folder1 == folder2;
    }

    levenshtein_distance(folder1, folder2) <= MAX_SIMILARITY_DISTANCE
}

/// Flatten a folder path to maximum allowed depth
fn flatten_folder_path(path: &str) -> String {
    let parts: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    if parts.len() <= MAX_FOLDER_DEPTH {
        return path.to_string();
    }

    // Keep first MAX_FOLDER_DEPTH parts
    parts.iter().take(MAX_FOLDER_DEPTH).cloned().collect::<Vec<_>>().join("/")
}

/// Get parent folder (or empty string if root)
fn get_parent_folder(path: &str) -> String {
    if let Some(idx) = path.rfind('/') {
        path[..idx].to_string()
    } else {
        String::new()
    }
}

/// Consolidate folder suggestions after batch analysis
///
/// This function:
/// 1. Normalizes all folder names
/// 2. Flattens folders deeper than 2 levels
/// 3. Merges similar folder names
/// 4. Moves files from folders with < 3 files to parent folder
/// 5. Prefers existing folders over new suggestions
pub fn consolidate_folder_suggestions(
    results: &mut [FileAnalysisResult],
    existing_folders: &[String],
) {
    // Step 1: Normalize all existing folders for comparison
    let normalized_existing: Vec<(String, String)> = existing_folders
        .iter()
        .map(|f| (normalize_folder_name(f), f.clone()))
        .collect();

    // Step 2: Collect and normalize all suggested folders with file counts
    let mut folder_counts: HashMap<String, usize> = HashMap::new();
    let mut original_to_normalized: HashMap<String, String> = HashMap::new();

    for result in results.iter() {
        if let Some(ref suggestion) = result.suggestion {
            if let Some(ref folder) = suggestion.suggested_folder {
                if !folder.is_empty() {
                    // Normalize and flatten
                    let normalized = normalize_folder_name(folder);
                    let flattened = flatten_folder_path(&normalized);

                    original_to_normalized.insert(folder.clone(), flattened.clone());
                    *folder_counts.entry(flattened).or_insert(0) += 1;
                }
            }
        }
    }

    // Step 3: Group similar folders and pick canonical names
    let mut canonical_mapping: HashMap<String, String> = HashMap::new();
    let mut processed: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Sort folders by frequency (most common first)
    let mut sorted_folders: Vec<(String, usize)> = folder_counts.iter()
        .map(|(k, v)| (k.clone(), *v))
        .collect();
    sorted_folders.sort_by(|a, b| b.1.cmp(&a.1));

    for (folder, _) in &sorted_folders {
        if processed.contains(folder) {
            continue;
        }

        // Check if this folder matches an existing folder
        let mut canonical = folder.clone();
        for (norm_existing, original_existing) in &normalized_existing {
            if folders_are_similar(folder, norm_existing) {
                // Use the original existing folder name
                canonical = original_existing.clone();
                break;
            }
        }

        // Mark this and similar folders as processed
        canonical_mapping.insert(folder.clone(), canonical.clone());
        processed.insert(folder.clone());

        // Find and map similar folders to this canonical
        for (other_folder, _) in &sorted_folders {
            if !processed.contains(other_folder) && folders_are_similar(folder, other_folder) {
                canonical_mapping.insert(other_folder.clone(), canonical.clone());
                processed.insert(other_folder.clone());
            }
        }
    }

    // Step 4: Recalculate counts with canonical names
    let mut canonical_counts: HashMap<String, usize> = HashMap::new();
    for result in results.iter() {
        if let Some(ref suggestion) = result.suggestion {
            if let Some(ref folder) = suggestion.suggested_folder {
                if !folder.is_empty() {
                    let normalized = normalize_folder_name(folder);
                    let flattened = flatten_folder_path(&normalized);
                    if let Some(canonical) = canonical_mapping.get(&flattened) {
                        *canonical_counts.entry(canonical.clone()).or_insert(0) += 1;
                    }
                }
            }
        }
    }

    // Step 5: Find folders that don't meet minimum threshold
    let small_folders: std::collections::HashSet<String> = canonical_counts.iter()
        .filter(|(_, count)| **count < MIN_FILES_PER_FOLDER)
        .map(|(folder, _)| folder.clone())
        .collect();

    // Step 6: Apply all transformations to results
    for result in results.iter_mut() {
        if let Some(ref mut suggestion) = result.suggestion {
            if let Some(ref folder) = suggestion.suggested_folder.clone() {
                if !folder.is_empty() {
                    let normalized = normalize_folder_name(folder);
                    let flattened = flatten_folder_path(&normalized);

                    if let Some(canonical) = canonical_mapping.get(&flattened) {
                        // Check if this folder meets minimum threshold
                        if small_folders.contains(canonical) {
                            // Move to parent folder or clear if no parent
                            let parent = get_parent_folder(canonical);
                            if parent.is_empty() {
                                suggestion.suggested_folder = None;
                                suggestion.folder_confidence = None;
                            } else {
                                suggestion.suggested_folder = Some(parent);
                                // Reduce confidence since we had to move it
                                if let Some(conf) = suggestion.folder_confidence {
                                    suggestion.folder_confidence = Some(conf * 0.8);
                                }
                            }
                        } else {
                            // Use canonical name
                            suggestion.suggested_folder = Some(canonical.clone());
                        }
                    }
                }
            }
        }
    }
}

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

=== FOLDER RULES (STRICT - FOLLOW EXACTLY) ===

RULE 1 - ALWAYS PREFER EXISTING FOLDERS:
Your FIRST choice must be an existing folder from the list provided. Only suggest a NEW folder if absolutely no existing folder is remotely suitable.

RULE 2 - MAXIMUM 2 LEVELS DEEP:
- GOOD: "documents", "photos/2024", "projects/alpha"
- BAD: "documents/work/projects/client/2024" (too deep)
- BAD: "photos/vacances/ete/2024/paris" (too deep)

RULE 3 - USE BROAD CATEGORIES ONLY:
First level must be one of these broad categories:
- documents, photos, videos, music, downloads, archives
- projects, work, personal, finances, legal, medical

Second level (optional) should be:
- A year: 2024, 2023, 2022
- OR a simple subcategory: work, personal, family, travel

RULE 4 - NAMING FORMAT:
- Use kebab-case: "project-alpha" not "Project Alpha" or "project_alpha"
- Lowercase only
- No accents: "resume" not "résumé"
- Short names: 1-2 words maximum per level

RULE 5 - AVOID HYPER-SPECIFIC FOLDERS:
- BAD: "vacances-paris-ete-2024" (too specific)
- GOOD: "photos/2024" or "photos/travel"
- BAD: "factures-electricite-2024" (too specific)
- GOOD: "documents/finances" or "finances/2024"

RULE 6 - WHEN IN DOUBT:
If you're unsure, do NOT suggest a folder. Leave suggestedFolder as null.
It's better to not suggest a folder than to create an inappropriate one.

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
        r#"No existing folders found.
You may suggest a new folder, but ONLY from these broad categories:
- First level: documents, photos, videos, projects, work, personal, finances, archives
- Second level (optional): a year (2024) or simple subcategory (work, personal, travel)"#.to_string()
    } else {
        format!(
            r#"EXISTING FOLDERS (USE THESE FIRST - this is your priority):
{}

IMPORTANT: You MUST use one of these existing folders if ANY of them is even remotely suitable.
Only suggest a NEW folder if none of the above match at all.
If suggesting new, use ONLY broad categories: documents, photos, projects, finances, archives"#,
            existing_folders.iter().map(|f| format!("  - {}", f)).collect::<Vec<_>>().join("\n")
        )
    };

    format!(
        r#"Evaluate whether this file needs renaming and suggest an improved name if beneficial. Also suggest an appropriate folder for organization.

Current filename: "{}"
File type: {}

=== FOLDER SELECTION ===
{}

=== CONTENT ===
{}

=== INSTRUCTIONS ===
1. Evaluate the current filename. If already good, set keepOriginal: true.
2. For folder: FIRST try to match an existing folder. Only suggest new if nothing fits.
3. Remember: Maximum 2 levels deep, broad categories only.

Respond ONLY with valid JSON (no other text):
{{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation", "keywords": ["keyword1", "keyword2"], "keepOriginal": false, "suggestedFolder": "category/subcategory", "folderConfidence": 0.75}}"#,
        original_name, file_type, folder_context, content
    )
}

fn create_vision_prompt(original_name: &str, existing_folders: &[String]) -> String {
    let folder_context = if existing_folders.is_empty() {
        r#"No existing folders found.
For images, suggest ONLY: photos, photos/YYYY, screenshots, or leave empty."#.to_string()
    } else {
        format!(
            r#"EXISTING FOLDERS (USE THESE FIRST):
{}

IMPORTANT: Use an existing folder if ANY is suitable. For images, prefer: photos, photos/YYYY, screenshots."#,
            existing_folders.iter().map(|f| format!("  - {}", f)).collect::<Vec<_>>().join("\n")
        )
    };

    format!(
        r#"Evaluate this image and decide if the current filename needs improvement. Also suggest an appropriate folder.

Current filename: "{}"

=== FOLDER RULES ===
{}

STRICT RULES:
- Maximum 2 levels: "photos/2024" is OK, "photos/travel/europe/2024" is NOT
- Use ONLY: photos, screenshots, or an existing folder
- Second level: year (2024) or simple category (travel, family, work)
- When unsure, use just "photos" or leave suggestedFolder as null

=== FILENAME GUIDELINES ===
- Use kebab-case (lowercase with hyphens)
- Be concise: 2-5 words
- Include date if identifiable (YYYY-MM-DD at start)
- Focus on: subject, scene, key elements

If the current filename is already good, set keepOriginal: true.

Respond ONLY with valid JSON:
{{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation", "keywords": ["keyword1", "keyword2"], "keepOriginal": false, "suggestedFolder": "photos/2024", "folderConfidence": 0.75}}"#,
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

/// Progress event payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisProgress {
    /// Current file being processed
    pub current_file: String,
    /// Number of files processed so far
    pub processed: usize,
    /// Total number of files
    pub total: usize,
    /// Percentage complete (0-100)
    pub percent: u8,
    /// Current operation phase
    pub phase: String,
}

/// Analyze files with LLM to get naming suggestions
///
/// Command name: analyze_files_with_llm (snake_case per architecture)
#[tauri::command]
pub async fn analyze_files_with_llm(
    window: tauri::Window,
    file_paths: Vec<String>,
    config: OllamaConfig,
    base_path: Option<String>,
) -> Result<BatchAnalysisResult, String> {
    let total = file_paths.len();

    // Emit initial progress
    let _ = window.emit("analysis-progress", AnalysisProgress {
        current_file: String::new(),
        processed: 0,
        total,
        percent: 0,
        phase: "starting".to_string(),
    });

    // Scan existing folder structure for context
    let existing_folders = Arc::new(base_path
        .as_ref()
        .map(|p| scan_folder_structure(p))
        .unwrap_or_default());

    // Check if LLM is enabled
    if !config.enabled {
        // Return all as skipped when LLM is disabled
        let results: Vec<FileAnalysisResult> = file_paths
            .into_iter()
            .map(|file_path| FileAnalysisResult {
                file_path,
                suggestion: None,
                error: Some("LLM analysis is disabled".to_string()),
                skipped: true,
                source: "disabled".to_string(),
            })
            .collect();

        let skipped = results.len();

        // Emit completion
        let _ = window.emit("analysis-progress", AnalysisProgress {
            current_file: String::new(),
            processed: total,
            total,
            percent: 100,
            phase: "complete".to_string(),
        });

        return Ok(BatchAnalysisResult {
            results,
            total,
            analyzed: 0,
            failed: 0,
            skipped,
            llm_available: false,
        });
    }

    let client = Arc::new(Client::builder()
        .timeout(Duration::from_millis(config.timeout))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?);

    let config = Arc::new(config);

    // Process files concurrently with semaphore-limited parallelism
    // Use a channel to track progress
    let (progress_tx, mut progress_rx) = tokio::sync::mpsc::channel::<(String, bool)>(total);
    let mut handles = Vec::new();

    for file_path in file_paths {
        let client = Arc::clone(&client);
        let config = Arc::clone(&config);
        let existing_folders = Arc::clone(&existing_folders);
        let progress_tx = progress_tx.clone();
        let file_path_clone = file_path.clone();

        let handle = tokio::spawn(async move {
            // Acquire semaphore permit (limits concurrent requests)
            let _permit = LLM_SEMAPHORE.acquire().await.ok();

            // Emit progress before starting
            let _ = progress_tx.send((file_path_clone.clone(), false)).await;

            // Use pre-filtering to skip files with already descriptive names
            // This saves API calls and tokens
            let result = analyze_single_file_with_cache(&client, &file_path_clone, &config, &existing_folders, false).await;

            // Emit progress after completion
            let _ = progress_tx.send((file_path_clone, true)).await;

            result
        });

        handles.push(handle);
    }

    // Drop the original sender so the receiver knows when all tasks are done
    drop(progress_tx);

    // Spawn a task to handle progress updates
    let window_clone = window.clone();
    let total_files = total;
    let progress_task = tokio::spawn(async move {
        let mut processed = 0;
        let mut current_file = String::new();

        while let Some((file, completed)) = progress_rx.recv().await {
            if completed {
                processed += 1;
                let percent = ((processed as f64 / total_files as f64) * 100.0) as u8;
                let _ = window_clone.emit("analysis-progress", AnalysisProgress {
                    current_file: file.clone(),
                    processed,
                    total: total_files,
                    percent,
                    phase: if processed == total_files { "complete" } else { "analyzing" }.to_string(),
                });
            } else {
                current_file = file.clone();
                let _ = window_clone.emit("analysis-progress", AnalysisProgress {
                    current_file,
                    processed,
                    total: total_files,
                    percent: ((processed as f64 / total_files as f64) * 100.0) as u8,
                    phase: "analyzing".to_string(),
                });
            }
        }
    });

    // Collect results
    let mut results: Vec<FileAnalysisResult> = Vec::with_capacity(handles.len());
    let mut analyzed = 0;
    let mut failed = 0;
    let mut skipped = 0;

    for handle in handles {
        match handle.await {
            Ok(result) => {
                match &result.suggestion {
                    Some(_) => analyzed += 1,
                    None if result.skipped => skipped += 1,
                    None => failed += 1,
                }
                results.push(result);
            }
            Err(e) => {
                // Task panicked or was cancelled
                results.push(FileAnalysisResult {
                    file_path: "unknown".to_string(),
                    suggestion: None,
                    error: Some(format!("Task failed: {}", e)),
                    skipped: false,
                    source: "error".to_string(),
                });
                failed += 1;
            }
        }
    }

    // Wait for progress task to complete
    let _ = progress_task.await;

    // Post-processing: Consolidate folder suggestions to reduce fragmentation
    // This normalizes folder names, merges similar folders, and enforces minimum thresholds
    consolidate_folder_suggestions(&mut results, &existing_folders);

    // Emit final completion
    let _ = window.emit("analysis-progress", AnalysisProgress {
        current_file: String::new(),
        processed: total,
        total,
        percent: 100,
        phase: "complete".to_string(),
    });

    Ok(BatchAnalysisResult {
        results,
        total,
        analyzed,
        failed,
        skipped,
        llm_available: true,
    })
}

/// Analyze a single file with caching, pre-filtering, and retry support
async fn analyze_single_file_with_cache(
    client: &Client,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
    _skip_prefilter: bool,
) -> FileAnalysisResult {
    // Filter folders based on file type for more relevant context
    let filtered_folders = filter_folders_for_file_type(existing_folders, file_path);

    // IMPORTANT: Never pre-filter images - they should always use vision model
    // Pre-filter only applies to text files
    let is_image = is_image_file(file_path);

    // Pre-filter: Skip AI analysis for TEXT files with already descriptive names
    // Images are NEVER pre-filtered - they always need vision analysis
    if !is_image {
        let (needs_analysis, skip_reason) = needs_ai_analysis(file_path);
        if !needs_analysis {
            // Return a "keep original" suggestion without calling AI
            let original_name = std::path::Path::new(file_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();

            return FileAnalysisResult {
                file_path: file_path.to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: original_name.clone(),
                    confidence: 0.95,
                    reasoning: skip_reason.unwrap_or_else(|| "Filename already descriptive".to_string()),
                    keywords: vec![],
                    keep_original: true,
                    suggested_folder: None,
                    folder_confidence: None,
                }),
                error: None,
                skipped: false,
                source: "prefilter".to_string(),
            };
        }
    }

    // For text files, check cache first
    if is_text_file(file_path) {
        if let Ok(content) = extract_file_content(file_path, MAX_CONTENT_CHARS) {
            let content_hash = hash_content(&content);

            // Check cache
            if let Some(cached) = get_cached_result(file_path, &content_hash).await {
                return FileAnalysisResult {
                    file_path: file_path.to_string(),
                    suggestion: Some(cached),
                    error: None,
                    skipped: false,
                    source: "cache".to_string(),
                };
            }

            // Analyze with retry and cache result
            let result = analyze_with_retry(client, file_path, config, &filtered_folders).await;

            // Cache successful results
            if let Some(ref suggestion) = result.suggestion {
                cache_result(file_path, &content_hash, suggestion).await;
            }

            return result;
        }
    }

    // For images, check cache by file metadata
    if is_image_file(file_path) {
        if let Some(file_hash) = hash_file_metadata(file_path) {
            // Check cache
            if let Some(cached) = get_cached_result(file_path, &file_hash).await {
                return FileAnalysisResult {
                    file_path: file_path.to_string(),
                    suggestion: Some(cached),
                    error: None,
                    skipped: false,
                    source: "cache".to_string(),
                };
            }

            // Analyze with retry and cache result
            let result = analyze_with_retry(client, file_path, config, &filtered_folders).await;

            // Cache successful results
            if let Some(ref suggestion) = result.suggestion {
                cache_result(file_path, &file_hash, suggestion).await;
            }

            return result;
        }
    }

    // Fallback: analyze without caching
    analyze_with_retry(client, file_path, config, &filtered_folders).await
}

/// Analyze a file with exponential backoff retry on rate limits
async fn analyze_with_retry(
    client: &Client,
    file_path: &str,
    config: &OllamaConfig,
    existing_folders: &[String],
) -> FileAnalysisResult {
    let mut last_result = analyze_single_file(client, file_path, config, existing_folders).await;

    // Check if we should retry
    for attempt in 0..MAX_RETRIES {
        // Only retry on specific errors
        let should_retry = match &last_result.error {
            Some(err) => {
                err.contains("429") ||
                err.contains("rate limit") ||
                err.contains("Rate limit") ||
                err.contains("503") ||
                err.contains("502") ||
                err.contains("temporarily unavailable")
            }
            None => false,
        };

        if !should_retry {
            break;
        }

        // Wait with exponential backoff
        let delay = calculate_backoff_delay(attempt);
        tokio::time::sleep(delay).await;

        // Retry
        last_result = analyze_single_file(client, file_path, config, existing_folders).await;
    }

    last_result
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

    // Extract content with smart truncation
    let raw_content = match extract_file_content(file_path, MAX_CONTENT_CHARS) {
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

    if raw_content.trim().is_empty() {
        return FileAnalysisResult {
            file_path: file_path.to_string(),
            suggestion: None,
            error: Some("File is empty".to_string()),
            skipped: true,
            source: "empty".to_string(),
        };
    }

    // Apply smart truncation for token economy
    let content = truncate_content_smart(&raw_content, MAX_CONTENT_CHARS);

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
// Cache Management Commands
// =============================================================================

/// Clear the AI analysis cache
///
/// Useful for forcing re-analysis of files after configuration changes.
/// Command name: clear_analysis_cache (snake_case per architecture)
#[tauri::command]
pub async fn clear_analysis_cache() -> Result<usize, String> {
    let mut cache = ANALYSIS_CACHE.lock().await;
    let count = cache.len();
    cache.clear();
    Ok(count)
}

/// Get cache statistics
///
/// Returns the number of cached entries.
/// Command name: get_cache_stats (snake_case per architecture)
#[tauri::command]
pub async fn get_cache_stats() -> Result<CacheStats, String> {
    let cache = ANALYSIS_CACHE.lock().await;
    let now = std::time::Instant::now();

    let valid_entries = cache.values()
        .filter(|e| now.duration_since(e.cached_at).as_secs() < CACHE_TTL_SECS)
        .count();

    Ok(CacheStats {
        total_entries: cache.len(),
        valid_entries,
    })
}

/// Cache statistics
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub total_entries: usize,
    pub valid_entries: usize,
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

    // =============================================================================
    // Cache and Optimization Tests
    // =============================================================================

    #[test]
    fn test_hash_content() {
        let hash1 = hash_content("test content");
        let hash2 = hash_content("test content");
        let hash3 = hash_content("different content");

        // Same content should produce same hash
        assert_eq!(hash1, hash2);
        // Different content should produce different hash
        assert_ne!(hash1, hash3);
        // Hash should be hex string
        assert!(hash1.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_needs_ai_analysis_low_quality_english() {
        // Low quality patterns should need analysis
        let (needs, _) = needs_ai_analysis("/path/to/IMG_1234.jpg");
        assert!(needs, "IMG_ prefix should need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/screenshot_2024.png");
        assert!(needs, "screenshot prefix should need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/document_final.pdf");
        assert!(needs, "document prefix should need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/untitled.txt");
        assert!(needs, "untitled should need analysis");
    }

    #[test]
    fn test_needs_ai_analysis_low_quality_french() {
        // French patterns should also need analysis
        let (needs, _) = needs_ai_analysis("/path/to/Capture d'écran 2024.png");
        assert!(needs, "Capture d'écran should need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/Sans titre.txt");
        assert!(needs, "Sans titre should need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/nouveau document.pdf");
        assert!(needs, "nouveau should need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/copie de fichier.txt");
        assert!(needs, "copie de should need analysis");
    }

    #[test]
    fn test_needs_ai_analysis_random_suffix() {
        // Files with random hex suffixes should need analysis
        let (needs, _) = needs_ai_analysis("/path/to/document_a8f3b2c1.pdf");
        assert!(needs, "random hex suffix should need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/photo-1234abcd5678.jpg");
        assert!(needs, "random alphanumeric suffix should need analysis");
    }

    #[test]
    fn test_needs_ai_analysis_descriptive() {
        // Descriptive names with good patterns should not need analysis
        let (needs, reason) = needs_ai_analysis("/path/to/2024-budget-report.pdf");
        assert!(!needs, "date-prefixed name should not need analysis");
        assert!(reason.is_some());

        let (needs, _) = needs_ai_analysis("/path/to/invoice-client-january.pdf");
        assert!(!needs, "invoice prefix should not need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/facture-janvier-client.pdf");
        assert!(!needs, "facture prefix should not need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/rapport-reunion-equipe.pdf");
        assert!(!needs, "rapport should not need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/meeting-notes-project.txt");
        assert!(!needs, "meeting-notes should not need analysis");

        let (needs, _) = needs_ai_analysis("/path/to/projet-alpha-specifications.pdf");
        assert!(!needs, "projet should not need analysis");
    }

    #[test]
    fn test_needs_ai_analysis_short() {
        // Short names should need analysis
        let (needs, _) = needs_ai_analysis("/path/to/abc.txt");
        assert!(needs, "short name should need analysis");
    }

    #[test]
    fn test_needs_ai_analysis_uuid() {
        // UUID-like names should need analysis
        let (needs, _) = needs_ai_analysis("/path/to/550e8400-e29b-41d4-a716-446655440000.pdf");
        assert!(needs, "UUID name should need analysis");

        // UUID embedded in filename
        let (needs, _) = needs_ai_analysis("/path/to/file-550e8400-e29b-41d4-a716-446655440000.pdf");
        assert!(needs, "embedded UUID should need analysis");
    }

    #[test]
    fn test_needs_ai_analysis_default_analyze() {
        // Unknown patterns should default to needing analysis (conservative)
        let (needs, _) = needs_ai_analysis("/path/to/some-random-file-name.txt");
        assert!(needs, "unknown pattern should default to needing analysis");
    }

    #[test]
    fn test_truncate_content_smart_short() {
        let content = "Short content";
        let truncated = truncate_content_smart(content, 1000);
        assert_eq!(truncated, content);
    }

    #[test]
    fn test_truncate_content_smart_long() {
        let content = "a".repeat(10000);
        let truncated = truncate_content_smart(&content, 1000);
        assert!(truncated.len() < content.len());
        assert!(truncated.contains("[... truncated ...]"));
    }

    #[test]
    fn test_filter_folders_for_file_type_few_folders() {
        let folders = vec![
            "Documents".to_string(),
            "Photos".to_string(),
            "Code".to_string(),
        ];

        let filtered = filter_folders_for_file_type(&folders, "/path/to/image.jpg");
        // Should return all when few folders
        assert_eq!(filtered.len(), 3);
    }

    #[test]
    fn test_filter_folders_for_file_type_images() {
        let folders: Vec<String> = (0..20)
            .map(|i| match i {
                0 => "Photos".to_string(),
                1 => "Screenshots".to_string(),
                2 => "Documents".to_string(),
                3 => "Code".to_string(),
                4 => "Travel".to_string(),
                5 => "Photos/2024".to_string(),
                _ => format!("Other{}", i),
            })
            .collect();

        let filtered = filter_folders_for_file_type(&folders, "/path/to/image.jpg");

        // Should include photo-related folders
        assert!(filtered.iter().any(|f| f.contains("Photo")));
        assert!(filtered.iter().any(|f| f.contains("Screenshot")));
        assert!(filtered.iter().any(|f| f.contains("Travel")));
    }

    #[test]
    fn test_filter_folders_for_file_type_code() {
        let folders: Vec<String> = (0..20)
            .map(|i| match i {
                0 => "Projects".to_string(),
                1 => "src".to_string(),
                2 => "Documents".to_string(),
                3 => "Photos".to_string(),
                4 => "lib".to_string(),
                _ => format!("Other{}", i),
            })
            .collect();

        let filtered = filter_folders_for_file_type(&folders, "/path/to/code.ts");

        // Should include code-related folders
        assert!(filtered.iter().any(|f| f.contains("Project") || f.contains("src") || f.contains("lib")));
    }

    #[test]
    fn test_cache_stats_serialization() {
        let stats = CacheStats {
            total_entries: 100,
            valid_entries: 95,
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("\"totalEntries\":100"));
        assert!(json.contains("\"validEntries\":95"));
    }

    // =============================================================================
    // Folder Consolidation Tests
    // =============================================================================

    #[test]
    fn test_normalize_folder_name_basic() {
        assert_eq!(normalize_folder_name("Documents"), "documents");
        assert_eq!(normalize_folder_name("My Documents"), "my-documents");
        assert_eq!(normalize_folder_name("My_Documents"), "my-documents");
    }

    #[test]
    fn test_normalize_folder_name_accents() {
        assert_eq!(normalize_folder_name("Téléchargements"), "telechargements");
        assert_eq!(normalize_folder_name("Éléments"), "elements");
        assert_eq!(normalize_folder_name("Photos été 2024"), "photos-ete-2024");
    }

    #[test]
    fn test_normalize_folder_name_path() {
        assert_eq!(normalize_folder_name("Documents/Work"), "documents/work");
        assert_eq!(normalize_folder_name("Photos/Été 2024"), "photos/ete-2024");
    }

    #[test]
    fn test_normalize_folder_name_cleanup() {
        // Multiple spaces/underscores become single hyphen
        assert_eq!(normalize_folder_name("My   Documents"), "my-documents");
        assert_eq!(normalize_folder_name("My___Documents"), "my-documents");
        // Leading/trailing hyphens removed
        assert_eq!(normalize_folder_name("-Documents-"), "documents");
    }

    #[test]
    fn test_levenshtein_distance_identical() {
        assert_eq!(levenshtein_distance("photos", "photos"), 0);
    }

    #[test]
    fn test_levenshtein_distance_one_char() {
        assert_eq!(levenshtein_distance("photo", "photos"), 1);
        assert_eq!(levenshtein_distance("photos", "photo"), 1);
    }

    #[test]
    fn test_levenshtein_distance_substitution() {
        assert_eq!(levenshtein_distance("cat", "car"), 1);
        assert_eq!(levenshtein_distance("documents", "documants"), 1);
    }

    #[test]
    fn test_levenshtein_distance_different() {
        assert!(levenshtein_distance("photos", "documents") > 3);
    }

    #[test]
    fn test_folders_are_similar_exact() {
        assert!(folders_are_similar("photos", "photos"));
    }

    #[test]
    fn test_folders_are_similar_small_diff() {
        assert!(folders_are_similar("photos", "photo"));
        assert!(folders_are_similar("documents", "document"));
    }

    #[test]
    fn test_folders_are_similar_short_exact_only() {
        // Short strings should only match if exact
        assert!(folders_are_similar("doc", "doc"));
        assert!(!folders_are_similar("doc", "dot"));
    }

    #[test]
    fn test_folders_are_similar_different() {
        assert!(!folders_are_similar("photos", "documents"));
        assert!(!folders_are_similar("work", "personal"));
    }

    #[test]
    fn test_flatten_folder_path_under_limit() {
        assert_eq!(flatten_folder_path("photos"), "photos");
        assert_eq!(flatten_folder_path("photos/2024"), "photos/2024");
    }

    #[test]
    fn test_flatten_folder_path_over_limit() {
        // Should truncate to MAX_FOLDER_DEPTH (2) levels
        assert_eq!(flatten_folder_path("photos/travel/europe/2024"), "photos/travel");
        assert_eq!(flatten_folder_path("a/b/c/d/e"), "a/b");
    }

    #[test]
    fn test_get_parent_folder() {
        assert_eq!(get_parent_folder("photos/2024"), "photos");
        assert_eq!(get_parent_folder("photos/travel/europe"), "photos/travel");
        assert_eq!(get_parent_folder("photos"), "");
    }

    #[test]
    fn test_consolidate_folder_suggestions_normalizes() {
        let mut results = vec![
            FileAnalysisResult {
                file_path: "/path/file1.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file1".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("Photos été".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
            FileAnalysisResult {
                file_path: "/path/file2.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file2".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("photos-ete".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
            FileAnalysisResult {
                file_path: "/path/file3.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file3".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("Photos_été".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
        ];

        consolidate_folder_suggestions(&mut results, &[]);

        // All should be normalized to same canonical name
        let folders: Vec<_> = results
            .iter()
            .filter_map(|r| r.suggestion.as_ref()?.suggested_folder.as_ref())
            .collect();

        // All folders should be the same after consolidation
        assert!(folders.iter().all(|f| *f == folders[0]));
    }

    #[test]
    fn test_consolidate_folder_suggestions_prefers_existing() {
        let mut results = vec![
            FileAnalysisResult {
                file_path: "/path/file1.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file1".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("photo".to_string()), // Missing 's'
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
            FileAnalysisResult {
                file_path: "/path/file2.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file2".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("photo".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
            FileAnalysisResult {
                file_path: "/path/file3.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file3".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("photo".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
        ];

        // Existing folder named "Photos" (with s)
        consolidate_folder_suggestions(&mut results, &["Photos".to_string()]);

        // Should use existing folder name "Photos"
        for result in &results {
            if let Some(ref suggestion) = result.suggestion {
                if let Some(ref folder) = suggestion.suggested_folder {
                    assert_eq!(folder, "Photos");
                }
            }
        }
    }

    #[test]
    fn test_consolidate_folder_suggestions_removes_small() {
        let mut results = vec![
            // 3 files in "photos" - should keep
            FileAnalysisResult {
                file_path: "/path/file1.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file1".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("photos".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
            FileAnalysisResult {
                file_path: "/path/file2.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file2".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("photos".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
            FileAnalysisResult {
                file_path: "/path/file3.jpg".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file3".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("photos".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
            // 1 file in "random-folder" - should be removed (below threshold)
            FileAnalysisResult {
                file_path: "/path/file4.pdf".to_string(),
                suggestion: Some(AiSuggestion {
                    suggested_name: "file4".to_string(),
                    confidence: 0.9,
                    reasoning: "test".to_string(),
                    keywords: vec![],
                    keep_original: false,
                    suggested_folder: Some("random-folder".to_string()),
                    folder_confidence: Some(0.8),
                }),
                error: None,
                skipped: false,
                source: "test".to_string(),
            },
        ];

        consolidate_folder_suggestions(&mut results, &[]);

        // "photos" folder should remain (3 files)
        let photo_folders: Vec<_> = results
            .iter()
            .filter(|r| r.file_path.ends_with(".jpg"))
            .filter_map(|r| r.suggestion.as_ref()?.suggested_folder.as_ref())
            .collect();
        assert!(photo_folders.iter().all(|f| *f == "photos"));

        // "random-folder" should be removed (only 1 file)
        let random_file = &results[3];
        assert!(random_file.suggestion.as_ref().unwrap().suggested_folder.is_none());
    }

    #[test]
    fn test_flatten_folder_path_cleans_deep_paths() {
        // Test from prompt: MAX 2 levels
        assert_eq!(flatten_folder_path("documents/work/projects/client"), "documents/work");
        assert_eq!(flatten_folder_path("photos/travel/europe/2024"), "photos/travel");
    }
}
