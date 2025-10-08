#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Unified Audit Command
 *
 * Purpose:
 * - Single entry point for all audits
 * - Consolidates: advanced:audit, integration:audit, docs:audit
 * - Provides granular control with subcommands
 *
 * Usage:
 *   npm run /audit                 # All audits
 *   npm run /audit refactor        # Refactoring safety only
 *   npm run /audit integration     # Integration quality only
 *   npm run /audit docs            # Documentation quality only
 */

import { execSync } from "child_process";
import { InspectionCache } from "./lib/inspection-cache.js";

interface AuditResult {
  name: string;
  passed: boolean;
  duration: number;
  findings?: number;
  error?: string;
}

class UnifiedAuditor {
  private projectRoot: string;
  private results: AuditResult[] = [];
  private cache: InspectionCache;

  constructor() {
    this.projectRoot = process.cwd();
    this.cache = new InspectionCache(this.projectRoot);
  }

  async run(subcommand?: string): Promise<void> {
    console.log("🔍 Unified Audit System (Cache-Aware)");
    console.log("═".repeat(60));

    // Enforce /inspect first (Phase 2 integration)
    console.log("📋 Checking inspection cache...");
    this.cache.enforceInspectFirst("audit");

    const validation = this.cache.validateCache();
    if (!validation.valid || !validation.results) {
      console.error("❌ Cache validation failed");
      process.exit(1);
    }

    const age = this.cache.getCacheAge();
    console.log(`✅ Using inspection results from ${age}\n`);

    const startTime = Date.now();

    if (!subcommand || subcommand === "all") {
      await this.runAll();
    } else {
      await this.runSubcommand(subcommand);
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

    this.displayResults(totalDuration);
    this.exit();
  }

  private async runAll(): Promise<void> {
    console.log("📋 Running all audits...\n");

    await this.auditRefactor();
    await this.auditIntegration();
    await this.auditDocs();
  }

  private async runSubcommand(cmd: string): Promise<void> {
    console.log(`📋 Running ${cmd} audit...\n`);

    switch (cmd) {
      case "refactor":
      case "refactoring":
        await this.auditRefactor();
        break;
      case "integration":
        await this.auditIntegration();
        break;
      case "docs":
      case "documentation":
        await this.auditDocs();
        break;
      default:
        console.error(`❌ Unknown subcommand: ${cmd}`);
        console.error("   Valid: refactor, integration, docs");
        process.exit(1);
    }
  }

  private async auditRefactor(): Promise<void> {
    await this.execute("Refactoring Safety", "npm run advanced:audit --silent");
  }

  private async auditIntegration(): Promise<void> {
    await this.execute(
      "Integration Quality",
      "npm run integration:audit --silent",
    );
  }

  private async auditDocs(): Promise<void> {
    await this.execute(
      "Documentation Quality",
      "npm run docs:audit:full --silent",
    );
  }

  private async execute(name: string, command: string): Promise<void> {
    const startTime = Date.now();

    try {
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: "utf-8",
        stdio: "pipe",
      });

      const duration = Date.now() - startTime;

      // Extract findings count if available
      const findingsMatch = output.match(/(\d+)\s+(issue|finding|violation)/i);
      const findings = findingsMatch ? parseInt(findingsMatch[1]) : 0;

      this.results.push({ name, passed: true, duration, findings });
      console.log(
        `✅ ${name} passed (${(duration / 1000).toFixed(
          1,
        )}s, ${findings} findings)\n`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg =
        (error as any).stdout?.toString() || (error as Error).message;

      // Try to extract findings even on failure
      const findingsMatch = errorMsg.match(
        /(\d+)\s+(issue|finding|violation)/i,
      );
      const findings = findingsMatch ? parseInt(findingsMatch[1]) : undefined;

      this.results.push({
        name,
        passed: false,
        duration,
        findings,
        error: errorMsg,
      });
      console.log(
        `❌ ${name} failed (${(duration / 1000).toFixed(1)}s${
          findings ? `, ${findings} findings` : ""
        })\n`,
      );
    }
  }

  private displayResults(totalDuration: string): void {
    console.log("═".repeat(60));
    console.log("📊 Audit Summary");
    console.log("═".repeat(60));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const totalFindings = this.results.reduce(
      (sum, r) => sum + (r.findings || 0),
      0,
    );

    console.log(`✅ Passed: ${passed}/${this.results.length}`);
    console.log(`❌ Failed: ${failed}/${this.results.length}`);
    console.log(`🔍 Total findings: ${totalFindings}`);
    console.log(`⏱️  Total time: ${totalDuration}s`);

    if (failed > 0) {
      console.log("\n❌ Failed Audits:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(
            `   - ${r.name}${r.findings ? ` (${r.findings} findings)` : ""}`,
          );
        });
    }

    console.log("═".repeat(60));
  }

  private exit(): void {
    const failed = this.results.filter((r) => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Main execution
const args = process.argv.slice(2);
const subcommand = args[0];

const auditor = new UnifiedAuditor();
await auditor.run(subcommand);
