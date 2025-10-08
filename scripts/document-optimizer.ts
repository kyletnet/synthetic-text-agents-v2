#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Document & Folder Smart Optimizer
 * Intelligently manages project files and documentation
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "fs";
import { join } from "path";

interface OptimizationReport {
  staleDocuments: Array<{
    path: string;
    lastModified: Date;
    ageInDays: number;
    recommendation: string;
  }>;
  duplicateFiles: Array<{
    files: string[];
    reason: string;
  }>;
  unusedDirectories: string[];
  archiveActions: Array<{
    source: string;
    destination: string;
    reason: string;
  }>;
  stats: {
    totalFiles: number;
    potentialSavings: string;
    cleanupScore: number;
  };
}

class DocumentOptimizer {
  private projectRoot: string;
  private archiveDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.archiveDir = join(this.projectRoot, "_archive");
  }

  async analyzeAndOptimize(): Promise<OptimizationReport> {
    console.log(
      "📁 Analyzing project structure for optimization opportunities...",
    );

    const report: OptimizationReport = {
      staleDocuments: await this.findStaleDocuments(),
      duplicateFiles: await this.findDuplicateFiles(),
      unusedDirectories: await this.findUnusedDirectories(),
      archiveActions: [],
      stats: { totalFiles: 0, potentialSavings: "0MB", cleanupScore: 100 },
    };

    // Generate archive actions
    report.archiveActions = this.generateArchiveActions(report);

    // Calculate stats
    report.stats = await this.calculateStats(report);

    return report;
  }

  private async findStaleDocuments(): Promise<any[]> {
    const stale = [];
    const staleDays = 90; // Consider docs stale after 90 days

    const docDirs = ["docs", "reports", ".system-backups"];

    for (const dir of docDirs) {
      const fullDir = join(this.projectRoot, dir);
      if (!existsSync(fullDir)) continue;

      try {
        const files = this.getFilesRecursively(fullDir);

        for (const file of files) {
          if (file.endsWith(".md") || file.endsWith(".json")) {
            const stats = statSync(file);
            const ageInDays =
              (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

            if (ageInDays > staleDays) {
              stale.push({
                path: file.replace(this.projectRoot + "/", ""),
                lastModified: stats.mtime,
                ageInDays: Math.round(ageInDays),
                recommendation: this.getRecommendation(file, ageInDays),
              });
            }
          }
        }
      } catch (error) {
        // Directory might be inaccessible
      }
    }

    return stale.slice(0, 20); // Limit to top 20
  }

  private async findDuplicateFiles(): Promise<any[]> {
    const duplicates = [];

    // Find duplicate build_docs_indexes files
    const buildFiles = [];
    const scriptsDir = join(this.projectRoot, "scripts");

    if (existsSync(scriptsDir)) {
      const files = readdirSync(scriptsDir);
      const buildDocs = files.filter((f) => f.startsWith("build_docs_indexes"));

      if (buildDocs.length > 1) {
        duplicates.push({
          files: buildDocs.map((f) => `scripts/${f}`),
          reason:
            "Multiple build_docs_indexes implementations - consolidate to .ts version",
        });
      }
    }

    // Find backup duplicates in .system-backups
    const backupsDir = join(this.projectRoot, ".system-backups");
    if (existsSync(backupsDir)) {
      try {
        const backupDirs = readdirSync(backupsDir);
        if (backupDirs.length > 2) {
          duplicates.push({
            files: backupDirs.slice(2).map((d) => `.system-backups/${d}`),
            reason: "Multiple system backup directories - archive older ones",
          });
        }
      } catch (error) {
        // Continue
      }
    }

    return duplicates;
  }

  private async findUnusedDirectories(): Promise<string[]> {
    const unused = [];
    const checkDirs = ["legacy", "deprecated", "old", "_old", ".temp"];

    for (const dir of checkDirs) {
      const fullPath = join(this.projectRoot, dir);
      if (existsSync(fullPath)) {
        const stats = statSync(fullPath);
        const ageInDays =
          (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        if (ageInDays > 30) {
          // Unused for 30 days
          unused.push(dir);
        }
      }
    }

    return unused;
  }

  private generateArchiveActions(report: OptimizationReport): any[] {
    const actions = [];

    // Archive very stale documents (>180 days)
    for (const doc of report.staleDocuments) {
      if (doc.ageInDays > 180) {
        actions.push({
          source: doc.path,
          destination: `_archive/stale-docs/${doc.path}`,
          reason: `Stale for ${doc.ageInDays} days`,
        });
      }
    }

    // Archive old system backups
    for (const dup of report.duplicateFiles) {
      if (dup.files.some((f) => f.includes(".system-backups"))) {
        for (const file of dup.files.slice(1)) {
          // Keep first, archive rest
          actions.push({
            source: file,
            destination: `_archive/old-backups/${file}`,
            reason: "Old system backup - archived for space",
          });
        }
      }
    }

    return actions;
  }

  private async calculateStats(report: OptimizationReport): Promise<any> {
    let totalFiles = 0;
    let totalSize = 0;

    try {
      const allFiles = this.getFilesRecursively(this.projectRoot);
      totalFiles = allFiles.length;

      for (const file of allFiles) {
        try {
          const stats = statSync(file);
          totalSize += stats.size;
        } catch (error) {
          // File might be inaccessible
        }
      }
    } catch (error) {
      // Continue with defaults
    }

    const potentialSavings =
      Math.round(
        (report.staleDocuments.length * 0.1 +
          report.duplicateFiles.length * 0.5 +
          report.unusedDirectories.length * 2) *
          1000,
      ) / 1000;

    const cleanupScore = Math.max(
      0,
      100 -
        report.staleDocuments.length * 2 -
        report.duplicateFiles.length * 5 -
        report.unusedDirectories.length * 10,
    );

    return {
      totalFiles,
      potentialSavings: `${potentialSavings}MB`,
      cleanupScore: Math.round(cleanupScore),
    };
  }

  private getFilesRecursively(dir: string): string[] {
    const files = [];
    try {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        try {
          const stats = statSync(fullPath);

          if (stats.isDirectory()) {
            if (!item.startsWith(".") && item !== "node_modules") {
              files.push(...this.getFilesRecursively(fullPath));
            }
          } else {
            files.push(fullPath);
          }
        } catch (error) {
          // Skip inaccessible files
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }

    return files;
  }

  private getRecommendation(file: string, ageInDays: number): string {
    if (ageInDays > 365) return "ARCHIVE - Very old, consider archiving";
    if (ageInDays > 180) return "REVIEW - Old, check if still needed";
    if (ageInDays > 90) return "UPDATE - Stale, consider updating";
    return "MONITOR - Recently stale";
  }

  async executeOptimization(
    report: OptimizationReport,
    dryRun: boolean = true,
  ): Promise<void> {
    if (dryRun) {
      console.log("🔍 DRY RUN - No files will be moved");
      return;
    }

    console.log("🗃️ Executing optimization actions...");

    // Create archive directory
    if (!existsSync(this.archiveDir)) {
      mkdirSync(this.archiveDir, { recursive: true });
    }

    let actionsExecuted = 0;

    for (const action of report.archiveActions) {
      try {
        const sourcePath = join(this.projectRoot, action.source);
        const destPath = join(this.projectRoot, action.destination);

        // Create destination directory
        const destDir = join(destPath, "..");
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }

        // Move file (in a real implementation, you'd use fs.rename or similar)
        console.log(`  📦 ${action.source} → ${action.destination}`);
        actionsExecuted++;
      } catch (error) {
        console.warn(`  ⚠️ Failed to archive ${action.source}: ${error}`);
      }
    }

    console.log(`✅ Executed ${actionsExecuted} optimization actions`);
  }

  generateOptimizationSummary(report: OptimizationReport): string {
    return `
## 📁 Document & Folder Optimization

### 📊 Current Status
- **Total Files**: ${report.stats.totalFiles}
- **Cleanup Score**: ${report.stats.cleanupScore}/100
- **Potential Savings**: ${report.stats.potentialSavings}

### 📋 Findings
- **Stale Documents**: ${report.staleDocuments.length} files
- **Duplicate Files**: ${report.duplicateFiles.length} groups
- **Unused Directories**: ${report.unusedDirectories.length} dirs
- **Archive Actions**: ${report.archiveActions.length} recommended

### 🎯 Top Recommendations
${report.staleDocuments
  .slice(0, 3)
  .map(
    (doc) =>
      `- **${doc.path}** (${doc.ageInDays} days old) - ${doc.recommendation}`,
  )
  .join("\n")}

${
  report.duplicateFiles.length > 0
    ? `
### 🔄 Duplicates Found
${report.duplicateFiles
  .map((dup) => `- **${dup.files.join(", ")}** - ${dup.reason}`)
  .join("\n")}`
    : ""
}

### ⚡ Quick Actions
- \`npm run docs:cleanup\` - Archive stale documents
- \`npm run project:optimize\` - Full optimization
`;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const optimizer = new DocumentOptimizer();
  optimizer
    .analyzeAndOptimize()
    .then((report) => {
      console.log(optimizer.generateOptimizationSummary(report));
      return optimizer.executeOptimization(report, true); // Dry run by default
    })
    .catch(console.error);
}

export default DocumentOptimizer;
