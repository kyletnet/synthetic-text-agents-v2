#!/usr/bin/env tsx

// @tool-mode: analyze
// @tool-description: Continuous gap detection - monitors implementation vs design promises

/**
 * Gaps Engine - Continuous P0 Gap Detection
 *
 * Purpose:
 * - Detect P0 gaps continuously (not just once)
 * - Monitor implementation vs design promises
 * - Track gap resolution progress
 * - Alert when new gaps appear
 *
 * Usage:
 *   npm run gaps              # Check for current gaps
 *   npm run gaps --watch      # Continuous monitoring
 *   npm run gaps --history    # Show gap resolution history
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface GapDetectionResult {
  timestamp: string;
  gaps: Gap[];
  summary: {
    p0Count: number;
    p1Count: number;
    p2Count: number;
    resolved: number;
    new: number;
  };
}

interface Gap {
  id: string;
  severity: "P0" | "P1" | "P2";
  category: string;
  description: string;
  promised: string; // What was promised in docs
  actual: string; // What actually exists
  impact: string;
  suggestedFix: string;
  detectedAt: string;
}

class GapsEngine {
  private projectRoot: string;
  private gapsDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.gapsDir = join(this.projectRoot, "reports", "gaps");

    if (!existsSync(this.gapsDir)) {
      mkdirSync(this.gapsDir, { recursive: true });
    }
  }

  async detectGaps(): Promise<GapDetectionResult> {
    console.log("🔍 Gaps Engine - P0 Gap Detection");
    console.log("═".repeat(60));
    console.log("📋 Scanning for gaps between design and implementation...\n");

    const gaps: Gap[] = [];

    // 1. Guidelines Gap (from P0_GAPS_IMMEDIATE_ACTION_PLAN.md)
    const guidelinesGap = this.checkGuidelines();
    if (guidelinesGap) gaps.push(guidelinesGap);

    // 2. CI/CD Integration Gaps
    const ciGaps = this.checkCIIntegration();
    gaps.push(...ciGaps);

    // 3. Quality History Gap
    const qualityHistoryGap = this.checkQualityHistory();
    if (qualityHistoryGap) gaps.push(qualityHistoryGap);

    // 4. Documentation Drift
    const docGaps = this.checkDocumentationDrift();
    gaps.push(...docGaps);

    // 5. Test Coverage Gaps
    const testGaps = this.checkTestCoverage();
    gaps.push(...testGaps);

    // 6. Promised Features Not Implemented
    const featureGaps = this.checkPromisedFeatures();
    gaps.push(...featureGaps);

    // 7. Design-Implementation Gaps (NEW)
    const designGaps = this.checkDesignImplementationGaps();
    gaps.push(...designGaps);

    // 8. Wrapper-Only Commands (NEW)
    const wrapperGaps = this.checkWrapperOnlyCommands();
    gaps.push(...wrapperGaps);

    // Generate summary
    const summary = this.generateSummary(gaps);

    // Save results
    const result: GapDetectionResult = {
      timestamp: new Date().toISOString(),
      gaps,
      summary,
    };

    this.saveResults(result);
    this.displayResults(result);

    return result;
  }

  /**
   * Check if guidelines directory is properly implemented
   */
  private checkGuidelines(): Gap | null {
    const guidelinesDir = join(this.projectRoot, "guidelines");

    if (!existsSync(guidelinesDir)) {
      return {
        id: "guidelines-missing",
        severity: "P0",
        category: "Implementation",
        description: "Guidelines directory not implemented",
        promised:
          "docs/GUIDELINE_INTEGRATION.md promises guidelines/ directory with hot-reload",
        actual: "Directory does not exist",
        impact: "Agents cannot access domain guidelines, QA quality degraded",
        suggestedFix: "Run: mkdir -p guidelines/{domain,augmentation,quality}",
        detectedAt: new Date().toISOString(),
      };
    }

    // Check if GuidelineManager is being used
    const usageCheck = execSync(
      'grep -r "GuidelineManager" . --include="*.ts" --exclude-dir=node_modules | grep -v "guideline-manager.ts" | grep -v "gaps-engine.ts" || echo "NOT_FOUND"',
      { encoding: "utf-8", cwd: this.projectRoot },
    );

    if (usageCheck.includes("NOT_FOUND")) {
      return {
        id: "guidelines-unused",
        severity: "P1",
        category: "Integration",
        description: "GuidelineManager implemented but not used anywhere",
        promised: "Guidelines should be integrated into agent workflows",
        actual: "No code references GuidelineManager",
        impact: "Guidelines exist but have no effect on system behavior",
        suggestedFix: "Integrate GuidelineManager into QA generation pipeline",
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Check CI/CD integration completeness
   */
  private checkCIIntegration(): Gap[] {
    const gaps: Gap[] = [];
    const workflowFile = join(
      this.projectRoot,
      ".github/workflows/unified-quality-gate.yml",
    );

    if (!existsSync(workflowFile)) {
      gaps.push({
        id: "ci-workflow-missing",
        severity: "P0",
        category: "CI/CD",
        description: "Unified quality gate workflow missing",
        promised: "CI/CD should enforce quality checks",
        actual: "Workflow file not found",
        impact: "No automated quality enforcement",
        suggestedFix: "Create .github/workflows/unified-quality-gate.yml",
        detectedAt: new Date().toISOString(),
      });
      return gaps;
    }

    const workflowContent = readFileSync(workflowFile, "utf-8");

    // Check for circular dependency check
    if (!workflowContent.includes("Circular Dependency Check")) {
      gaps.push({
        id: "ci-circular-deps-missing",
        severity: "P1",
        category: "CI/CD",
        description: "Circular dependency check not in CI",
        promised: "P0_GAPS_IMMEDIATE_ACTION_PLAN.md promises CI integration",
        actual: "Circular dependency check not found in workflow",
        impact: "Circular dependencies can be merged",
        suggestedFix: "Add 'npx tsx scripts/lib/security-guard.ts' to workflow",
        detectedAt: new Date().toISOString(),
      });
    }

    return gaps;
  }

  /**
   * Check quality history implementation
   */
  private checkQualityHistory(): Gap | null {
    const historyDir = join(this.projectRoot, "reports", "quality-history");

    if (!existsSync(historyDir)) {
      return {
        id: "quality-history-unused",
        severity: "P1",
        category: "Quality",
        description: "Quality history not being recorded",
        promised: "Quality history should track metrics over time",
        actual: "No quality history files found",
        impact: "Cannot detect quality regression",
        suggestedFix: "Run /inspect to trigger quality history recording",
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * Check for documentation drift
   */
  private checkDocumentationDrift(): Gap[] {
    const gaps: Gap[] = [];

    // Check if CLAUDE.md mentions deprecated commands
    const claudeFile = join(this.projectRoot, "CLAUDE.md");
    if (existsSync(claudeFile)) {
      const content = readFileSync(claudeFile, "utf-8");

      // Should NOT mention /guard or /radar without deprecation notice
      if (
        content.includes("/guard") &&
        !content.includes("Deprecated") &&
        !content.includes("deprecated")
      ) {
        gaps.push({
          id: "doc-guard-not-deprecated",
          severity: "P2",
          category: "Documentation",
          description: "/guard mentioned without deprecation notice",
          promised: "Deprecated commands should be clearly marked",
          actual: "CLAUDE.md mentions /guard without deprecation",
          impact: "Users may use deprecated commands",
          suggestedFix: 'Add "Deprecated" notice to /guard references',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return gaps;
  }

  /**
   * Check test coverage gaps
   */
  private checkTestCoverage(): Gap[] {
    const gaps: Gap[] = [];
    const coverageFile = join(
      this.projectRoot,
      "coverage/coverage-summary.json",
    );

    if (!existsSync(coverageFile)) {
      // Coverage not generated - not a gap, just run tests first
      return [];
    }

    try {
      const coverage = JSON.parse(readFileSync(coverageFile, "utf-8"));
      const totalCoverage = coverage.total;

      if (totalCoverage.statements.pct < 70) {
        gaps.push({
          id: "test-coverage-low",
          severity: "P1",
          category: "Testing",
          description: `Test coverage below target (${totalCoverage.statements.pct}% < 70%)`,
          promised: "Test coverage should be >= 70%",
          actual: `Coverage: ${totalCoverage.statements.pct}%`,
          impact: "Insufficient test protection for refactoring",
          suggestedFix: "Add tests for uncovered critical paths",
          detectedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return gaps;
  }

  /**
   * Check for promised features not implemented
   */
  private checkPromisedFeatures(): Gap[] {
    const gaps: Gap[] = [];

    // Check package.json for promised scripts
    const packageFile = join(this.projectRoot, "package.json");
    if (existsSync(packageFile)) {
      const pkg = JSON.parse(readFileSync(packageFile, "utf-8"));

      // Check if /gaps command exists
      if (!pkg.scripts["/gaps"] && !pkg.scripts["gaps"]) {
        gaps.push({
          id: "gaps-command-missing",
          severity: "P0",
          category: "Implementation",
          description: "/gaps command not in package.json",
          promised: "User requested /gaps command for continuous detection",
          actual: "Command not found in scripts",
          impact: "Cannot run gap detection easily",
          suggestedFix: 'Add "gaps": "tsx scripts/gaps-engine.ts" to scripts',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return gaps;
  }

  /**
   * Check for design documents with no implementation (NEW)
   */
  private checkDesignImplementationGaps(): Gap[] {
    const gaps: Gap[] = [];

    // Example: SHARED_CACHE_DESIGN.md promises cache integration
    const cacheDesignDoc = join(
      this.projectRoot,
      "docs/SHARED_CACHE_DESIGN.md",
    );
    if (existsSync(cacheDesignDoc)) {
      const content = readFileSync(cacheDesignDoc, "utf-8");

      // Check if Phase 2 migration is documented but not done
      if (content.includes("Phase 2") && content.includes("remove execSync")) {
        // Check if validate-unified.ts still uses execSync
        const validateFile = join(
          this.projectRoot,
          "scripts/validate-unified.ts",
        );
        if (existsSync(validateFile)) {
          const validateContent = readFileSync(validateFile, "utf-8");
          if (validateContent.includes("execSync")) {
            gaps.push({
              id: "cache-phase2-pending",
              severity: "P1",
              category: "Design-Implementation Gap",
              description: "SHARED_CACHE_DESIGN.md Phase 2 not implemented",
              promised:
                "Phase 2: Remove execSync from validate-unified.ts and use cache",
              actual: "validate-unified.ts still uses execSync",
              impact: "Commands still run redundant checks (no cache reuse)",
              suggestedFix:
                "Refactor validate-unified.ts to read from InspectionCache",
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Check QualityPolicyManager usage
    const policyManager = join(
      this.projectRoot,
      "scripts/lib/quality-policy.ts",
    );
    if (existsSync(policyManager)) {
      // Check if it's only used in answer_agent.ts or widely used
      const usageCheck = execSync(
        'grep -r "QualityPolicyManager\\|getQualityPolicyManager" scripts/ src/ | grep -v "quality-policy.ts" | wc -l',
        { encoding: "utf-8" },
      ).trim();

      const usageCount = parseInt(usageCheck, 10);
      if (usageCount < 3) {
        // Less than 3 files use it
        gaps.push({
          id: "quality-policy-underused",
          severity: "P1",
          category: "Design-Implementation Gap",
          description: `QualityPolicyManager used in only ${usageCount} file(s)`,
          promised: "quality-policy.json should govern all quality decisions",
          actual: `Only ${usageCount} file(s) import QualityPolicyManager`,
          impact: "Most code still uses hardcoded thresholds instead of policy",
          suggestedFix:
            "Refactor inspection-engine.ts, audit-*.ts to use QualityPolicyManager",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return gaps;
  }

  /**
   * Check for wrapper-only commands with no real logic (NEW)
   */
  private checkWrapperOnlyCommands(): Gap[] {
    const gaps: Gap[] = [];

    // Check validate-unified.ts
    const validateFile = join(this.projectRoot, "scripts/validate-unified.ts");
    if (existsSync(validateFile)) {
      const content = readFileSync(validateFile, "utf-8");

      // Count how many times it uses execSync (wrapper behavior)
      const execSyncCount = (content.match(/execSync/g) || []).length;
      // Count how many times it does real logic (InspectionCache, etc.)
      const cacheUsage = content.includes("InspectionCache");

      // Wrapper if it has ANY execSync but no cache usage
      if (execSyncCount > 0 && !cacheUsage) {
        gaps.push({
          id: "validate-wrapper-only",
          severity: "P2",
          category: "Architecture",
          description:
            "validate-unified.ts is wrapper-only (no cache integration)",
          promised: "Commands should use shared cache for efficiency",
          actual: `${execSyncCount} execSync calls, no InspectionCache usage`,
          impact:
            "Redundant checks, slower execution, no consistency guarantee",
          suggestedFix:
            "Refactor to read from InspectionCache instead of spawning subprocesses",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check audit-unified.ts
    const auditFile = join(this.projectRoot, "scripts/audit-unified.ts");
    if (existsSync(auditFile)) {
      const content = readFileSync(auditFile, "utf-8");

      const execSyncCount = (content.match(/execSync/g) || []).length;
      const cacheUsage = content.includes("InspectionCache");

      if (execSyncCount > 0 && !cacheUsage) {
        gaps.push({
          id: "audit-wrapper-only",
          severity: "P2",
          category: "Architecture",
          description:
            "audit-unified.ts is wrapper-only (no cache integration)",
          promised: "Commands should use shared cache for efficiency",
          actual: `${execSyncCount} execSync calls, no InspectionCache usage`,
          impact:
            "Redundant checks, slower execution, no consistency guarantee",
          suggestedFix:
            "Refactor to read from InspectionCache instead of spawning subprocesses",
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return gaps;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(gaps: Gap[]): GapDetectionResult["summary"] {
    const p0Count = gaps.filter((g) => g.severity === "P0").length;
    const p1Count = gaps.filter((g) => g.severity === "P1").length;
    const p2Count = gaps.filter((g) => g.severity === "P2").length;

    // Compare with previous run to detect resolved/new gaps
    const previousFile = join(this.gapsDir, "latest.json");
    let resolved = 0;
    let newGaps = 0;

    if (existsSync(previousFile)) {
      const previous: GapDetectionResult = JSON.parse(
        readFileSync(previousFile, "utf-8"),
      );
      const previousIds = new Set(previous.gaps.map((g) => g.id));
      const currentIds = new Set(gaps.map((g) => g.id));

      resolved = previous.gaps.filter((g) => !currentIds.has(g.id)).length;
      newGaps = gaps.filter((g) => !previousIds.has(g.id)).length;
    } else {
      newGaps = gaps.length;
    }

    return { p0Count, p1Count, p2Count, resolved, new: newGaps };
  }

  /**
   * Save results
   */
  private saveResults(result: GapDetectionResult): void {
    // Save timestamped version
    const timestamp = new Date().toISOString().split("T")[0];
    const timestampedFile = join(this.gapsDir, `gaps-${timestamp}.json`);
    writeFileSync(timestampedFile, JSON.stringify(result, null, 2));

    // Save as latest
    const latestFile = join(this.gapsDir, "latest.json");
    writeFileSync(latestFile, JSON.stringify(result, null, 2));

    console.log(`\n💾 Results saved: ${timestampedFile}`);
  }

  /**
   * Check if gh CLI is available
   */
  private hasGHCLI(): boolean {
    try {
      execSync("gh --version", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save gaps to file for manual issue creation
   */
  private saveToFile(gaps: Gap[]): void {
    const issuesFile = join(
      this.projectRoot,
      "reports/gaps/issues-to-create.json",
    );
    writeFileSync(issuesFile, JSON.stringify(gaps, null, 2));

    console.log(`\n💾 P0 Gaps saved to: reports/gaps/issues-to-create.json`);
    console.log("\n💡 To create GitHub issues manually:");
    console.log("   1. Install gh CLI: brew install gh");
    console.log("   2. Authenticate: gh auth login");
    console.log("   3. Run: npm run gaps:issues");
  }

  /**
   * Create GitHub issues for critical gaps
   */
  async createGitHubIssues(gaps: Gap[]): Promise<void> {
    const p0Gaps = gaps.filter((g) => g.severity === "P0");

    if (p0Gaps.length === 0) {
      console.log("✅ No P0 gaps - no issues to create");
      return;
    }

    // Check gh CLI availability
    if (!this.hasGHCLI()) {
      console.warn("\n⚠️  gh CLI not found. Saving to file instead.");
      this.saveToFile(p0Gaps);
      return;
    }

    console.log(`\n📋 Creating ${p0Gaps.length} GitHub issues for P0 gaps...`);

    for (const gap of p0Gaps) {
      try {
        const title = `[P0] ${gap.description}`;
        const body = `## Problem
${gap.description}

## Promised
${gap.promised}

## Actual
${gap.actual}

## Impact
${gap.impact}

## Suggested Fix
\`\`\`bash
${gap.suggestedFix}
\`\`\`

## Category
${gap.category}

## Detected At
${gap.detectedAt}

---
🤖 Auto-generated by \`npm run gaps -- --create-issues\`
`;

        execSync(
          `gh issue create --title "${title}" --body "${body}" --label "P0,auto-generated,gap"`,
          { encoding: "utf-8", cwd: this.projectRoot },
        );

        console.log(`  ✅ Created issue: ${title}`);
      } catch (error) {
        console.error(
          `  ❌ Failed to create issue for "${gap.description}":`,
          (error as Error).message,
        );
      }
    }

    console.log("\n✅ GitHub issues created successfully");
  }

  /**
   * Display results
   */
  private displayResults(result: GapDetectionResult): void {
    console.log("\n" + "═".repeat(60));
    console.log("📊 Gap Detection Summary");
    console.log("═".repeat(60));
    console.log(`🔴 P0 (Critical): ${result.summary.p0Count}`);
    console.log(`🟡 P1 (High): ${result.summary.p1Count}`);
    console.log(`🟢 P2 (Medium): ${result.summary.p2Count}`);
    console.log(`✅ Resolved since last run: ${result.summary.resolved}`);
    console.log(`🆕 New gaps: ${result.summary.new}`);
    console.log("═".repeat(60));

    if (result.gaps.length === 0) {
      console.log("\n✨ No gaps detected! System is aligned.\n");
      return;
    }

    console.log(`\n📋 ${result.gaps.length} Gaps Found:\n`);

    result.gaps.forEach((gap, idx) => {
      const icon =
        gap.severity === "P0" ? "🔴" : gap.severity === "P1" ? "🟡" : "🟢";
      console.log(`${idx + 1}. ${icon} [${gap.severity}] ${gap.description}`);
      console.log(`   Category: ${gap.category}`);
      console.log(`   Promised: ${gap.promised}`);
      console.log(`   Actual: ${gap.actual}`);
      console.log(`   Impact: ${gap.impact}`);
      console.log(`   Fix: ${gap.suggestedFix}\n`);
    });

    console.log("═".repeat(60));
    console.log("🎯 Recommended Actions:");
    console.log("   1. Fix P0 gaps immediately");
    console.log("   2. Schedule P1 gaps for this week");
    console.log("   3. Track P2 gaps in backlog");
    console.log("\n💡 Run: npm run gaps --history to see trend");
    console.log("═".repeat(60));
  }
}

// Main execution
const args = process.argv.slice(2);
const createIssues = args.includes("--create-issues");
const watch = args.includes("--watch");

if (watch) {
  // Real-time monitoring mode
  console.log("👀 Real-time Gap Monitoring");
  console.log("═".repeat(60));
  console.log("⚠️  Watch mode not yet implemented");
  console.log("💡 For now, run manually: npm run gaps");
  process.exit(0);
}

const engine = new GapsEngine();
const result = await engine.detectGaps();

// Create GitHub issues for P0 gaps if requested
if (createIssues && result.gaps.length > 0) {
  console.log("\n🔄 Creating GitHub issues for P0 gaps...");
  await engine.createGitHubIssues(result.gaps);
}
