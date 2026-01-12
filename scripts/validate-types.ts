#!/usr/bin/env npx ts-node
/**
 * Validates that manually maintained TypeScript types match the auto-generated
 * types from Rust via ts-rs.
 *
 * Run this script after `cargo test` in src-tauri to regenerate bindings.
 *
 * Usage: npx ts-node scripts/validate-types.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Find project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

const GENERATED_DIR = resolve(
  projectRoot,
  "apps/gui/src-tauri/bindings"
);

interface ValidationResult {
  type: string;
  status: "ok" | "mismatch" | "missing";
  message: string;
}

const results: ValidationResult[] = [];

// Validate FileCategory
function validateFileCategory(): ValidationResult {
  const generatedPath = resolve(GENERATED_DIR, "FileCategory.ts");

  if (!existsSync(generatedPath)) {
    return {
      type: "FileCategory",
      status: "missing",
      message: `Generated file not found: ${generatedPath}. Run 'cargo test' in src-tauri first.`,
    };
  }

  const generated = readFileSync(generatedPath, "utf-8");

  // Expected values from manual TypeScript
  const expectedValues = [
    "image",
    "document",
    "video",
    "audio",
    "archive",
    "code",
    "data",
    "other",
  ];

  // Check if all expected values are in generated type
  const missingValues = expectedValues.filter(
    (v) => !generated.includes(`"${v}"`)
  );

  if (missingValues.length > 0) {
    return {
      type: "FileCategory",
      status: "mismatch",
      message: `Missing categories in generated type: ${missingValues.join(", ")}`,
    };
  }

  // Check for extra values (simple regex to extract values)
  const valueMatch = generated.match(/"(\w+)"/g);
  if (valueMatch) {
    const generatedValues = valueMatch.map((v) => v.replace(/"/g, ""));
    const extraValues = generatedValues.filter(
      (v) => !expectedValues.includes(v)
    );
    if (extraValues.length > 0) {
      return {
        type: "FileCategory",
        status: "mismatch",
        message: `Extra categories in generated type: ${extraValues.join(", ")}`,
      };
    }
  }

  return {
    type: "FileCategory",
    status: "ok",
    message: `All ${expectedValues.length} categories match`,
  };
}

// Validate CaseStyle
function validateCaseStyle(): ValidationResult {
  const generatedPath = resolve(GENERATED_DIR, "CaseStyle.ts");

  if (!existsSync(generatedPath)) {
    return {
      type: "CaseStyle",
      status: "missing",
      message: `Generated file not found: ${generatedPath}`,
    };
  }

  const generated = readFileSync(generatedPath, "utf-8");

  // Expected values
  const expectedValues = [
    "none",
    "lowercase",
    "uppercase",
    "capitalize",
    "title-case",
    "kebab-case",
    "snake-case",
    "camel-case",
    "pascal-case",
  ];

  const missingValues = expectedValues.filter(
    (v) => !generated.includes(`"${v}"`)
  );

  if (missingValues.length > 0) {
    return {
      type: "CaseStyle",
      status: "mismatch",
      message: `Missing case styles: ${missingValues.join(", ")}`,
    };
  }

  return {
    type: "CaseStyle",
    status: "ok",
    message: `All ${expectedValues.length} case styles match`,
  };
}

// Run validations
console.log("🔍 Validating TypeScript types against Rust-generated bindings...\n");

results.push(validateFileCategory());
results.push(validateCaseStyle());

// Print results
let hasErrors = false;

for (const result of results) {
  const icon =
    result.status === "ok" ? "✅" : result.status === "mismatch" ? "❌" : "⚠️";
  console.log(`${icon} ${result.type}: ${result.message}`);

  if (result.status !== "ok") {
    hasErrors = true;
  }
}

console.log("\n" + "=".repeat(60));

if (hasErrors) {
  console.log("❌ Some validations failed. Please sync Rust and TypeScript types.");
  console.log("\nTo regenerate Rust bindings:");
  console.log("  cd apps/gui/src-tauri && cargo test");
  process.exit(1);
} else {
  console.log("✅ All type validations passed!");
  process.exit(0);
}
