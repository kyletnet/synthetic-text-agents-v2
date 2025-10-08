#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Entropy Monitor - SBOM Drift Detection
 *
 * Purpose:
 * - Monitor SBOM drift over time (adaptive mode entropy accumulation)
 * - Detect "soft fork" risk when dependency hash drift > 3 types
 * - Auto-recommend strict mode re-lock after 30 days
 *
 * Usage:
 *   npm run entropy:monitor           # Check current drift
 *   npm run entropy:monitor -- --age  # Show SBOM age
 *   npm run entropy:monitor -- --reset # Reset baseline
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const SBOM_PATH = join(process.cwd(), "reports/sbom-phase0.json");
const BASELINE_PATH = join(process.cwd(), "reports/sbom-baseline.json");
const DRIFT_LOG = join(process.cwd(), "reports/sbom-drift.jsonl");
const MAX_DRIFT_THRESHOLD = 3; // Max 3 types of changes
const MAX_AGE_DAYS = 30; // 30 days

interface SBOMDependency {
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
  dependencies: SBOMDependency[];
  devDependencies: SBOMDependency[];
  totalCount: number;
  hash: string;
}

interface DriftEntry {
  timestamp: string;
  type: "added" | "removed" | "version_changed" | "license_changed";
  package: string;
  before?: string;
  after?: string;
}

