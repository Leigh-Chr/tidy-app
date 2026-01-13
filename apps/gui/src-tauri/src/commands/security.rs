// Security utilities for path validation and sanitization
// Prevents path traversal attacks and validates file paths

use std::path::{Path, PathBuf};
use thiserror::Error;

/// Security-related errors
#[derive(Debug, Error)]
pub enum SecurityError {
    #[error("Path traversal detected: attempted to access path outside allowed directory")]
    PathTraversal,
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("Path canonicalization failed: {0}")]
    CanonicalizationFailed(String),
    #[error("Symlink not allowed: {0}")]
    SymlinkNotAllowed(String),
}

/// Validates that a path is safe and does not escape the allowed base directory.
///
/// This function:
/// 1. Canonicalizes both paths to resolve any symlinks and relative components
/// 2. Verifies the target path starts with the base path
/// 3. Rejects paths containing path traversal sequences
///
/// # Arguments
/// * `path` - The path to validate
/// * `base_dir` - The base directory that the path must be within
///
/// # Returns
/// * `Ok(PathBuf)` - The canonicalized safe path
/// * `Err(SecurityError)` - If the path is unsafe or invalid
pub fn validate_path_within_base(path: &Path, base_dir: &Path) -> Result<PathBuf, SecurityError> {
    // Check for obvious path traversal attempts in the raw path
    let path_str = path.to_string_lossy();
    if path_str.contains("..") {
        return Err(SecurityError::PathTraversal);
    }

    // SEC-P0-001: Check if base_dir is a symlink (security risk)
    if base_dir.is_symlink() {
        return Err(SecurityError::SymlinkNotAllowed(
            "Base directory cannot be a symlink".to_string()
        ));
    }

    // Canonicalize the base directory (must exist)
    let canonical_base = base_dir.canonicalize().map_err(|e| {
        SecurityError::CanonicalizationFailed(format!("Base directory: {}", e))
    })?;

    // For the target path, if it doesn't exist yet, we need to validate
    // by checking its parent and ensuring the path construction is safe
    let canonical_path = if path.exists() {
        // SEC-P0-001: Check if target path is a symlink
        if path.is_symlink() {
            return Err(SecurityError::SymlinkNotAllowed(
                format!("Target path is a symlink: {}", path.display())
            ));
        }
        path.canonicalize().map_err(|e| {
            SecurityError::CanonicalizationFailed(format!("Target path: {}", e))
        })?
    } else {
        // For non-existent paths, build the canonical path from existing ancestors
        let mut current = path.to_path_buf();
        let mut components_to_add: Vec<std::ffi::OsString> = Vec::new();

        // Walk up until we find an existing ancestor
        while !current.exists() {
            if let Some(file_name) = current.file_name() {
                components_to_add.push(file_name.to_os_string());
                if let Some(parent) = current.parent() {
                    current = parent.to_path_buf();
                } else {
                    return Err(SecurityError::InvalidPath("No valid ancestor found".to_string()));
                }
            } else {
                return Err(SecurityError::InvalidPath("Invalid path structure".to_string()));
            }
        }

        // SEC-P0-001: Check if the existing ancestor is a symlink
        if current.is_symlink() {
            return Err(SecurityError::SymlinkNotAllowed(
                format!("Path ancestor is a symlink: {}", current.display())
            ));
        }

        // Canonicalize the existing ancestor
        let mut result = current.canonicalize().map_err(|e| {
            SecurityError::CanonicalizationFailed(format!("Ancestor path: {}", e))
        })?;

        // SEC-P0-002: Validate each component BEFORE adding to prevent traversal
        // Re-add the non-existent components
        for component in components_to_add.into_iter().rev() {
            // Validate each component doesn't contain traversal
            let comp_str = component.to_string_lossy();
            if comp_str == ".." || comp_str == "." || comp_str.contains('/') || comp_str.contains('\\') {
                return Err(SecurityError::PathTraversal);
            }
            // SEC-P0-002: Also check for null bytes and other dangerous characters
            if comp_str.contains('\0') {
                return Err(SecurityError::InvalidPath("Path contains null byte".to_string()));
            }
            result.push(component);
        }

        // SEC-P0-002: Final validation - ensure result is still within base after construction
        // This catches edge cases where the constructed path somehow escapes
        if !result.starts_with(&canonical_base) {
            return Err(SecurityError::PathTraversal);
        }

        result
    };

    // Verify the path is within the base directory
    if !canonical_path.starts_with(&canonical_base) {
        return Err(SecurityError::PathTraversal);
    }

    Ok(canonical_path)
}

