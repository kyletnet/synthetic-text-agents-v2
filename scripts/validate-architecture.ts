#!/usr/bin/env tsx

/**
 * Architecture Validator - Command Line Interface
 *
 * Usage:
 *   npm run arch:validate              # Full validation
 *   npm run arch:validate --quick      # Skip slow checks
 *   npm run arch:validate --fix        # Auto-fix violations
 */

import {
  createCodebaseSnapshot,
  validateInvariants,
  ALL_INVARIANTS,
  type InvariantViolation,
} from "./lib/patterns/architecture-invariants.js";
import { AutoFixEngine } from "./lib/patterns/auto-fix-engine.js";

class ArchitectureValidator {
  private rootDir: string;
  private quick: boolean;
  private autoFix: boolean;

  constructor() {
    this.rootDir = process.cwd();
    this.quick = process.argv.includes("--quick");
    this.autoFix = process.argv.includes("--fix");
  }

  async run(): Promise<void> {
    console.log("🏛️  Architecture Invariants Validator");
    console.log("═".repeat(60));

    if (this.quick) {
      console.log("⚡ Quick mode - skipping slow checks");
    }

    console.log("\n📸 Creating codebase snapshot...");
    const snapshot = createCodebaseSnapshot(this.rootDir);
    console.log(`   ✓ Scanned ${snapshot.files.length} files`);

    console.log("\n🔍 Validating architecture invariants...");
    const violations = validateInvariants(snapshot, ALL_INVARIANTS);

    // Group by severity
    const p0 = violations.filter((v) => v.severity === "P0");
    const p1 = violations.filter((v) => v.severity === "P1");
    const p2 = violations.filter((v) => v.severity === "P2");

    console.log(`\n📊 Validation Results:`);
    console.log(`   🔴 P0 Critical: ${p0.length}`);
    console.log(`   🟡 P1 High: ${p1.length}`);
    console.log(`   🟢 P2 Medium: ${p2.length}`);

    if (violations.length === 0) {
      console.log("\n✅ All architecture invariants satisfied!");
      console.log("🎉 System architecture is consistent and healthy");
      process.exit(0);
    }

    // Print violations
    this.printViolations(violations);

    // Auto-fix if requested
    if (this.autoFix) {
      const fixable = violations.filter((v) => v.autoFixable);

      if (fixable.length === 0) {
        console.log("\n⚠️  No auto-fixable violations found");
      } else {
        const engine = new AutoFixEngine(this.rootDir);
        const result = await engine.fix(fixable);

        // Update violations list after fixes
        if (result.fixedViolations > 0) {
          console.log("\n🔄 Re-validating after fixes...");
          const newSnapshot = createCodebaseSnapshot(this.rootDir);
          const newViolations = validateInvariants(newSnapshot, ALL_INVARIANTS);

          console.log(
            `\n📊 Remaining violations: ${newViolations.length} (was ${violations.length})`,
          );

          // Update local violations for exit code
          violations.length = 0;
          violations.push(...newViolations);

          // Re-group by severity
          const newP0 = violations.filter((v) => v.severity === "P0");
          const newP1 = violations.filter((v) => v.severity === "P1");
          const newP2 = violations.filter((v) => v.severity === "P2");

          console.log(`   🔴 P0: ${newP0.length}`);
          console.log(`   🟡 P1: ${newP1.length}`);
          console.log(`   🟢 P2: ${newP2.length}`);
        }
      }
    }

    // Decide whether to block (re-group after potential auto-fix)
    const finalP0 = violations.filter((v) => v.severity === "P0");
    const finalP1 = violations.filter((v) => v.severity === "P1");

    if (finalP0.length > 0) {
      console.log("\n🔒 BLOCKING: P0 violations detected");
      console.log("💡 Fix violations above before proceeding");
      process.exit(1);
    }

    if (finalP1.length > 0) {
      console.log("\n⚠️  WARNING: P1 violations detected");
      console.log("💡 These should be addressed soon");
      process.exit(0); // Don't block on P1
    }

    if (violations.length === 0) {
      console.log("\n✅ All violations resolved!");
    }

    process.exit(0);
  }

  private printViolations(violations: InvariantViolation[]): void {
    console.log("\n📋 Violations:");
    console.log("─".repeat(60));

    const grouped = this.groupByInvariant(violations);

    for (const [invariantId, viols] of grouped.entries()) {
      console.log(`\n🔴 ${invariantId} (${viols.length} violations):`);

      for (const v of viols.slice(0, 5)) {
        // Show max 5 per invariant
        console.log(`   📁 ${v.file}`);
        if (v.line) console.log(`      Line ${v.line}`);
        console.log(`      ❌ ${v.message}`);
        console.log(`      💡 ${v.suggestion}`);
        if (v.autoFixable) {
          console.log(`      🔧 Auto-fixable`);
        }
      }

      if (viols.length > 5) {
        console.log(`   ... and ${viols.length - 5} more`);
      }
    }
  }

  private groupByInvariant(
    violations: InvariantViolation[],
  ): Map<string, InvariantViolation[]> {
    const map = new Map<string, InvariantViolation[]>();

    for (const v of violations) {
      const existing = map.get(v.invariantId) || [];
      existing.push(v);
      map.set(v.invariantId, existing);
    }

    return map;
  }
}

// Run
const validator = new ArchitectureValidator();
await validator.run();
