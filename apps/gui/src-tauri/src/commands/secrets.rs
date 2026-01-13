// Secure storage module for sensitive data (SEC-004)
// Encrypts secrets using AES-256-GCM with machine-derived key
//
// This module provides secure storage for API keys and other secrets
// without requiring external dependencies like system keychains.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

/// Errors related to secret storage
#[derive(Debug, Error)]
pub enum SecretError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Failed to get machine ID: {0}")]
    MachineIdFailed(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

// Use macro for Serialize implementation (QUAL-001)
crate::impl_serialize_as_string!(SecretError);

/// Service identifier for the application
const SERVICE_NAME: &str = "tidy-app";

/// Nonce size for AES-GCM (96 bits = 12 bytes)
const NONCE_SIZE: usize = 12;

/// Derive a 256-bit encryption key from the machine ID and a salt
fn derive_key() -> Result<[u8; 32], SecretError> {
    // Get machine-unique identifier
    let machine_id = machine_uid::get()
        .map_err(|e| SecretError::MachineIdFailed(e.to_string()))?;

    // Derive key using SHA-256(machine_id + service_name)
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    hasher.update(SERVICE_NAME.as_bytes());
    // Add additional entropy from config directory path
    if let Some(config_dir) = dirs::config_dir() {
        hasher.update(config_dir.to_string_lossy().as_bytes());
    }

    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    Ok(key)
}

/// Encrypt a secret value
///
/// Returns base64-encoded string containing nonce + ciphertext
pub fn encrypt_secret(plaintext: &str) -> Result<String, SecretError> {
    if plaintext.is_empty() {
        return Ok(String::new());
    }

    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| SecretError::EncryptionFailed(e.to_string()))?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    aes_gcm::aead::rand_core::RngCore::fill_bytes(&mut OsRng, &mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| SecretError::EncryptionFailed(e.to_string()))?;

    // Combine nonce + ciphertext and encode as base64
    let mut combined = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&combined))
}

/// Decrypt a secret value
///
/// Expects base64-encoded string containing nonce + ciphertext
pub fn decrypt_secret(encrypted: &str) -> Result<String, SecretError> {
    if encrypted.is_empty() {
        return Ok(String::new());
    }

    let combined = BASE64
        .decode(encrypted)
        .map_err(|e| SecretError::DecryptionFailed(format!("Invalid base64: {}", e)))?;

    if combined.len() < NONCE_SIZE + 16 {
        // Minimum: nonce + auth tag
        return Err(SecretError::DecryptionFailed(
            "Encrypted data too short".to_string(),
        ));
    }

    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| SecretError::DecryptionFailed(e.to_string()))?;

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| SecretError::DecryptionFailed("Decryption failed (wrong key or corrupted data)".to_string()))?;

    String::from_utf8(plaintext)
        .map_err(|e| SecretError::DecryptionFailed(format!("Invalid UTF-8: {}", e)))
}

/// Check if a string looks like an encrypted secret (base64 with correct length)
pub fn is_encrypted(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }

    // Encrypted secrets are base64 and have minimum length for nonce + tag
    if let Ok(decoded) = BASE64.decode(value) {
        decoded.len() >= NONCE_SIZE + 16
    } else {
        false
    }
}

/// Get the secrets file path
fn get_secrets_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("tidy-app")
        .join(".secrets")
}

/// Store a secret to the secrets file
#[tauri::command]
pub async fn store_secret(key: String, value: String) -> Result<(), SecretError> {
    let encrypted = encrypt_secret(&value)?;

    let secrets_path = get_secrets_path();
    let secrets_dir = secrets_path.parent().unwrap();

    // Ensure directory exists
    if !secrets_dir.exists() {
        fs::create_dir_all(secrets_dir)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o700);
            let _ = fs::set_permissions(secrets_dir, perms);
        }
    }

    // Load existing secrets
    let mut secrets: serde_json::Map<String, serde_json::Value> = if secrets_path.exists() {
        let content = fs::read_to_string(&secrets_path)?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    // Update secret
    secrets.insert(key, serde_json::Value::String(encrypted));

    // Write back with restrictive permissions
    let content = serde_json::to_string_pretty(&secrets)
        .map_err(|e| SecretError::EncryptionFailed(e.to_string()))?;
    fs::write(&secrets_path, &content)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        let _ = fs::set_permissions(&secrets_path, perms);
    }

    Ok(())
}

/// Retrieve a secret from the secrets file
#[tauri::command]
pub async fn retrieve_secret(key: String) -> Result<String, SecretError> {
    let secrets_path = get_secrets_path();

    if !secrets_path.exists() {
        return Ok(String::new());
    }

    let content = fs::read_to_string(&secrets_path)?;
    let secrets: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&content).unwrap_or_default();

    if let Some(serde_json::Value::String(encrypted)) = secrets.get(&key) {
        decrypt_secret(encrypted)
    } else {
        Ok(String::new())
    }
}

/// Delete a secret from the secrets file
#[tauri::command]
pub async fn delete_secret(key: String) -> Result<(), SecretError> {
    let secrets_path = get_secrets_path();

    if !secrets_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&secrets_path)?;
    let mut secrets: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&content).unwrap_or_default();

    secrets.remove(&key);

    let content = serde_json::to_string_pretty(&secrets)
        .map_err(|e| SecretError::EncryptionFailed(e.to_string()))?;
    fs::write(&secrets_path, &content)?;

    Ok(())
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plaintext = "sk-test-api-key-12345";
        let encrypted = encrypt_secret(plaintext).unwrap();

        // Encrypted value should be different from plaintext
        assert_ne!(encrypted, plaintext);

        // Should be able to decrypt
        let decrypted = decrypt_secret(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_empty_string() {
        let encrypted = encrypt_secret("").unwrap();
        assert!(encrypted.is_empty());

        let decrypted = decrypt_secret("").unwrap();
        assert!(decrypted.is_empty());
    }

    #[test]
    fn test_is_encrypted() {
        // Empty string is not encrypted
        assert!(!is_encrypted(""));

        // Plain API key is not encrypted
        assert!(!is_encrypted("sk-test-key"));

        // Encrypted value should be detected
        let encrypted = encrypt_secret("test").unwrap();
        assert!(is_encrypted(&encrypted));
    }

    #[test]
    fn test_different_plaintexts_different_ciphertexts() {
        let encrypted1 = encrypt_secret("secret1").unwrap();
        let encrypted2 = encrypt_secret("secret2").unwrap();

        // Different plaintexts should produce different ciphertexts
        assert_ne!(encrypted1, encrypted2);
    }

    #[test]
    fn test_same_plaintext_different_nonce() {
        let plaintext = "same-secret";
        let encrypted1 = encrypt_secret(plaintext).unwrap();
        let encrypted2 = encrypt_secret(plaintext).unwrap();

        // Same plaintext should produce different ciphertexts (random nonce)
        assert_ne!(encrypted1, encrypted2);

        // But both should decrypt to the same value
        assert_eq!(decrypt_secret(&encrypted1).unwrap(), plaintext);
        assert_eq!(decrypt_secret(&encrypted2).unwrap(), plaintext);
    }

    #[test]
    fn test_invalid_ciphertext() {
        // Random base64 that's not valid ciphertext
        let result = decrypt_secret("SGVsbG8gV29ybGQh");
        assert!(result.is_err());
    }

    #[test]
    fn test_unicode_plaintext() {
        let plaintext = "clé-api-française-日本語";
        let encrypted = encrypt_secret(plaintext).unwrap();
        let decrypted = decrypt_secret(&encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }
}