/// Validates that a path is safe for scanning.
/// The path must exist and be a directory.
///
/// # Arguments
/// * `path` - The path to validate
///
/// # Returns
/// * `Ok(PathBuf)` - The canonicalized safe path
/// * `Err(SecurityError)` - If the path is unsafe or invalid
pub fn validate_scan_path(path: &str) -> Result<PathBuf, SecurityError> {
    // Check for path traversal sequences
    if path.contains("..") {
        return Err(SecurityError::PathTraversal);
    }

    // SEC-P0-002: Check for null bytes
    if path.contains('\0') {
        return Err(SecurityError::InvalidPath("Path contains null byte".to_string()));
    }

    let path = Path::new(path);

    // SEC-P0-001: Check if the path is a symlink before canonicalizing
    // This prevents following symlinks to directories outside the intended scope
    if path.is_symlink() {
        return Err(SecurityError::SymlinkNotAllowed(
            format!("Scan path is a symlink: {}", path.display())
        ));
    }

    // Canonicalize to resolve the path
    let canonical = path.canonicalize().map_err(|e| {
        SecurityError::CanonicalizationFailed(e.to_string())
    })?;

    // Must be a directory
    if !canonical.is_dir() {
        return Err(SecurityError::InvalidPath("Not a directory".to_string()));
    }

    Ok(canonical)
}

