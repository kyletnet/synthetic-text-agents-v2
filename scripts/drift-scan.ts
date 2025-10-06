#!/usr/bin/env tsx

/**
 * Documentation-Code Drift Scanner
 *
 * Purpose:
 * - Detect when code changes but related documentation doesn't
 * - Track document staleness
 * - Auto-archive expired documents
 * - Notify owners of drift
 *
 * Usage:
 *   npm run docs:drift-scan           # Full scan
 *   npm run docs:drift-scan --fix     # Auto-update lastVerified
 *   npm run docs:drift-scan --report  # Generate detailed report
 */

import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import { execSync } from "child_process";

interface DocConfig {
  path: string;
  type: string;
  status: string;
  relatedCode: string[];
  relatedDocs?: string[];
  autoSyncEnabled: boolean;
  lastVerified: string;
  owner: string;
  reviewCycle: string;
  expiresAt?: string;
  archiveAfterExpiry?: boolean;
}

interface DriftReport {
  doc: string;
  status: "ok" | "warning" | "error" | "expired";
  staleDays: number;
  codeChanges: CodeChange[];
  recommendation: string;
}

interface CodeChange {
  file: string;
  lastModified: Date;
  daysSinceDocUpdate: number;
}

class DriftScanner {
  private rootDir: string;
  private config: any;
  private fix: boolean;
  private report: boolean;

  constructor() {
    this.rootDir = process.cwd();
    this.fix = process.argv.includes("--fix");
    this.report = process.argv.includes("--report");
    this.config = this.loadConfig();
  }

  private loadConfig(): any {
    const configPath = join(this.rootDir, ".docrc.json");

    if (!existsSync(configPath)) {
      console.error("❌ .docrc.json not found");
      console.error("💡 Run: npm run docs:init to create one");
      process.exit(1);
    }

    return JSON.parse(readFileSync(configPath, "utf8"));
  }

  async run(): Promise<void> {
    console.log("🔍 Documentation-Code Drift Scanner");
    console.log("═".repeat(60));

    if (!this.config.driftDetection?.enabled) {
      console.log("⚠️  Drift detection is disabled in .docrc.json");
      process.exit(0);
    }

    const drifts: DriftReport[] = [];

    for (const doc of this.config.docs) {
      const drift = await this.checkDrift(doc);
      drifts.push(drift);
    }

    // Print results
    this.printResults(drifts);

    // Generate report if requested
    if (this.report) {
      await this.generateReport(drifts);
    }

    // Exit with error if critical drifts found
    const errors = drifts.filter((d) => d.status === "error");
    if (errors.length > 0) {
      console.log(`\n❌ Found ${errors.length} critical drifts`);
      process.exit(1);
    }
  }

