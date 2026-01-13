// Structured error types for Tauri commands
// Provides consistent error format across all commands

use serde::Serialize;
use ts_rs::TS;

/// Structured error response for frontend
/// Enables the frontend to distinguish error types and provide appropriate recovery suggestions
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    /// Error code for programmatic handling (e.g., "SCAN_PATH_NOT_FOUND")
    pub code: String,
    /// Human-readable error message
    pub message: String,
    /// Error category for grouping
    pub category: ErrorCategory,
    /// Whether the error is recoverable
    pub recoverable: bool,
    /// Optional suggestion for the user
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    /// Optional additional details (serialized as JSON object)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "Record<string, unknown> | null")]
    pub details: Option<serde_json::Value>,
}

/// Error category for grouping and UI display
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
#[serde(rename_all = "lowercase")]
pub enum ErrorCategory {
    /// File system errors (permissions, not found, etc.)
    Filesystem,
    /// Security-related errors (path traversal, invalid names)
    Security,
    /// Configuration errors
    Config,
    /// Network/API errors (LLM, external services)
    Network,
    /// Validation errors (invalid input)
    Validation,
    /// Internal errors (bugs, unexpected state)
    Internal,
}

impl ErrorResponse {
    /// Create a new error response
    pub fn new(code: impl Into<String>, message: impl Into<String>, category: ErrorCategory) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            category,
            recoverable: true,
            suggestion: None,
            details: None,
        }
    }

    /// Mark error as non-recoverable
    pub fn non_recoverable(mut self) -> Self {
        self.recoverable = false;
        self
    }

    /// Add a suggestion for the user
    pub fn with_suggestion(mut self, suggestion: impl Into<String>) -> Self {
        self.suggestion = Some(suggestion.into());
        self
    }

    /// Add additional details
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

/// Helper macro to create error responses with consistent codes
#[macro_export]
macro_rules! error_response {
    // Filesystem errors
    (path_not_found, $path:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "PATH_NOT_FOUND",
            format!("Path does not exist: {}", $path),
            $crate::commands::error::ErrorCategory::Filesystem,
        ).with_suggestion("Please check that the path exists and is accessible.")
    };
    (not_a_directory, $path:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "NOT_A_DIRECTORY",
            format!("Not a directory: {}", $path),
            $crate::commands::error::ErrorCategory::Filesystem,
        ).with_suggestion("Please select a directory, not a file.")
    };
    (io_error, $msg:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "IO_ERROR",
            $msg.to_string(),
            $crate::commands::error::ErrorCategory::Filesystem,
        ).with_suggestion("Check file permissions and ensure the disk is accessible.")
    };

    // Security errors
    (path_traversal) => {
        $crate::commands::error::ErrorResponse::new(
            "PATH_TRAVERSAL",
            "Security violation: path traversal attempt detected",
            $crate::commands::error::ErrorCategory::Security,
        ).non_recoverable()
    };
    (security_violation, $msg:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "SECURITY_VIOLATION",
            $msg.to_string(),
            $crate::commands::error::ErrorCategory::Security,
        ).non_recoverable()
    };

    // Validation errors
    (invalid_filename, $name:expr, $reason:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "INVALID_FILENAME",
            format!("Invalid filename '{}': {}", $name, $reason),
            $crate::commands::error::ErrorCategory::Validation,
        ).with_suggestion("Rename the file to use valid characters only.")
    };

    // Config errors
    (config_load_failed, $msg:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "CONFIG_LOAD_FAILED",
            format!("Failed to load configuration: {}", $msg),
            $crate::commands::error::ErrorCategory::Config,
        ).with_suggestion("Try resetting to default configuration.")
    };
    (config_save_failed, $msg:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "CONFIG_SAVE_FAILED",
            format!("Failed to save configuration: {}", $msg),
            $crate::commands::error::ErrorCategory::Config,
        ).with_suggestion("Check write permissions in the configuration directory.")
    };

    // Network errors
    (llm_unavailable) => {
        $crate::commands::error::ErrorResponse::new(
            "LLM_UNAVAILABLE",
            "LLM service is not available",
            $crate::commands::error::ErrorCategory::Network,
        ).with_suggestion("Ensure Ollama is running or check your OpenAI API key.")
    };
    (network_error, $msg:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "NETWORK_ERROR",
            $msg.to_string(),
            $crate::commands::error::ErrorCategory::Network,
        ).with_suggestion("Check your internet connection and try again.")
    };

    // History errors
    (entry_not_found, $id:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "ENTRY_NOT_FOUND",
            format!("History entry not found: {}", $id),
            $crate::commands::error::ErrorCategory::Internal,
        )
    };
    (undo_failed, $msg:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "UNDO_FAILED",
            format!("Failed to undo operation: {}", $msg),
            $crate::commands::error::ErrorCategory::Filesystem,
        ).with_suggestion("Some files may have been moved or deleted since the operation.")
    };
    (lock_failed, $msg:expr) => {
        $crate::commands::error::ErrorResponse::new(
            "LOCK_FAILED",
            format!("Failed to acquire lock: {}", $msg),
            $crate::commands::error::ErrorCategory::Internal,
        ).with_suggestion("Another operation may be in progress. Please try again.")
    };
}

pub use error_response;

/// Helper macro to implement Serialize for error types using to_error_response()
/// Use this for errors that have a `to_error_response(&self) -> ErrorResponse` method
///
/// # Example
/// ```ignore
/// impl_serialize_via_error_response!(MyError);
/// ```
#[macro_export]
macro_rules! impl_serialize_via_error_response {
    ($error_type:ty) => {
        impl serde::Serialize for $error_type {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::Serializer,
            {
                self.to_error_response().serialize(serializer)
            }
        }
    };
}

/// Helper macro to implement Serialize for error types as string
/// Use this for simple errors that should serialize as their Display impl
///
/// # Example
/// ```ignore
/// impl_serialize_as_string!(MyError);
/// ```
#[macro_export]
macro_rules! impl_serialize_as_string {
    ($error_type:ty) => {
        impl serde::Serialize for $error_type {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::Serializer,
            {
                serializer.serialize_str(&self.to_string())
            }
        }
    };
}

pub use impl_serialize_as_string;
pub use impl_serialize_via_error_response;
