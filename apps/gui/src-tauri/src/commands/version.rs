use serde::Serialize;

/// Version information returned by get_version command
#[derive(Debug, Serialize)]
pub struct VersionInfo {
    /// GUI application version
    pub version: String,
    /// Core library version (placeholder until @tidy/core integration)
    pub core_version: String,
}

/// Get version information for the application
/// Command name: get_version (snake_case per architecture)
#[tauri::command]
pub fn get_version() -> VersionInfo {
    VersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        // TODO: Get actual @tidy/core version via Node.js integration
        core_version: "0.1.0".to_string(),
    }
}