  private async checkDrift(doc: DocConfig): Promise<DriftReport> {
    const docPath = join(this.rootDir, doc.path);

    // Check if doc exists
    if (!existsSync(docPath)) {
      return {
        doc: doc.path,
        status: "error",
        staleDays: 0,
        codeChanges: [],
        recommendation:
          "Document not found - create or remove from .docrc.json",
      };
    }

    // Check expiry
    if (doc.expiresAt) {
      const expiryDate = new Date(doc.expiresAt);
      if (expiryDate < new Date()) {
        return {
          doc: doc.path,
          status: "expired",
          staleDays: Math.floor(
            (Date.now() - expiryDate.getTime()) / (1000 * 60 * 60 * 24),
          ),
          codeChanges: [],
          recommendation: doc.archiveAfterExpiry
            ? "Archive this document to docs/archived/"
            : "Update expiresAt or mark as active",
        };
      }
    }

    // Get last doc update
    const docLastModified = this.getLastModified(docPath);
    const lastVerified = new Date(doc.lastVerified);

    // Check related code changes
    const codeChanges: CodeChange[] = [];

    for (const codePattern of doc.relatedCode) {
      const files = glob.sync(codePattern, { cwd: this.rootDir });

      for (const file of files) {
        const filePath = join(this.rootDir, file);
        if (!existsSync(filePath)) continue;

        const fileLastModified = this.getLastModified(filePath);

        // If code changed after doc was last verified
        if (fileLastModified > lastVerified) {
          const daysSince = Math.floor(
            (fileLastModified.getTime() - lastVerified.getTime()) /
              (1000 * 60 * 60 * 24),
          );

          codeChanges.push({
            file,
            lastModified: fileLastModified,
            daysSinceDocUpdate: daysSince,
          });
        }
      }
    }

    // Determine status
    let status: "ok" | "warning" | "error" = "ok";
    const staleDays = Math.floor(
      (Date.now() - lastVerified.getTime()) / (1000 * 60 * 60 * 24),
    );

    const warningThreshold = this.config.driftDetection.thresholds.warningDays;
    const errorThreshold = this.config.driftDetection.thresholds.errorDays;

    if (codeChanges.length > 0) {
      const maxStaleDays = Math.max(
        ...codeChanges.map((c) => c.daysSinceDocUpdate),
      );

      if (maxStaleDays > errorThreshold) {
        status = "error";
      } else if (maxStaleDays > warningThreshold) {
        status = "warning";
      }
    }

    // Generate recommendation
    let recommendation = "Document is up to date";

    if (status === "warning") {
      recommendation = `Code changed ${codeChanges.length} time(s) since last verification. Review and update documentation.`;
    } else if (status === "error") {
      recommendation = `CRITICAL: Code significantly changed (${codeChanges.length} files). Documentation is likely outdated.`;
    }

    return {
      doc: doc.path,
      status,
      staleDays,
      codeChanges,
      recommendation,
    };
  }

  private getLastModified(filePath: string): Date {
    try {
      // Try Git first (more accurate)
      const timestamp = execSync(
        `git log -1 --format=%ai "${filePath}" 2>/dev/null`,
        { encoding: "utf8" },
      ).trim();

      if (timestamp) {
        return new Date(timestamp);
      }
    } catch (error) {
      // Fallback to filesystem
    }

    // Fallback to filesystem
    return statSync(filePath).mtime;
  }

  private printResults(drifts: DriftReport[]): void {
    console.log(`\n📊 Scan Results:\n`);

    const ok = drifts.filter((d) => d.status === "ok");
    const warnings = drifts.filter((d) => d.status === "warning");
    const errors = drifts.filter((d) => d.status === "error");
    const expired = drifts.filter((d) => d.status === "expired");

    console.log(`   ✅ Up to date: ${ok.length}`);
    console.log(`   ⚠️  Warnings: ${warnings.length}`);
    console.log(`   🔴 Errors: ${errors.length}`);
    console.log(`   ⏰ Expired: ${expired.length}`);

    // Print details for warnings and errors
    if (warnings.length > 0 || errors.length > 0 || expired.length > 0) {
      console.log(`\n📋 Details:\n`);

      for (const drift of [...expired, ...errors, ...warnings]) {
        const icon =
          drift.status === "error"
            ? "🔴"
            : drift.status === "expired"
            ? "⏰"
            : "⚠️";

        console.log(`${icon} ${drift.doc}`);
        console.log(`   Status: ${drift.status.toUpperCase()}`);
        console.log(`   Recommendation: ${drift.recommendation}`);

        if (drift.codeChanges.length > 0) {
          console.log(`   Related code changes:`);
          for (const change of drift.codeChanges.slice(0, 3)) {
            console.log(
              `      - ${change.file} (${change.daysSinceDocUpdate} days ago)`,
            );
          }
          if (drift.codeChanges.length > 3) {
            console.log(`      ... and ${drift.codeChanges.length - 3} more`);
          }
        }

        console.log();
      }
    }
  }

  private async generateReport(drifts: DriftReport[]): Promise<void> {
    const reportPath = join(this.rootDir, "reports", "doc-drift-report.json");

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: drifts.length,
        ok: drifts.filter((d) => d.status === "ok").length,
        warnings: drifts.filter((d) => d.status === "warning").length,
        errors: drifts.filter((d) => d.status === "error").length,
        expired: drifts.filter((d) => d.status === "expired").length,
      },
      drifts,
    };

    const { writeFileSync } = await import("fs");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run
const scanner = new DriftScanner();
await scanner.run();
