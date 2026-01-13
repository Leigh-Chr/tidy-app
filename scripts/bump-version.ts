#!/usr/bin/env npx tsx
/**
 * Bumps the version across all project files that contain version information.
 *
 * Files updated:
 * - apps/gui/src-tauri/tauri.conf.json
 * - apps/gui/src-tauri/Cargo.toml
 * - apps/gui/package.json
 *
 * Usage:
 *   npx tsx scripts/bump-version.ts <version>
 *   npx tsx scripts/bump-version.ts 1.0.0
 *   npx tsx scripts/bump-version.ts patch|minor|major
 *
 * Examples:
 *   npx tsx scripts/bump-version.ts 1.2.3        # Set specific version
 *   npx tsx scripts/bump-version.ts patch        # 0.2.0 -> 0.2.1
 *   npx tsx scripts/bump-version.ts minor        # 0.2.0 -> 0.3.0
 *   npx tsx scripts/bump-version.ts major        # 0.2.0 -> 1.0.0
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Files to update
const FILES = {
  tauriConfig: resolve(projectRoot, "apps/gui/src-tauri/tauri.conf.json"),
  cargoToml: resolve(projectRoot, "apps/gui/src-tauri/Cargo.toml"),
  guiPackageJson: resolve(projectRoot, "apps/gui/package.json"),
};

interface VersionParts {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

function parseVersion(version: string): VersionParts {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[5],
  };
}

function formatVersion(parts: VersionParts): string {
  const base = `${parts.major}.${parts.minor}.${parts.patch}`;
  return parts.prerelease ? `${base}-${parts.prerelease}` : base;
}

function getCurrentVersion(): string {
  const tauriConfig = JSON.parse(readFileSync(FILES.tauriConfig, "utf-8"));
  return tauriConfig.version;
}

function calculateNewVersion(
  current: string,
  bump: "major" | "minor" | "patch"
): string {
  const parts = parseVersion(current);

  switch (bump) {
    case "major":
      return formatVersion({ major: parts.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatVersion({
        major: parts.major,
        minor: parts.minor + 1,
        patch: 0,
      });
    case "patch":
      return formatVersion({
        major: parts.major,
        minor: parts.minor,
        patch: parts.patch + 1,
      });
  }
}

function updateTauriConfig(version: string): void {
  const content = JSON.parse(readFileSync(FILES.tauriConfig, "utf-8"));
  content.version = version;
  writeFileSync(FILES.tauriConfig, JSON.stringify(content, null, 2) + "\n");
  console.log(`  Updated: ${FILES.tauriConfig}`);
}

function updateCargoToml(version: string): void {
  let content = readFileSync(FILES.cargoToml, "utf-8");
  // Match only the first version line (package version)
  content = content.replace(
    /^(version\s*=\s*)"[^"]+"/m,
    `$1"${version}"`
  );
  writeFileSync(FILES.cargoToml, content);
  console.log(`  Updated: ${FILES.cargoToml}`);
}

function updatePackageJson(version: string): void {
  const content = JSON.parse(readFileSync(FILES.guiPackageJson, "utf-8"));
  content.version = version;
  writeFileSync(FILES.guiPackageJson, JSON.stringify(content, null, 2) + "\n");
  console.log(`  Updated: ${FILES.guiPackageJson}`);
}

function updateCargoLock(): void {
  // Update Cargo.lock by running cargo check
  console.log("\n  Updating Cargo.lock...");
  try {
    execSync("cargo check", {
      cwd: resolve(projectRoot, "apps/gui/src-tauri"),
      stdio: "pipe",
    });
    console.log("  Updated: apps/gui/src-tauri/Cargo.lock");
  } catch {
    console.warn("  Warning: Could not update Cargo.lock (cargo check failed)");
  }
}

function verifyConsistency(version: string): boolean {
  let isConsistent = true;

  // Check tauri.conf.json
  const tauriConfig = JSON.parse(readFileSync(FILES.tauriConfig, "utf-8"));
  if (tauriConfig.version !== version) {
    console.error(`  Mismatch in tauri.conf.json: ${tauriConfig.version}`);
    isConsistent = false;
  }

  // Check Cargo.toml
  const cargoContent = readFileSync(FILES.cargoToml, "utf-8");
  const cargoMatch = cargoContent.match(/^version\s*=\s*"([^"]+)"/m);
  if (cargoMatch && cargoMatch[1] !== version) {
    console.error(`  Mismatch in Cargo.toml: ${cargoMatch[1]}`);
    isConsistent = false;
  }

  // Check package.json
  const packageJson = JSON.parse(readFileSync(FILES.guiPackageJson, "utf-8"));
  if (packageJson.version !== version) {
    console.error(`  Mismatch in package.json: ${packageJson.version}`);
    isConsistent = false;
  }

  return isConsistent;
}

function showHelp(): void {
  console.log("Usage: npx tsx scripts/bump-version.ts <version|major|minor|patch>");
  console.log("");
  console.log("Examples:");
  console.log("  npx tsx scripts/bump-version.ts 1.0.0    # Set specific version");
  console.log("  npx tsx scripts/bump-version.ts patch    # Bump patch version");
  console.log("  npx tsx scripts/bump-version.ts minor    # Bump minor version");
  console.log("  npx tsx scripts/bump-version.ts major    # Bump major version");
  console.log("");
  console.log("This script updates version in:");
  console.log("  - apps/gui/src-tauri/tauri.conf.json");
  console.log("  - apps/gui/src-tauri/Cargo.toml");
  console.log("  - apps/gui/package.json");
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  // Verify all files exist
  for (const [name, path] of Object.entries(FILES)) {
    if (!existsSync(path)) {
      console.error(`Error: File not found: ${path}`);
      process.exit(1);
    }
  }

  const input = args[0];
  const currentVersion = getCurrentVersion();
  let newVersion: string;

  // Determine the new version
  if (["major", "minor", "patch"].includes(input)) {
    newVersion = calculateNewVersion(
      currentVersion,
      input as "major" | "minor" | "patch"
    );
  } else {
    // Validate the provided version format
    try {
      parseVersion(input);
      newVersion = input;
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`\nBumping version: ${currentVersion} -> ${newVersion}\n`);
  console.log("Updating files:");

  // Update all files
  updateTauriConfig(newVersion);
  updateCargoToml(newVersion);
  updatePackageJson(newVersion);
  updateCargoLock();

  // Verify consistency
  console.log("\nVerifying consistency...");
  if (verifyConsistency(newVersion)) {
    console.log("  All files are consistent!");
  } else {
    console.error("\n  Some files are inconsistent. Please check manually.");
    process.exit(1);
  }

  console.log(`\nVersion bumped to ${newVersion}`);
  console.log("\nNext steps:");
  console.log(`  1. Review changes: git diff`);
  console.log(`  2. Commit: git commit -am "chore: bump version to ${newVersion}"`);
  console.log(`  3. Tag: git tag v${newVersion}`);
  console.log(`  4. Push: git push && git push --tags`);
}

main();
