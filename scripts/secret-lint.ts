#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Secret Lint - Detect secrets in codebase
 *
 * Purpose:
 * - Prevent API keys, secrets, internal endpoints from leaking
 * - Scan public folders (demo-ui, open-template, docs)
 * - Exit 0 if clean, Exit 1 if violations
 *
 * Usage:
 *   npm run secret:lint
 */

import { execSync } from "child_process";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SECRET_PATTERNS = [
  // API Keys (various formats)
  { name: "ANTHROPIC_API_KEY", pattern: /ANTHROPIC_API_KEY/g },
  { name: "OPENAI_API_KEY", pattern: /OPENAI_API_KEY/g },
  { name: "API Key (sk-)", pattern: /sk-[a-zA-Z0-9]{32,}/g },
  { name: "API Key Assignment", pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: "Secret Assignment", pattern: /secret\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: "Token Assignment", pattern: /token\s*[:=]\s*['"][^'"]{16,}['"]/gi },
  { name: "Password Assignment", pattern: /password\s*[:=]\s*['"][^'"]{6,}['"]/gi },

  // Bearer Tokens
  { name: "Bearer Token", pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g },
  { name: "Authorization Header", pattern: /Authorization:\s*Bearer\s+[a-zA-Z0-9_\-\.]+/gi },

  // Internal Endpoints
  { name: "Internal Endpoint", pattern: /https?:\/\/[^\/\s]+\/internal/g },
  { name: "localhost with credentials", pattern: /https?:\/\/[^:]+:[^@]+@localhost/g },

  // Cloud Provider Keys
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "AWS Secret Key", pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"][^'"]+['"]/g },
  { name: "GitHub Token", pattern: /gh[ps]_[a-zA-Z0-9]{36}/g },
  { name: "GitHub PAT", pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g },

  // Webhooks
  { name: "Slack Webhook", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9\/]+/g },
  { name: "Discord Webhook", pattern: /https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+/g },

  // Database Connection Strings
  { name: "MongoDB URI", pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/g },
  { name: "PostgreSQL URI", pattern: /postgres(ql)?:\/\/[^:]+:[^@]+@/g },
  { name: "MySQL URI", pattern: /mysql:\/\/[^:]+:[^@]+@/g },

  // Private Keys
  { name: "RSA Private Key", pattern: /-----BEGIN RSA PRIVATE KEY-----/g },
  { name: "SSH Private Key", pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  { name: "PGP Private Key", pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g },
];

const PUBLIC_DIRS = [
  "demo-ui/public",
  "demo-ui/.next",
  "demo-ui/out",
  "open-template",
  "docs",
  "README.md",
  "ARCHITECTURE.md",
];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  match: string;
}

const violations: Violation[] = [];

/**
 * Scan directory recursively
 */
function scanDirectory(dir: string, baseDir: string = dir) {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = fullPath.replace(baseDir + "/", "");

      // Skip node_modules, .git, etc
      if (entry === "node_modules" || entry === ".git" || entry === "dist") {
        continue;
      }

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath, baseDir);
        } else if (stat.isFile()) {
          scanFile(fullPath, relativePath);
        }
      } catch (error) {
        // Skip if permission denied
        continue;
      }
    }
  } catch (error) {
    console.error(`Cannot scan directory: ${dir}`, error);
  }
}

/**
 * Check if string looks like a secret (2-tier filter: pattern + length)
 */
function looksLikeSecret(text: string): boolean {
  // Tier 1: Length check (secrets are usually 16+ chars)
  if (text.length < 16) {
    return false;
  }

  // Tier 2: Entropy check (high randomness = likely secret)
  const uniqueChars = new Set(text).size;
  const entropy = uniqueChars / text.length;

  // High entropy (>0.6) + reasonable length = likely secret
  if (entropy > 0.6 && text.length >= 20) {
    return true;
  }

  // Check for base64-like patterns
  if (/^[A-Za-z0-9+/=]{20,}$/.test(text)) {
    return true;
  }

  return false;
}

/**
 * Scan file for secrets
 */
function scanFile(filePath: string, relativePath: string) {
  // Only scan text files
  const textExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".html",
    ".css",
    ".env",
    ".yaml",
    ".yml",
  ];

  const ext = filePath.substring(filePath.lastIndexOf("."));
  if (!textExtensions.includes(ext)) {
    return;
  }

  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const { name, pattern } of SECRET_PATTERNS) {
        const matches = line.match(pattern);

        if (matches) {
          for (const match of matches) {
            // 2-tier filter: pattern match + looks like secret
            const matchValue = match.replace(/^[^'"]*['"]|['"].*$/g, ""); // Extract value

            if (looksLikeSecret(matchValue) || match.includes("-----BEGIN")) {
              violations.push({
                file: relativePath,
                line: lineNum + 1,
                pattern: name,
                match: match.length > 50 ? match.substring(0, 47) + "..." : match,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // Skip binary files
  }
}

/**
 * Check if file exists
 */
function fileExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         Secret Lint - Detect Secrets in Codebase          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  console.log("\n🔍 Scanning public directories...\n");

  const projectRoot = process.cwd();

  for (const dir of PUBLIC_DIRS) {
    const fullPath = join(projectRoot, dir);

    if (!fileExists(fullPath)) {
      console.log(`   ⚠️  ${dir} - NOT FOUND (skipped)`);
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      console.log(`   📁 ${dir}`);
      scanDirectory(fullPath, fullPath);
    } else if (stat.isFile()) {
      console.log(`   📄 ${dir}`);
      scanFile(fullPath, dir);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Scan Results");
  console.log("=".repeat(60));

  if (violations.length === 0) {
    console.log("\n✅ No secrets found - CLEAN\n");
    process.exit(0);
  } else {
    console.log(`\n❌ ${violations.length} violation(s) found:\n`);

    // Group by file
    const byFile: Record<string, Violation[]> = {};

    for (const violation of violations) {
      if (!byFile[violation.file]) {
        byFile[violation.file] = [];
      }
      byFile[violation.file].push(violation);
    }

    for (const [file, fileViolations] of Object.entries(byFile)) {
      console.log(`📄 ${file}:`);
      for (const v of fileViolations) {
        console.log(`   Line ${v.line}: [${v.pattern}] ${v.match}`);
      }
      console.log();
    }

    console.log("⚠️  VIOLATIONS DETECTED - DO NOT DEPLOY\n");
    process.exit(1);
  }
}

main();
