# Release Guide

This document describes how to create releases for Tidy App across all supported platforms.

## Supported Platforms

| Platform | Architecture | Formats |
|----------|--------------|---------|
| Linux | x86_64 | `.deb`, `.rpm`, `.AppImage` |
| Windows | x86_64 | `.msi`, `.exe` (NSIS) |
| macOS | Intel (x86_64) | `.dmg`, `.app` |
| macOS | Apple Silicon (ARM64) | `.dmg`, `.app` |

## Prerequisites

### GitHub Secrets

Configure these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

| Secret | Description | Required |
|--------|-------------|----------|
| `TAURI_SIGNING_PRIVATE_KEY` | Private key for signing updates | For auto-updates |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key | For auto-updates |

### Generating Signing Keys (Optional)

For auto-update functionality, generate a signing key pair:

```bash
# Install Tauri CLI if not already installed
cargo install tauri-cli

# Generate key pair
cargo tauri signer generate -w ~/.tauri/tidy-app.key

# This creates:
# - ~/.tauri/tidy-app.key (private key - keep secret!)
# - ~/.tauri/tidy-app.key.pub (public key)
```

Add the private key content to `TAURI_SIGNING_PRIVATE_KEY` secret and update the `pubkey` in `tauri.conf.json` with your public key.

## Creating a Release

### 1. Bump Version

Use the version bump script to update all version files:

```bash
# Bump patch version (0.2.0 -> 0.2.1)
pnpm version:bump patch

# Bump minor version (0.2.0 -> 0.3.0)
pnpm version:bump minor

# Bump major version (0.2.0 -> 1.0.0)
pnpm version:bump major

# Set specific version
pnpm version:bump 1.0.0
```

This updates:
- `apps/gui/src-tauri/tauri.conf.json`
- `apps/gui/src-tauri/Cargo.toml`
- `apps/gui/package.json`

### 2. Commit and Tag

```bash
# Review changes
git diff

# Commit
git commit -am "chore: release v1.0.0"

# Create annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push changes and tag
git push && git push --tags
```

### 3. Monitor Build

The release workflow automatically starts when you push a tag. Monitor progress at:
`https://github.com/YOUR_USERNAME/tidy-app/actions`

### 4. Publish Release

By default, releases are created as drafts. After verifying the build artifacts:

1. Go to `https://github.com/YOUR_USERNAME/tidy-app/releases`
2. Find the draft release
3. Edit release notes if needed
4. Click "Publish release"

## Manual Release (Workflow Dispatch)

You can also trigger a release manually without creating a tag:

1. Go to `Actions > Release`
2. Click "Run workflow"
3. Enter the version number
4. Optionally uncheck "Create as draft release"
5. Click "Run workflow"

Note: Version files must already be updated to match the specified version.

## Build Artifacts

After a successful release, the following artifacts are available:

### Linux
- `tidy-app_X.Y.Z_amd64.deb` - Debian/Ubuntu package
- `tidy-app-X.Y.Z-1.x86_64.rpm` - Fedora/RHEL package
- `tidy-app_X.Y.Z_x86_64.AppImage` - Universal Linux package

### Windows
- `tidy-app_X.Y.Z_x64_en-US.msi` - MSI installer
- `tidy-app_X.Y.Z_x64-setup.exe` - NSIS installer

### macOS
- `tidy-app_X.Y.Z_aarch64.dmg` - Apple Silicon
- `tidy-app_X.Y.Z_x64.dmg` - Intel

### Checksums
- `checksums-sha256.txt` - SHA-256 checksums for verification

## Verification

Users can verify downloads using the checksums file:

```bash
# Download checksums
curl -LO https://github.com/YOUR_USERNAME/tidy-app/releases/download/vX.Y.Z/checksums-sha256.txt

# Verify a specific file
sha256sum -c checksums-sha256.txt --ignore-missing
```

## Auto-Updates (Optional)

To enable auto-updates:

1. Generate signing keys (see Prerequisites)
2. Add `TAURI_SIGNING_PRIVATE_KEY` to GitHub secrets
3. Update `tauri.conf.json` with your public key and GitHub username
4. Add `tauri-plugin-updater` to your Rust dependencies
5. Implement update checking in your app

The release workflow automatically generates `*.sig` files for signed artifacts.

## Troubleshooting

### Build Fails on macOS

Ensure the macOS runner has the correct Xcode version. The workflow uses:
- `macos-13` for Intel builds
- `macos-latest` for Apple Silicon builds

### Windows Code Signing

For production releases, consider adding Windows code signing:

1. Obtain a code signing certificate
2. Add certificate to GitHub secrets
3. Update `bundle.windows.certificateThumbprint` in `tauri.conf.json`

### Linux Dependencies

If builds fail on Linux, ensure all dependencies are installed:
```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libfuse2
```

## Version Strategy

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

Pre-release versions use suffixes: `1.0.0-beta.1`, `1.0.0-rc.1`
