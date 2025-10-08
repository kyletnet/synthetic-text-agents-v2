#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Entropy Predictor - Predictive Integrity Guard
 *
 * Purpose:
 * - Predict SBOM drift based on historical change rate
 * - Auto-recommend strict re-lock before threshold breach
 * - Learning baseline: First 3 drifts = warnings only
 *
 * Usage:
 *   npm run entropy:predictor                # Analyze current trend
 *   npm run entropy:predictor -- --weeks 4   # Predict 4 weeks ahead
 *   npm run entropy:predictor -- --auto-lock # Auto strict mode if HIGH RISK
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DRIFT_LOG = join(process.cwd(), "reports/sbom-drift.jsonl");
const PREDICTION_REPORT = join(process.cwd(), "reports/entropy-prediction.json");
const LEARNING_BASELINE_COUNT = 3; // First 3 drifts = learning phase

interface DriftEntry {
  timestamp: string;
  type: "added" | "removed" | "version_changed" | "license_changed";
  package: string;
  before?: string;
  after?: string;
}

interface PredictionResult {
  current_drift_count: number;
  drift_rate_per_week: number;
  predicted_drift_4_weeks: number;
  risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  recommendation: string;
  auto_lock_recommended: boolean;
  learning_phase: boolean;
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║   Entropy Predictor - Predictive Integrity Guard          ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

/**
 * Load drift log
 */
function loadDriftLog(): DriftEntry[] {
  if (!existsSync(DRIFT_LOG)) {
    return [];
  }

  const content = readFileSync(DRIFT_LOG, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line) => JSON.parse(line));
}

/**
 * Calculate drift rate
 */
function calculateDriftRate(drifts: DriftEntry[]): number {
  if (drifts.length === 0) return 0;

  // Get time range
  const timestamps = drifts.map((d) => new Date(d.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  const timeRangeMs = maxTime - minTime;
  const timeRangeWeeks = timeRangeMs / (1000 * 60 * 60 * 24 * 7);

  if (timeRangeWeeks === 0) return drifts.length; // All in same week

  return drifts.length / timeRangeWeeks;
}

/**
 * Predict future drift
 */
function predictDrift(driftRatePerWeek: number, weeks: number): number {
  // Simple linear prediction
  // Could be enhanced with exponential smoothing or ML
  return Math.ceil(driftRatePerWeek * weeks);
}

/**
 * Assess risk level
 */
function assessRisk(
  predictedDrift: number,
  currentDriftCount: number
): PredictionResult["risk_level"] {
  const driftTypes = predictedDrift; // Simplified: assume each drift is unique type

  if (driftTypes >= 5) return "CRITICAL";
  if (driftTypes >= 3) return "HIGH";
  if (driftTypes >= 2) return "MODERATE";
  return "LOW";
}

/**
 * Generate recommendation
 */
function generateRecommendation(
  riskLevel: string,
  learningPhase: boolean
): string {
  if (learningPhase) {
    return `Learning phase (${LEARNING_BASELINE_COUNT} drifts) - Monitoring only`;
  }

  switch (riskLevel) {
    case "CRITICAL":
      return "CRITICAL: Immediate strict re-lock required";
    case "HIGH":
      return "HIGH RISK: Schedule strict re-lock within 1 week";
    case "MODERATE":
      return "MODERATE: Consider strict re-lock within 2 weeks";
    case "LOW":
    default:
      return "LOW RISK: Continue adaptive mode monitoring";
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const weeksArg = args.find((arg) => arg.startsWith("--weeks"));
  const weeks = weeksArg ? parseInt(weeksArg.split("=")[1], 10) : 4;
  const autoLock = args.includes("--auto-lock");

  console.log(`📊 Analysis Period: ${weeks} weeks\n`);

  // Load drift history
  const drifts = loadDriftLog();

  console.log(`📈 Historical Data:`);
  console.log(`   Total drifts recorded: ${drifts.length}`);

  if (drifts.length === 0) {
    console.log("\n✅ No drift history - baseline is clean\n");
    console.log("💡 Recommendation:");
    console.log("   Continue with adaptive mode\n");
    process.exit(0);
  }

  // Calculate drift rate
  const driftRate = calculateDriftRate(drifts);
  console.log(`   Drift rate: ${driftRate.toFixed(2)} changes/week\n`);

  // Predict future drift
  const predictedDrift = predictDrift(driftRate, weeks);
  console.log(`🔮 Prediction (${weeks} weeks):`);
  console.log(`   Predicted drift count: ${predictedDrift}`);

  // Check if in learning phase
  const learningPhase = drifts.length <= LEARNING_BASELINE_COUNT;
  if (learningPhase) {
    console.log(`   📚 Learning phase: ${drifts.length}/${LEARNING_BASELINE_COUNT} drifts\n`);
  } else {
    console.log();
  }

  // Assess risk
  const riskLevel = assessRisk(predictedDrift, drifts.length);
  const recommendation = generateRecommendation(riskLevel, learningPhase);
  const autoLockRecommended = riskLevel === "HIGH" || riskLevel === "CRITICAL";

  const result: PredictionResult = {
    current_drift_count: drifts.length,
    drift_rate_per_week: driftRate,
    predicted_drift_4_weeks: predictedDrift,
    risk_level: riskLevel,
    recommendation,
    auto_lock_recommended: autoLockRecommended && !learningPhase,
    learning_phase: learningPhase,
  };

  // Save prediction report
  writeFileSync(PREDICTION_REPORT, JSON.stringify(result, null, 2), "utf8");

  console.log("=".repeat(60));
  console.log("📊 Risk Assessment");
  console.log("=".repeat(60));

  const riskIcon =
    riskLevel === "CRITICAL"
      ? "🚨"
      : riskLevel === "HIGH"
        ? "⚠️ "
        : riskLevel === "MODERATE"
          ? "💡"
          : "✅";

  console.log(`${riskIcon} Risk Level: ${riskLevel}`);
  console.log(`   ${recommendation}\n`);

  if (learningPhase) {
    console.log("📚 Learning Baseline Active:");
    console.log(`   First ${LEARNING_BASELINE_COUNT} drifts are for baseline calibration`);
    console.log(`   Current: ${drifts.length}/${LEARNING_BASELINE_COUNT}`);
    console.log(`   Remaining: ${LEARNING_BASELINE_COUNT - drifts.length}\n`);
  }

  if (autoLockRecommended && !learningPhase) {
    console.log("⚠️  Auto-Lock Recommendation:");
    console.log("   Run: npm run sbom:generate");
    console.log("   Then: SBOM_MODE=strict npm run sbom:verify");
    console.log("   Reset baseline: npm run entropy:monitor -- --reset\n");

    if (autoLock) {
      console.log("🔒 Auto-lock mode enabled - executing...\n");
      console.log("   [SIMULATION] Would execute:");
      console.log("   1. npm run sbom:generate");
      console.log("   2. SBOM_MODE=strict npm run sbom:verify");
      console.log("   3. npm run entropy:monitor -- --reset\n");
      console.log("   (Actual execution disabled for safety)\n");
    }
  }

  console.log(`📄 Prediction report saved: ${PREDICTION_REPORT}\n`);

  // Exit codes
  if (riskLevel === "CRITICAL" || (riskLevel === "HIGH" && !learningPhase)) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
