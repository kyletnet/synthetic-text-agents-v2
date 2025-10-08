#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Temporary Workaround Detection System
 * Intelligently scans codebase for temporary solutions and technical debt
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

interface WorkaroundFinding {
  file: string;
  line: number;
  content: string;
  type: "TODO" | "FIXME" | "HACK" | "TEMP" | "WORKAROUND";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  context: string;
  ageInDays?: number;
  estimation?: string;
}

interface WorkaroundReport {
  total: number;
  breakdown: Record<string, number>;
  criticalCount: number;
  highCount: number;
  findings: WorkaroundFinding[];
  stats: {
    oldestWorkaround: number;
    averageAge: number;
    filesAffected: number;
    estimatedEffort: string;
  };
  recommendations: string[];
}

class WorkaroundDetector {
  private projectRoot: string;
  private searchPatterns = {
    TODO: /\b(TODO|@todo)\b/gi,
    FIXME: /\b(FIXME|@fixme)\b/gi,
    HACK: /\b(HACK|@hack)\b/gi,
    TEMP: /\b(TEMP|@temp|temporary)\b/gi,
    WORKAROUND: /\b(WORKAROUND|@workaround)\b/gi,
  };

  constructor() {
    this.projectRoot = process.cwd();
  }

  async scanWorkarounds(): Promise<WorkaroundReport> {
    console.log("🔍 Scanning codebase for temporary workarounds...");

    const findings: WorkaroundFinding[] = [];

    // Scan TypeScript files in scripts and src directories
    const scanDirs = ["scripts", "src"];

    for (const dir of scanDirs) {
      const fullDir = join(this.projectRoot, dir);
      if (existsSync(fullDir)) {
        findings.push(...(await this.scanDirectory(fullDir)));
      }
    }

    // Additional grep-based scan for comprehensive coverage
    findings.push(...(await this.performGrepScan()));

    const report = this.generateReport(findings);
    return report;
  }

