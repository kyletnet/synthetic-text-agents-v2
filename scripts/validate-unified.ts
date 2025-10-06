#!/usr/bin/env tsx

/**
 * Unified Validation Engine
 *
 * Runs all system validations in order:
 * 1. Architecture Invariants
 * 2. Design Principles
 * 3. LLM I/O Contracts
 * 4. Integration Quality
 *
 * Used by /ship workflow for pre-deployment checks.
 * All validations are real - no shortcuts or skips.
 */

import { execSync } from "child_process";
import { InspectionCache } from "./lib/inspection-cache.js";

interface ValidationResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class UnifiedValidator {
  private cache: InspectionCache;
  private projectRoot: string;
  private results: ValidationResult[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.cache = new InspectionCache(this.projectRoot);
  }

  async run(subcommand?: string): Promise<void> {
    console.log("🔍 Unified System Validation");
    console.log("═".repeat(60));

    // Check cache freshness
    const validation = this.cache.validateCache();
    if (!validation.valid) {
      console.log(`❌ Inspection cache is ${validation.reason}`);
      console.log("   Run /inspect first to generate fresh cache\n");
      process.exit(1);
    }

    const ageMinutes = Math.floor((validation.ageSeconds || 0) / 60);
    console.log(
      `✅ Using inspection results from ${ageMinutes} minute(s) ago\n`,
    );

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
    console.log("📋 Running all validations...\n");

    await this.validateArchitecture();
    await this.validateDesign();
    await this.validateLLMIO();
    await this.validateIntegration();
  }

  private async runSubcommand(cmd: string): Promise<void> {
    console.log(`📋 Running ${cmd} validation...\n`);

    switch (cmd) {
      case "arch":
      case "architecture":
        await this.validateArchitecture();
        break;
      case "design":
        await this.validateDesign();
        break;
      case "llm-io":
        await this.validateLLMIO();
        break;
      case "integration":
        await this.validateIntegration();
        break;
      default:
        console.error(`❌ Unknown subcommand: ${cmd}`);
        console.error("   Valid: arch, design, llm-io, integration");
        process.exit(1);
    }
  }

  private async validateArchitecture(): Promise<void> {
    await this.execute(
      "Architecture Invariants",
      "npm run _arch:validate --silent",
    );
  }

  private async validateDesign(): Promise<void> {
    await this.execute("Design Principles", "npm run design:validate --silent");
  }

  private async validateLLMIO(): Promise<void> {
    await this.execute("LLM I/O Contracts", "npm run validate:llm-io --silent");
  }

  private async validateIntegration(): Promise<void> {
    await this.execute(
      "Integration Quality",
      "npm run integration:audit --silent",
    );
  }

  private async execute(name: string, command: string): Promise<void> {
    const startTime = Date.now();

    try {
      execSync(command, {
        cwd: this.projectRoot,
        stdio: "inherit",
        timeout: 60000, // 1 minute timeout
      });

      const duration = Date.now() - startTime;
      this.results.push({ name, passed: true, duration });
      console.log(`✅ ${name} passed (${(duration / 1000).toFixed(1)}s)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({
        name,
        passed: false,
        duration,
        error: (error as Error).message,
      });
      console.log(`❌ ${name} failed (${(duration / 1000).toFixed(1)}s)\n`);
    }
  }

  private displayResults(totalTime: string): void {
    console.log("═".repeat(60));
    console.log("📊 Validation Summary");
    console.log("═".repeat(60));

    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    console.log(`✅ Passed: ${passed}/${this.results.length}`);
    console.log(`❌ Failed: ${failed}/${this.results.length}`);
    console.log(`⏱️  Total time: ${totalTime}s`);

    if (failed > 0) {
      console.log("\n❌ Failed Validations:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`   - ${r.name}`);
        });
    }

    console.log("═".repeat(60));
  }

  private exit(): void {
    const allPassed = this.results.every((r) => r.passed);
    process.exit(allPassed ? 0 : 1);
  }
}

// CLI
const validator = new UnifiedValidator();
const subcommand = process.argv[2];
await validator.run(subcommand);
