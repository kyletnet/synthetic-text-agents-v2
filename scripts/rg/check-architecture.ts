/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * RG Architecture Check
 *
 * Verifies:
 * 1. DDD boundary rules via dependency-cruiser
 * 2. Meta-Kernel self-verification
 *
 * Produces: reports/rg/evidence/architecture.json
 */

import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import type { RGArchitectureResult } from "./types.js";

export async function checkArchitecture(
  projectRoot: string,
): Promise<{ passed: boolean; result: RGArchitectureResult }> {
  console.log("   🏗️  Checking architecture...");

  const result: RGArchitectureResult = {
    depcruise: {
      passed: true,
      errors: [],
    },
    metaKernel: {
      passed: true,
      issues: [],
    },
  };

  // 1. Check DDD boundaries with dependency-cruiser
  try {
    console.log("      • Running dependency-cruiser...");

    // Check if .dependency-cruiser.cjs exists
    const depcruiseConfig = join(projectRoot, ".dependency-cruiser.cjs");
    if (!existsSync(depcruiseConfig)) {
      console.log("      ⚠️  No .dependency-cruiser.cjs found - skipping");
    } else {
      try {
        const output = execSync(
          "npx depcruise --config .dependency-cruiser.cjs --output-type err src",
          {
            cwd: projectRoot,
            encoding: "utf8",
            stdio: "pipe",
          },
        );
        result.depcruise.passed = true;
        console.log("      ✅ No dependency errors");
      } catch (error: any) {
        // depcruise exits with non-zero on violations (errors OR warnings)
        // We only care about errors
        const output = error.stderr || error.stdout || "";
        const lines = output.split("\n");

        // Count only errors (ignore warnings)
        const errorLines = lines.filter((line: string) =>
          line.trim().startsWith("error"),
        );

        for (const line of errorLines) {
          // Format: "error rule-name: from → to"
          const match = line.match(/error\s+([^:]+):\s+(.+?)\s+→\s+(.+)/);
          if (match) {
            result.depcruise.errors.push({
              from: match[2].trim(),
              to: match[3].trim(),
              rule: match[1].trim(),
            });
          }
        }

        if (result.depcruise.errors.length > 0) {
          result.depcruise.passed = false;
          console.log(
            `      ❌ Found ${result.depcruise.errors.length} dependency errors`,
          );
        } else {
          result.depcruise.passed = true;
          console.log(`      ✅ No dependency errors (warnings ignored)`);
        }
      }
    }
  } catch (error) {
    console.error("      ❌ Dependency-cruiser check failed:", error);
    result.depcruise.passed = false;
  }

  // 2. Run Meta-Kernel self-verification
  try {
    console.log("      • Running Meta-Kernel self-verification...");

    const { verifySelfStructure } = await import(
      "../../src/core/governance/meta-kernel.js"
    );
    const metaResult = await verifySelfStructure(projectRoot);

    result.metaKernel.passed = metaResult.passed;
    result.metaKernel.issues = metaResult.issues;

    if (metaResult.passed) {
      console.log("      ✅ Meta-Kernel verification passed");
    } else {
      console.log(
        `      ❌ Meta-Kernel found ${metaResult.issues.length} issues`,
      );
      metaResult.issues.forEach((issue) => {
        console.log(`         - ${issue}`);
      });
    }
  } catch (error) {
    console.error("      ❌ Meta-Kernel check failed:", error);
    result.metaKernel.passed = false;
    result.metaKernel.issues.push(
      `Exception: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Write evidence
  const evidencePath = join(
    projectRoot,
    "reports/rg/evidence/architecture.json",
  );
  writeFileSync(evidencePath, JSON.stringify(result, null, 2));

  const passed = result.depcruise.passed && result.metaKernel.passed;
  return { passed, result };
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectRoot = process.cwd();
  checkArchitecture(projectRoot).then(({ passed, result }) => {
    console.log("\n" + "=".repeat(60));
    console.log("🏗️  Architecture Check Result");
    console.log("=".repeat(60));
    console.log(`DDD Boundaries: ${result.depcruise.passed ? "✅" : "❌"}`);
    console.log(`Meta-Kernel: ${result.metaKernel.passed ? "✅" : "❌"}`);
    console.log(`Overall: ${passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log("=".repeat(60));
    process.exit(passed ? 0 : 1);
  });
}