  private async scanDirectory(dir: string): Promise<WorkaroundFinding[]> {
    const findings: WorkaroundFinding[] = [];

    try {
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const stats = statSync(fullPath);

        if (stats.isDirectory()) {
          if (!item.startsWith(".") && item !== "node_modules") {
            findings.push(...(await this.scanDirectory(fullPath)));
          }
        } else if (
          item.endsWith(".ts") ||
          item.endsWith(".js") ||
          item.endsWith(".md")
        ) {
          findings.push(...(await this.scanFile(fullPath)));
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }

    return findings;
  }

  private async scanFile(filePath: string): Promise<WorkaroundFinding[]> {
    const findings: WorkaroundFinding[] = [];

    try {
      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      const stats = statSync(filePath);
      const ageInDays =
        (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        for (const [type, pattern] of Object.entries(this.searchPatterns)) {
          if (pattern.test(line)) {
            const finding: WorkaroundFinding = {
              file: filePath.replace(this.projectRoot + "/", ""),
              line: lineNum,
              content: line.trim(),
              type: type as WorkaroundFinding["type"],
              severity: this.calculateSeverity(type, line),
              context: this.getContext(lines, i),
              ageInDays: Math.round(ageInDays),
              estimation: this.estimateEffort(line),
            };

            findings.push(finding);
          }
        }
      }
    } catch (error) {
      // Skip unreadable files
    }

    return findings;
  }

  private async performGrepScan(): Promise<WorkaroundFinding[]> {
    const findings: WorkaroundFinding[] = [];

    try {
      const grepResult = execSync(
        'grep -r -n -E "(TODO|FIXME|HACK|TEMP|WORKAROUND)" scripts/ src/ --include="*.ts" --include="*.js" || true',
        { encoding: "utf8" },
      );

      const lines = grepResult
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      for (const line of lines) {
        const [file, lineNum, ...contentParts] = line.split(":");
        if (!file || !lineNum) continue;

        const content = contentParts.join(":").trim();
        const type = this.detectType(content);

        // Avoid duplicates from file scanning
        const isDuplicate = findings.some(
          (f) =>
            f.file === file.replace(this.projectRoot + "/", "") &&
            f.line === parseInt(lineNum),
        );

        if (!isDuplicate) {
          findings.push({
            file: file.replace(this.projectRoot + "/", ""),
            line: parseInt(lineNum),
            content:
              content.substring(0, 150) + (content.length > 150 ? "..." : ""),
            type,
            severity: this.calculateSeverity(type, content),
            context: "Detected via grep scan",
            estimation: this.estimateEffort(content),
          });
        }
      }
    } catch (error) {
      // Continue even if grep fails
    }

    return findings;
  }

  private detectType(content: string): WorkaroundFinding["type"] {
    const upperContent = content.toUpperCase();
    if (upperContent.includes("FIXME")) return "FIXME";
    if (upperContent.includes("HACK")) return "HACK";
    if (upperContent.includes("WORKAROUND")) return "WORKAROUND";
    if (upperContent.includes("TEMP")) return "TEMP";
    return "TODO";
  }

  private calculateSeverity(
    type: string,
    content: string,
  ): WorkaroundFinding["severity"] {
    const upperContent = content.toUpperCase();

    // Critical indicators
    if (
      upperContent.includes("CRITICAL") ||
      upperContent.includes("URGENT") ||
      upperContent.includes("ASAP") ||
      upperContent.includes("BLOCKING")
    ) {
      return "CRITICAL";
    }

    // High severity indicators
    if (
      type === "FIXME" ||
      type === "HACK" ||
      upperContent.includes("BUG") ||
      upperContent.includes("BROKEN") ||
      upperContent.includes("SECURITY") ||
      upperContent.includes("PERFORMANCE")
    ) {
      return "HIGH";
    }

    // Medium severity indicators
    if (
      type === "WORKAROUND" ||
      upperContent.includes("REFACTOR") ||
      upperContent.includes("IMPROVE") ||
      upperContent.includes("OPTIMIZE")
    ) {
      return "MEDIUM";
    }

    return "LOW";
  }

  private getContext(lines: string[], currentIndex: number): string {
    const start = Math.max(0, currentIndex - 1);
    const end = Math.min(lines.length - 1, currentIndex + 1);

    const contextLines = [];
    for (let i = start; i <= end; i++) {
      if (i !== currentIndex) {
        contextLines.push(lines[i].trim());
      }
    }

    return contextLines.join(" | ").substring(0, 100);
  }

  private estimateEffort(content: string): string {
    const upperContent = content.toUpperCase();

    // Complex effort indicators
    if (
      upperContent.includes("REFACTOR") ||
      upperContent.includes("REWRITE") ||
      upperContent.includes("ARCHITECTURE") ||
      upperContent.includes("MAJOR")
    ) {
      return "2-4 days";
    }

    // Medium effort indicators
    if (
      upperContent.includes("IMPLEMENT") ||
      upperContent.includes("ADD") ||
      upperContent.includes("CREATE")
    ) {
      return "4-8 hours";
    }

    // Simple effort indicators
    if (
      upperContent.includes("FIX") ||
      upperContent.includes("UPDATE") ||
      upperContent.includes("CHANGE")
    ) {
      return "1-2 hours";
    }

    return "30min-1 hour";
  }

  private generateReport(findings: WorkaroundFinding[]): WorkaroundReport {
    const breakdown: Record<string, number> = {
      TODO: 0,
      FIXME: 0,
      HACK: 0,
      TEMP: 0,
      WORKAROUND: 0,
    };

    let criticalCount = 0;
    let highCount = 0;
    let totalAge = 0;
    let ageCount = 0;
    const filesAffected = new Set<string>();

    for (const finding of findings) {
      breakdown[finding.type]++;

      if (finding.severity === "CRITICAL") criticalCount++;
      if (finding.severity === "HIGH") highCount++;

      filesAffected.add(finding.file);

      if (finding.ageInDays !== undefined) {
        totalAge += finding.ageInDays;
        ageCount++;
      }
    }

    const averageAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;
    const oldestWorkaround = Math.max(...findings.map((f) => f.ageInDays || 0));

    const recommendations = this.generateRecommendations(findings, breakdown);

    return {
      total: findings.length,
      breakdown,
      criticalCount,
      highCount,
      findings: findings.sort((a, b) => {
        // Sort by severity, then by age
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const severityDiff =
          severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return (b.ageInDays || 0) - (a.ageInDays || 0);
      }),
      stats: {
        oldestWorkaround,
        averageAge,
        filesAffected: filesAffected.size,
        estimatedEffort: this.calculateTotalEffort(findings),
      },
      recommendations,
    };
  }

  private generateRecommendations(
    findings: WorkaroundFinding[],
    breakdown: Record<string, number>,
  ): string[] {
    const recommendations = [];

    if (findings.filter((f) => f.severity === "CRITICAL").length > 0) {
      recommendations.push(
        "🚨 Address CRITICAL workarounds immediately - they may block development",
      );
    }

    if (breakdown.HACK > 3) {
      recommendations.push(
        "🔧 High number of HACKs detected - schedule refactoring session",
      );
    }

    if (breakdown.FIXME > 5) {
      recommendations.push(
        "🐛 Many FIXME items - prioritize bug fixing in next sprint",
      );
    }

    if (findings.filter((f) => (f.ageInDays || 0) > 90).length > 0) {
      recommendations.push(
        "📅 Some workarounds are >90 days old - review if still needed",
      );
    }

    if (findings.length > 20) {
      recommendations.push(
        "📊 High technical debt - consider dedicated cleanup milestone",
      );
    } else if (findings.length > 10) {
      recommendations.push(
        "🧹 Moderate technical debt - allocate 20% time for cleanup",
      );
    } else if (findings.length <= 5) {
      recommendations.push(
        "✅ Low technical debt - maintain current practices",
      );
    }

    return recommendations;
  }

  private calculateTotalEffort(findings: WorkaroundFinding[]): string {
    const effortHours = findings.reduce((total, finding) => {
      const effort = finding.estimation || "1 hour";

      if (effort.includes("days")) {
        const days = parseFloat(effort.match(/\d+/)?.[0] || "1");
        return total + days * 8; // 8 hours per day
      } else if (effort.includes("hours")) {
        const hours = parseFloat(effort.match(/\d+/)?.[0] || "1");
        return total + hours;
      } else {
        return total + 0.5; // Default 30min
      }
    }, 0);

    if (effortHours < 8) {
      return `${Math.round(effortHours)}h`;
    } else {
      const days = Math.round((effortHours / 8) * 10) / 10;
      return `${days}d`;
    }
  }

  generateWorkaroundSummary(report: WorkaroundReport): string {
    return `
## 🔍 Temporary Workarounds Analysis

### 📊 Overview
- **Total Found**: ${report.total}
- **Critical**: ${report.criticalCount}
- **High Priority**: ${report.highCount}
- **Files Affected**: ${report.stats.filesAffected}
- **Estimated Effort**: ${report.stats.estimatedEffort}

### 📋 Breakdown by Type
- **TODO**: ${report.breakdown.TODO}
- **FIXME**: ${report.breakdown.FIXME}
- **HACK**: ${report.breakdown.HACK}
- **TEMP**: ${report.breakdown.TEMP}
- **WORKAROUND**: ${report.breakdown.WORKAROUND}

### ⚠️ Top Priority Items
${report.findings
  .slice(0, 5)
  .map(
    (finding) =>
      `- **${finding.file}:${finding.line}** (${finding.severity})\n  \`${finding.content}\``,
  )
  .join("\n")}

### 📈 Statistics
- **Oldest Workaround**: ${report.stats.oldestWorkaround} days
- **Average Age**: ${report.stats.averageAge} days

### 🎯 Recommendations
${report.recommendations.map((rec) => `- ${rec}`).join("\n")}

### 🔧 Quick Actions
- \`npm run fix\` - Auto-fix simple issues
- Review critical items in next planning session
- Schedule dedicated cleanup time for high-priority items
`;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const detector = new WorkaroundDetector();
  detector
    .scanWorkarounds()
    .then((report) => {
      console.log(detector.generateWorkaroundSummary(report));
    })
    .catch(console.error);
}

export default WorkaroundDetector;
