/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * RG Artifact Writer
 *
 * Produces:
 * - reports/rg/summary.json
 * - reports/rg/decision.json
 * - reports/rg/policy-hash.txt
 * - reports/rg/evidence/*.jsonl (via other modules)
 */

import { writeFileSync } from "fs";
import { join } from "path";
import type { RGSummary, RGDecisionOutput } from "./types.js";

export async function writeArtifacts(
  projectRoot: string,
  summary: RGSummary,
  decision: RGDecisionOutput,
): Promise<void> {
  const reportsDir = join(projectRoot, "reports/rg");

  // Write summary.json
  const summaryPath = join(reportsDir, "summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // Write decision.json
  const decisionPath = join(reportsDir, "decision.json");
  writeFileSync(decisionPath, JSON.stringify(decision, null, 2));

  // Write policy-hash.txt
  const hashPath = join(reportsDir, "policy-hash.txt");
  writeFileSync(hashPath, summary.hashes.after || "unknown");

  console.log(`\n📦 Artifacts written to ${reportsDir}`);
}
