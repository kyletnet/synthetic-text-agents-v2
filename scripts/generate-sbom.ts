#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * SBOM Generator - Software Bill of Materials
 *
 * Purpose:
 * - Generate SBOM (Software Bill of Materials) for supply chain security
 * - Include all dependencies with versions and licenses
 * - Create hash for integrity verification
 *
 * Usage:
 *   npm run sbom:generate
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { createHash } from "crypto";

interface Dependency {
  name: string;
  version: string;
  license: string;
  repository?: string;
}

interface SBOM {
  metadata: {
    tool: string;
    version: string;
    timestamp: string;
    project: string;
    projectVersion: string;
  };
  dependencies: Dependency[];
  devDependencies: Dependency[];
  totalCount: number;
  hash: string;
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║            SBOM Generator - Supply Chain Security         ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// Read package.json
const packageJsonPath = join(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

console.log(`📦 Project: ${packageJson.name}@${packageJson.version}\n`);

// Get dependency tree
console.log("🔍 Analyzing dependency tree...\n");

let depTree: Record<string, { version: string; resolved?: string }> = {};

try {
  const npmList = execSync("npm list --json --all", {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });

  const parsed = JSON.parse(npmList);
  depTree = parsed.dependencies || {};
} catch (error) {
  // npm list exits with code 1 if there are missing dependencies
  // But still produces valid JSON output
  const errorOutput = (error as any).stdout;

  if (errorOutput) {
    try {
      const parsed = JSON.parse(errorOutput);
      depTree = parsed.dependencies || {};
    } catch {
      console.error("❌ Failed to parse npm list output");
      process.exit(1);
    }
  }
}

// Extract dependencies
const dependencies: Dependency[] = [];
const devDependencies: Dependency[] = [];

function extractDeps(deps: Record<string, any>, isDev: boolean = false) {
  for (const [name, info] of Object.entries(deps)) {
    const dep: Dependency = {
      name,
      version: info.version || "unknown",
      license: "unknown",
    };

    // Get license from node_modules
    const depPackageJsonPath = join(
      process.cwd(),
      "node_modules",
      name,
      "package.json"
    );

    if (existsSync(depPackageJsonPath)) {
      try {
        const depPackageJson = JSON.parse(
          readFileSync(depPackageJsonPath, "utf8")
        );

        dep.license = depPackageJson.license || "unknown";

        if (depPackageJson.repository) {
          if (typeof depPackageJson.repository === "string") {
            dep.repository = depPackageJson.repository;
          } else if (depPackageJson.repository.url) {
            dep.repository = depPackageJson.repository.url;
          }
        }
      } catch {
        // Skip if can't read
      }
    }

    if (isDev) {
      devDependencies.push(dep);
    } else {
      dependencies.push(dep);
    }
  }
}

// Extract production dependencies
extractDeps(packageJson.dependencies || {});

// Extract dev dependencies
extractDeps(packageJson.devDependencies || {}, true);

console.log(`✅ Found ${dependencies.length} production dependencies`);
console.log(`✅ Found ${devDependencies.length} dev dependencies\n`);

// Create SBOM
const sbom: SBOM = {
  metadata: {
    tool: "generate-sbom.ts",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    project: packageJson.name,
    projectVersion: packageJson.version,
  },
  dependencies: dependencies.sort((a, b) => a.name.localeCompare(b.name)),
  devDependencies: devDependencies.sort((a, b) => a.name.localeCompare(b.name)),
  totalCount: dependencies.length + devDependencies.length,
  hash: "", // Will be filled after serialization
};

// Calculate hash (excluding the hash field itself)
const sbomForHash = {
  metadata: sbom.metadata,
  dependencies: sbom.dependencies,
  devDependencies: sbom.devDependencies,
  totalCount: sbom.totalCount,
};

const sbomJsonForHash = JSON.stringify(sbomForHash, null, 2);
const hash = createHash("sha256").update(sbomJsonForHash).digest("hex");
sbom.hash = hash;

// Write SBOM
const reportsDir = join(process.cwd(), "reports");

if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

const sbomPath = join(reportsDir, "sbom-phase0.json");
const sbomFinalJson = JSON.stringify(sbom, null, 2);

writeFileSync(sbomPath, sbomFinalJson, "utf8");

console.log("📄 SBOM generated:");
console.log(`   File: ${sbomPath}`);
console.log(`   Hash: ${hash}\n`);

// Write hash file
const hashPath = join(reportsDir, "sbom-phase0.hash");
writeFileSync(hashPath, `${hash}  sbom-phase0.json\n`, "utf8");

console.log("🔒 Hash file created:");
console.log(`   File: ${hashPath}\n`);

console.log("=".repeat(60));
console.log("📊 SBOM Summary");
console.log("=".repeat(60));
console.log(`Total dependencies:     ${sbom.totalCount}`);
console.log(`Production:             ${dependencies.length}`);
console.log(`Development:            ${devDependencies.length}`);
console.log(`Integrity hash:         ${hash.substring(0, 16)}...`);
console.log();

console.log("✅ SBOM generation complete\n");