interface DriftReport {
  age_days: number;
  drift_count: number;
  drift_types: Set<string>;
  drifts: DriftEntry[];
  recommendation: string;
  action_required: boolean;
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║      Entropy Monitor - SBOM Drift Detection                ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

/**
 * Load SBOM
 */
function loadSBOM(path: string): SBOM | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Calculate SBOM age in days
 */
function calculateAge(sbom: SBOM): number {
  const timestamp = new Date(sbom.metadata.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Detect drift between baseline and current SBOM
 */
function detectDrift(baseline: SBOM, current: SBOM): DriftEntry[] {
  const drifts: DriftEntry[] = [];

  // Create lookup maps
  const baselineDeps = new Map<string, SBOMDependency>();
  const currentDeps = new Map<string, SBOMDependency>();

  for (const dep of [...baseline.dependencies, ...baseline.devDependencies]) {
    baselineDeps.set(dep.name, dep);
  }

  for (const dep of [...current.dependencies, ...current.devDependencies]) {
    currentDeps.set(dep.name, dep);
  }

  // Detect added packages
  for (const [name, dep] of currentDeps) {
    if (!baselineDeps.has(name)) {
      drifts.push({
        timestamp: current.metadata.timestamp,
        type: "added",
        package: name,
        after: dep.version,
      });
    }
  }

  // Detect removed packages
  for (const [name, dep] of baselineDeps) {
    if (!currentDeps.has(name)) {
      drifts.push({
        timestamp: current.metadata.timestamp,
        type: "removed",
        package: name,
        before: dep.version,
      });
    }
  }

  // Detect version changes
  for (const [name, currentDep] of currentDeps) {
    const baselineDep = baselineDeps.get(name);
    if (baselineDep) {
      if (baselineDep.version !== currentDep.version) {
        drifts.push({
          timestamp: current.metadata.timestamp,
          type: "version_changed",
          package: name,
          before: baselineDep.version,
          after: currentDep.version,
        });
      }

      if (baselineDep.license !== currentDep.license) {
        drifts.push({
          timestamp: current.metadata.timestamp,
          type: "license_changed",
          package: name,
          before: baselineDep.license,
          after: currentDep.license,
        });
      }
    }
  }

  return drifts;
}

/**
 * Create baseline
 */
function createBaseline(sbom: SBOM): void {
  writeFileSync(BASELINE_PATH, JSON.stringify(sbom, null, 2), "utf8");
  console.log(`✅ Baseline created: ${BASELINE_PATH}`);
  console.log(`   Timestamp: ${sbom.metadata.timestamp}`);
  console.log(`   Dependencies: ${sbom.totalCount}\n`);
}

/**
 * Log drift
 */
function logDrift(drift: DriftEntry): void {
  const line = JSON.stringify(drift) + "\n";
  const content = existsSync(DRIFT_LOG) ? readFileSync(DRIFT_LOG, "utf8") : "";
  writeFileSync(DRIFT_LOG, content + line, "utf8");
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const showAge = args.includes("--age");
  const reset = args.includes("--reset");

  // Load current SBOM
  const current = loadSBOM(SBOM_PATH);
  if (!current) {
    console.error(`❌ SBOM not found: ${SBOM_PATH}\n`);
    console.error("   Run 'npm run sbom:generate' first\n");
    process.exit(1);
  }

  // Reset baseline
  if (reset) {
    createBaseline(current);
    console.log("🔄 Baseline reset complete\n");
    return;
  }

  // Load baseline
  let baseline = loadSBOM(BASELINE_PATH);
  if (!baseline) {
    console.log("⚠️  No baseline found - creating initial baseline...\n");
    createBaseline(current);
    process.exit(0);
  }

  // Calculate age
  const age = calculateAge(baseline);
  console.log(`📊 SBOM Status:`);
  console.log(`   Baseline: ${new Date(baseline.metadata.timestamp).toISOString()}`);
  console.log(`   Current:  ${new Date(current.metadata.timestamp).toISOString()}`);
  console.log(`   Age:      ${age} days\n`);

  if (showAge) {
    process.exit(0);
  }

  // Detect drift
  const drifts = detectDrift(baseline, current);
  const driftTypes = new Set(drifts.map((d) => d.type));

  console.log("🔍 Drift Detection:");
  console.log(`   Total changes: ${drifts.length}`);
  console.log(`   Change types:  ${driftTypes.size} (${Array.from(driftTypes).join(", ")})\n`);

  // Log all drifts
  for (const drift of drifts) {
    logDrift(drift);
  }

  // Print drift details
  if (drifts.length > 0) {
    console.log("📋 Changes:");
    for (const drift of drifts.slice(0, 10)) {
      const change =
        drift.type === "added"
          ? `ADDED ${drift.package}@${drift.after}`
          : drift.type === "removed"
            ? `REMOVED ${drift.package}@${drift.before}`
            : drift.type === "version_changed"
              ? `VERSION ${drift.package}: ${drift.before} → ${drift.after}`
              : `LICENSE ${drift.package}: ${drift.before} → ${drift.after}`;
      console.log(`   • ${change}`);
    }
    if (drifts.length > 10) {
      console.log(`   ... and ${drifts.length - 10} more\n`);
    }
    console.log();
  }

  // Evaluate risk
  const report: DriftReport = {
    age_days: age,
    drift_count: drifts.length,
    drift_types: driftTypes,
    drifts,
    recommendation: "",
    action_required: false,
  };

  console.log("=".repeat(60));
  console.log("📊 Risk Assessment");
  console.log("=".repeat(60));

  // Risk evaluation
  if (driftTypes.size >= MAX_DRIFT_THRESHOLD) {
    report.recommendation = "HIGH RISK - Re-lock to strict mode";
    report.action_required = true;

    console.log("\n🚨 HIGH RISK - Entropy Drift Detected!");
    console.log(`   Drift types: ${driftTypes.size} (threshold: ${MAX_DRIFT_THRESHOLD})`);
    console.log(`   Age: ${age} days (max: ${MAX_AGE_DAYS} days)\n`);
    console.log("⚠️  Action Required:");
    console.log("   1. Review all dependency changes");
    console.log("   2. Run: npm run sbom:generate");
    console.log("   3. Re-lock: SBOM_MODE=strict npm run sbom:verify");
    console.log("   4. Reset baseline: npm run entropy:monitor -- --reset\n");

    process.exit(1);
  } else if (age >= MAX_AGE_DAYS) {
    report.recommendation = "MODERATE RISK - Consider re-baseline";
    report.action_required = true;

    console.log(`\n⚠️  MODERATE RISK - SBOM age exceeds ${MAX_AGE_DAYS} days`);
    console.log(`   Current age: ${age} days\n`);
    console.log("💡 Recommendation:");
    console.log("   1. Verify no unexpected changes");
    console.log("   2. Re-generate: npm run sbom:generate");
    console.log("   3. Reset baseline: npm run entropy:monitor -- --reset\n");

    process.exit(1);
  } else {
    report.recommendation = "LOW RISK - Continue monitoring";
    report.action_required = false;

    console.log("\n✅ LOW RISK - Entropy within acceptable range");
    console.log(`   Drift types: ${driftTypes.size}/${MAX_DRIFT_THRESHOLD}`);
    console.log(`   Age: ${age}/${MAX_AGE_DAYS} days`);
    console.log(`   Changes: ${drifts.length}\n`);
    console.log("💡 Continue using adaptive mode safely\n");

    process.exit(0);
  }
}

main();
