#!/usr/bin/env tsx

/**
 * Governance Policy Explainer
 *
 * Purpose:
 * - Explain why tools were blocked/allowed
 * - Provide actionable fix instructions
 * - Show policy context and rationale
 *
 * Usage:
 *   npm run explain:governance
 *   npm run explain:governance -- --blocked-only
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface LogEntry {
  timestamp: string;
  tool: string;
  mode: "analyze" | "transform" | "unknown";
  result: "allowed" | "blocked" | "error";
  reason: string;
  violations?: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
  policy?: string;
}

class GovernanceExplainer {
  private projectRoot: string;
  private logPath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.logPath = join(
      this.projectRoot,
      "reports",
      "governance",
      "enforcement-log.jsonl",
    );
  }

  async explain(blockedOnly: boolean = false): Promise<void> {
    console.log("🔍 Governance Policy Explainer");
    console.log("═".repeat(60));

    if (!existsSync(this.logPath)) {
      console.log("\n❌ No enforcement log found");
      console.log("   Run: npm run validate");
      return;
    }

    const entries = this.loadLog();

    if (blockedOnly) {
      this.explainBlocked(entries);
    } else {
      this.explainAll(entries);
    }
  }

  private loadLog(): LogEntry[] {
    const content = readFileSync(this.logPath, "utf8");
    return content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as LogEntry);
  }

  private explainAll(entries: LogEntry[]): void {
    const blocked = entries.filter((e) => e.result === "blocked");
    const allowed = entries.filter((e) => e.result === "allowed");
    const errors = entries.filter((e) => e.result === "error");

    console.log(`\n📊 Summary (${entries.length} total checks):`);
    console.log(`   ✅ Allowed: ${allowed.length}`);
    console.log(`   ❌ Blocked: ${blocked.length}`);
    console.log(`   ⚠️  Errors: ${errors.length}`);

    // Group allowed by mode
    const analyzeAllowed = allowed.filter((e) => e.mode === "analyze");
    const transformAllowed = allowed.filter((e) => e.mode === "transform");

    console.log(`\n✅ Allowed Tools:`);
    console.log(`   Analyze mode (auto-exempt): ${analyzeAllowed.length}`);
    console.log(`   Transform mode (compliant): ${transformAllowed.length}`);

    if (blocked.length > 0) {
      console.log(`\n❌ Blocked Tools (${blocked.length}):`);
      this.explainBlockedDetails(blocked);
    }

    if (errors.length > 0) {
      console.log(`\n⚠️  Errors (${errors.length}):`);
      errors.forEach((e) => {
        console.log(`   - ${e.tool}: ${e.reason}`);
      });
    }

    this.provideSummaryGuidance(blocked);
  }

  private explainBlocked(entries: LogEntry[]): void {
    const blocked = entries.filter((e) => e.result === "blocked");

    if (blocked.length === 0) {
      console.log("\n✅ No blocked tools - all engines are compliant!");
      return;
    }

    console.log(`\n❌ Blocked Tools (${blocked.length}):`);
    this.explainBlockedDetails(blocked);
    this.provideSummaryGuidance(blocked);
  }

  private explainBlockedDetails(blocked: LogEntry[]): void {
    blocked.forEach((entry, i) => {
      console.log(`\n${i + 1}. ${entry.tool}`);
      console.log(`   Mode: ${entry.mode}`);
      console.log(`   Reason: ${entry.reason}`);

      if (entry.violations && entry.violations.length > 0) {
        console.log(`   Violations:`);
        entry.violations.forEach((v) => {
          const icon = v.severity === "critical" ? "🔴" : "🟡";
          console.log(`      ${icon} [${v.severity.toUpperCase()}] ${v.message}`);
        });
      }

      console.log(`\n   📖 How to fix:`);
      this.provideFixInstructions(entry);
    });
  }

  private provideFixInstructions(entry: LogEntry): void {
    if (!entry.violations || entry.violations.length === 0) {
      console.log(`      No specific instructions available`);
      return;
    }

    const hasModeDeclMissing = entry.violations.some((v) =>
      v.message.includes("@tool-mode"),
    );
    const hasMissingImport = entry.violations.some((v) =>
      v.message.includes("missing import"),
    );
    const hasMissingCall = entry.violations.some((v) =>
      v.message.includes("missing call"),
    );
    const hasMissingProperty = entry.violations.some((v) =>
      v.message.includes("missing property"),
    );

    if (hasModeDeclMissing) {
      console.log(`      1. Add @tool-mode declaration at the top:`);
      console.log(`         // @tool-mode: analyze (or transform)`);
      console.log(`         // @tool-description: Brief description`);
    }

    if (hasMissingImport) {
      console.log(`      2. Import governance wrapper:`);
      console.log(`         import { wrapWithGovernance } from './lib/governance/engine-governance-template.js';`);
    }

    if (hasMissingCall) {
      console.log(`      3. Wrap main execution:`);
      console.log(`         wrapWithGovernance({ name: "tool-name", type: "..." }, async () => {`);
      console.log(`           // your logic here`);
      console.log(`         });`);
    }

    if (hasMissingProperty) {
      console.log(`      4. Add governance property (if using GovernanceRunner directly):`);
      console.log(`         private governance: GovernanceRunner;`);
    }

    console.log(`\n   📚 Documentation:`);
    console.log(`      - docs/GOVERNANCE_PHILOSOPHY.md`);
    console.log(`      - scripts/lib/governance/tool-mode.ts`);
  }

  private provideSummaryGuidance(blocked: LogEntry[]): void {
    if (blocked.length === 0) return;

    console.log(`\n💡 Quick Fix Guide:`);
    console.log(`\n   For ANALYZE tools (read-only):`);
    console.log(`      // @tool-mode: analyze`);
    console.log(`      // @tool-description: Your description`);
    console.log(`      (No governance wrapper needed)`);

    console.log(`\n   For TRANSFORM tools (write operations):`);
    console.log(`      // @tool-mode: transform`);
    console.log(`      // @tool-description: Your description`);
    console.log(`      import { wrapWithGovernance } from '...';`);
    console.log(`      wrapWithGovernance({ ... }, async () => { ... });`);

    console.log(`\n   Policy Rationale:`);
    console.log(`      - Analyze tools: Auto-exempt (read-only, no risk)`);
    console.log(`      - Transform tools: Require governance (write operations, need control)`);
    console.log(`      - Type-based enforcement: No hardcoded exceptions`);

    console.log(`\n═`.repeat(60));
  }
}

// Main
const blockedOnly = process.argv.includes("--blocked-only");
const explainer = new GovernanceExplainer();
await explainer.explain(blockedOnly);