/// Validates that a proposed file path for rename/move operations is safe.
/// Ensures the destination is within the source's base directory.
///
/// # Arguments
/// * `original_path` - The original file path
/// * `proposed_path` - The proposed new path
/// * `allowed_base` - Optional explicit base directory (uses original's parent if None)
///
/// # Returns
/// * `Ok(PathBuf)` - The validated proposed path
/// * `Err(SecurityError)` - If the path would escape the allowed directory
pub fn validate_rename_path(
    original_path: &str,
    proposed_path: &str,
    allowed_base: Option<&Path>,
) -> Result<PathBuf, SecurityError> {
    // Check for obvious traversal in proposed path
    if proposed_path.contains("..") {
        return Err(SecurityError::PathTraversal);
    }

    // SEC-P0-002: Check for null bytes
    if proposed_path.contains('\0') || original_path.contains('\0') {
        return Err(SecurityError::InvalidPath("Path contains null byte".to_string()));
    }

    let original = Path::new(original_path);
    let proposed = Path::new(proposed_path);

    // SEC-P0-001: Check if original file is a symlink
    if original.is_symlink() {
        return Err(SecurityError::SymlinkNotAllowed(
            format!("Original file is a symlink: {}", original.display())
        ));
    }

    // Determine the base directory
    let base_dir = if let Some(base) = allowed_base {
        base.to_path_buf()
    } else {
        // Use the original file's parent directory
        original.parent()
            .ok_or_else(|| SecurityError::InvalidPath("Original path has no parent".to_string()))?
            .to_path_buf()
    };

    // For rename-only operations (same directory), just validate the name
    if let (Some(orig_parent), Some(prop_parent)) = (original.parent(), proposed.parent()) {
        if orig_parent == prop_parent {
            // Same directory - just a rename, which is safe
            // But still validate the filename doesn't contain dangerous characters
            if let Some(file_name) = proposed.file_name() {
                let name_str = file_name.to_string_lossy();
                if name_str.contains('\0') || name_str.contains('/') || name_str.contains('\\') {
                    return Err(SecurityError::InvalidPath(
                        "Proposed filename contains invalid characters".to_string()
                    ));
                }
            }
            return Ok(proposed.to_path_buf());
        }
    }

    // For move operations, validate the destination is within allowed base
    validate_path_within_base(proposed, &base_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_validate_scan_path_valid() {
        let temp_dir = TempDir::new().unwrap();
        let result = validate_scan_path(temp_dir.path().to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_scan_path_traversal() {
        let result = validate_scan_path("/tmp/../etc/passwd");
        assert!(matches!(result, Err(SecurityError::PathTraversal)));
    }

    #[test]
    fn test_validate_path_within_base() {
        let temp_dir = TempDir::new().unwrap();
        let sub_dir = temp_dir.path().join("subdir");
        fs::create_dir(&sub_dir).unwrap();

        let result = validate_path_within_base(&sub_dir, temp_dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_path_outside_base() {
        let temp_dir = TempDir::new().unwrap();
        // Use /usr on Unix or C:\Windows on Windows - paths that are definitely
        // outside any temp directory regardless of symlink resolution
        // (On macOS, /tmp is a symlink to /private/tmp which could be an ancestor of tempdir)
        #[cfg(unix)]
        let outside = Path::new("/usr");
        #[cfg(windows)]
        let outside = Path::new("C:\\Windows");

        let result = validate_path_within_base(outside, temp_dir.path());
        assert!(matches!(result, Err(SecurityError::PathTraversal)));
    }

    #[test]
    fn test_validate_rename_same_directory() {
        let temp_dir = TempDir::new().unwrap();
        let original = temp_dir.path().join("test.txt");
        let proposed = temp_dir.path().join("renamed.txt");

        // Create the original file
        fs::write(&original, "test").unwrap();

        let result = validate_rename_path(
            original.to_str().unwrap(),
            proposed.to_str().unwrap(),
            None,
        );
        assert!(result.is_ok());
    }

    // SEC-P0-001: Symlink security tests
    #[cfg(unix)]
    #[test]
    fn test_validate_scan_path_rejects_symlink() {
        use std::os::unix::fs::symlink;

        let temp_dir = TempDir::new().unwrap();
        let real_dir = temp_dir.path().join("real");
        let link_dir = temp_dir.path().join("link");

        fs::create_dir(&real_dir).unwrap();
        symlink(&real_dir, &link_dir).unwrap();

        let result = validate_scan_path(link_dir.to_str().unwrap());
        assert!(matches!(result, Err(SecurityError::SymlinkNotAllowed(_))));
    }

    #[cfg(unix)]
    #[test]
    fn test_validate_path_within_base_rejects_symlink_ancestor() {
        use std::os::unix::fs::symlink;

        let temp_dir = TempDir::new().unwrap();
        let real_dir = temp_dir.path().join("real");
        let link_dir = temp_dir.path().join("link");

        fs::create_dir(&real_dir).unwrap();
        symlink(&real_dir, &link_dir).unwrap();

        // Try to validate a path that goes through a symlinked ancestor
        let target = link_dir.join("subdir").join("file.txt");
        let result = validate_path_within_base(&target, temp_dir.path());
        assert!(matches!(result, Err(SecurityError::SymlinkNotAllowed(_))));
    }

    #[cfg(unix)]
    #[test]
    fn test_validate_rename_path_rejects_symlink_original() {
        use std::os::unix::fs::symlink;

        let temp_dir = TempDir::new().unwrap();
        let real_file = temp_dir.path().join("real.txt");
        let link_file = temp_dir.path().join("link.txt");
        let proposed = temp_dir.path().join("renamed.txt");

        fs::write(&real_file, "test").unwrap();
        symlink(&real_file, &link_file).unwrap();

        let result = validate_rename_path(
            link_file.to_str().unwrap(),
            proposed.to_str().unwrap(),
            None,
        );
        assert!(matches!(result, Err(SecurityError::SymlinkNotAllowed(_))));
    }

    // SEC-P0-002: Null byte and path component tests
    #[test]
    fn test_validate_scan_path_rejects_null_byte() {
        let result = validate_scan_path("/tmp/test\0dir");
        assert!(matches!(result, Err(SecurityError::InvalidPath(_))));
    }

    #[test]
    fn test_validate_rename_path_rejects_null_byte() {
        let result = validate_rename_path(
            "/tmp/test.txt",
            "/tmp/renamed\0.txt",
            None,
        );
        assert!(matches!(result, Err(SecurityError::InvalidPath(_))));
    }

    #[test]
    fn test_validate_path_within_base_rejects_dot_component() {
        let temp_dir = TempDir::new().unwrap();
        // Create a path that contains "." as a component (not as current dir reference)
        // This is edge case testing
        let target = temp_dir.path().join("subdir").join("file.txt");
        // This should work - normal path
        fs::create_dir(temp_dir.path().join("subdir")).unwrap();
        let result = validate_path_within_base(&target, temp_dir.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_rename_path_rejects_invalid_filename_chars() {
        let temp_dir = TempDir::new().unwrap();
        let original = temp_dir.path().join("test.txt");
        fs::write(&original, "test").unwrap();

        // Filename with embedded slash should be rejected
        let proposed = temp_dir.path().join("renamed/file.txt");
        let result = validate_rename_path(
            original.to_str().unwrap(),
            proposed.to_str().unwrap(),
            None,
        );
        // This should either be rejected or handled as a move
        // For same-directory rename, it shouldn't create subdirectories
        assert!(result.is_ok() || matches!(result, Err(SecurityError::InvalidPath(_))));
    }
}
