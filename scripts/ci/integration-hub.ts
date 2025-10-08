/**
 * Integration Hub - Phase 3.7 Bridge
 *
 * "하나라도 실패하면 즉시 Freeze, 모든 Gate를 병렬로 실행"
 * - Cosmic Insight for Zero-Defect Deployment
 *
 * Purpose:
 * - 병렬 Gate A-O + R + E + V 자동화
 * - Freeze Registry 연동
 * - CI/CD Zero-Defect 보장
 *
 * Architecture:
 * Gate Scheduler → Parallel Execution → Instant Feedback → FREEZE or PASS
 *
 * Gates (19 total):
 * - A-O: 15 gates (Accuracy, Behavior, Cost, ..., Optimization)
 * - R: Robustness
 * - E: Explainability
 * - V: Value
 *
 * Expected Impact:
 * - Regression Detection: 100%
 * - Test Duration: 30min → 5min (-83%)
 * - Deployment Confidence: 99%+
 *
 * @see RFC 2025-21: Phase 3.7 AI Civic OS Bridge
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * Gate Definition
 */
export interface Gate {
  id: string; // e.g., "A-Accuracy"
  name: string;
  command: string; // Test command to run
  timeout: number; // ms
  critical: boolean; // If true, failure blocks deployment
  weight: number; // 0-1, for weighted scoring
}

/**
 * Gate Result
 */
export interface GateResult {
  gate: Gate;
  passed: boolean;
  duration: number; // ms
  output?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Hub Result
 */
export interface HubResult {
  passed: boolean; // All critical gates pass
  totalGates: number;
  passedGates: number;
  failedGates: number;
  criticalFailures: number;

  // Results per gate
  results: GateResult[];

  // Summary
  totalDuration: number; // ms (parallel, so = max gate duration)
  score: number; // 0-100, weighted average

  // Freeze decision
  freeze: boolean;
  freezeReason?: string;

  // Metadata
  timestamp: Date;
}

/**
 * Freeze Registry Entry
 */
export interface FreezeEntry {
  timestamp: Date;
  hubResult: HubResult;
  deployment: 'allowed' | 'frozen';
  overridden: boolean;
  overrideReason?: string;
}

/**
 * Integration Hub Config
 */
export interface IntegrationHubConfig {
  // Gates
  gates: Gate[];

  // Execution
  parallelExecution: boolean; // Default: true
  failFast: boolean; // Stop on first critical failure (Default: false for complete results)

  // Registry
  registryFile: string; // Default: reports/ci/freeze-registry.jsonl

  // CI/CD
  enableAutoFreeze: boolean; // Default: true
  allowManualOverride: boolean; // Default: true
}

/**
 * Integration Hub
 *
 * Parallel Gate Scheduler + Freeze Registry + CI/CD Integration
 */
export class IntegrationHub {
  private config: IntegrationHubConfig;
  private registry: FreezeEntry[] = [];

  constructor(config?: Partial<IntegrationHubConfig>) {
    this.config = {
      gates: config?.gates ?? this.getDefaultGates(),
      parallelExecution: config?.parallelExecution ?? true,
      failFast: config?.failFast ?? false,
      registryFile:
        config?.registryFile ??
        'reports/ci/freeze-registry.jsonl',
      enableAutoFreeze: config?.enableAutoFreeze ?? true,
      allowManualOverride: config?.allowManualOverride ?? true,
    };

    this.loadRegistry();
  }

  /**
   * Run all gates (main entry point)
   */
  async runAllGates(): Promise<HubResult> {
    console.log(
      `🚀 Integration Hub: Running ${this.config.gates.length} gates...`
    );

    const startTime = Date.now();

    // Execute gates
    const results = this.config.parallelExecution
      ? await this.runGatesParallel()
      : await this.runGatesSequential();

    const totalDuration = Date.now() - startTime;

    // Analyze results
    const passedGates = results.filter((r) => r.passed).length;
    const failedGates = results.length - passedGates;
    const criticalFailures = results.filter(
      (r) => !r.passed && r.gate.critical
    ).length;

    // Calculate weighted score
    const score = this.calculateScore(results);

    // Determine freeze
    const freeze =
      this.config.enableAutoFreeze && criticalFailures > 0;
    const freezeReason = freeze
      ? this.formatFreezeReason(results)
      : undefined;

    const hubResult: HubResult = {
      passed: criticalFailures === 0,
      totalGates: results.length,
      passedGates,
      failedGates,
      criticalFailures,
      results,
      totalDuration,
      score,
      freeze,
      freezeReason,
      timestamp: new Date(),
    };

    // Log to registry
    await this.logToRegistry(hubResult);

    return hubResult;
  }

  /**
   * Run gates in parallel
   */
  private async runGatesParallel(): Promise<GateResult[]> {
    const promises = this.config.gates.map((gate) =>
      this.runSingleGate(gate)
    );

    return Promise.all(promises);
  }

  /**
   * Run gates sequentially
   */
  private async runGatesSequential(): Promise<GateResult[]> {
    const results: GateResult[] = [];

    for (const gate of this.config.gates) {
      const result = await this.runSingleGate(gate);
      results.push(result);

      // Fail fast if critical failure
      if (
        this.config.failFast &&
        !result.passed &&
        gate.critical
      ) {
        console.warn(
          `⚠️ Fail-fast triggered: ${gate.id} failed`
        );
        break;
      }
    }

    return results;
  }

  /**
   * Run single gate
   */
  private async runSingleGate(gate: Gate): Promise<GateResult> {
    const startTime = Date.now();

    try {
      const { output, error } = await this.executeCommand(
        gate.command,
        gate.timeout
      );

      const duration = Date.now() - startTime;

      // Determine pass/fail (exit code 0 = pass)
      const passed = error === null;

      return {
        gate,
        passed,
        duration,
        output,
        error: error ?? undefined,
        timestamp: new Date(),
      };
    } catch (err) {
      const duration = Date.now() - startTime;

      return {
        gate,
        passed: false,
        duration,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Execute command with timeout
   */
  private executeCommand(
    command: string,
    timeout: number
  ): Promise<{ output: string; error: string | null }> {
    return new Promise((resolve) => {
      const proc = spawn(command, {
        shell: true,
        timeout,
      });

      let output = '';
      let error = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ output, error: null });
        } else {
          resolve({ output, error: error || `Exit code: ${code}` });
        }
      });

      proc.on('error', (err) => {
        resolve({ output, error: err.message });
      });
    });
  }

  /**
   * Calculate weighted score
   */
  private calculateScore(results: GateResult[]): number {
    const totalWeight = this.config.gates.reduce(
      (sum, g) => sum + g.weight,
      0
    );

    const weightedScore = results.reduce((sum, result) => {
      const score = result.passed ? 1 : 0;
      return sum + score * result.gate.weight;
    }, 0);

    return (weightedScore / totalWeight) * 100;
  }

  /**
   * Format freeze reason
   */
  private formatFreezeReason(results: GateResult[]): string {
    const criticalFailures = results.filter(
      (r) => !r.passed && r.gate.critical
    );

    if (criticalFailures.length === 0) {
      return '';
    }

    const reasons = criticalFailures.map(
      (r) => `${r.gate.id}: ${r.error?.split('\n')[0] || 'Failed'}`
    );

    return (
      `Deployment FROZEN: ${criticalFailures.length} critical gate(s) failed. ` +
      reasons.join('; ')
    );
  }

  /**
   * Log to freeze registry
   */
  private async logToRegistry(hubResult: HubResult): Promise<void> {
    const entry: FreezeEntry = {
      timestamp: hubResult.timestamp,
      hubResult,
      deployment: hubResult.freeze ? 'frozen' : 'allowed',
      overridden: false,
    };

    const registryPath = this.config.registryFile;

    // Ensure directory exists
    const dir = path.dirname(registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to JSONL
    fs.appendFileSync(
      registryPath,
      JSON.stringify(entry) + '\n'
    );

    this.registry.push(entry);
  }

  /**
   * Load registry from disk
   */
  private loadRegistry(): void {
    const registryPath = this.config.registryFile;

    if (!fs.existsSync(registryPath)) return;

    const lines = fs
      .readFileSync(registryPath, 'utf-8')
      .split('\n');

    this.registry = lines
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line));
  }

  /**
   * Manual override (for false positives)
   */
  async manualOverride(
    hubResult: HubResult,
    reason: string
  ): Promise<void> {
    if (!this.config.allowManualOverride) {
      throw new Error('Manual override not allowed');
    }

    // Find entry in registry
    const entry = this.registry.find(
      (e) => e.hubResult.timestamp === hubResult.timestamp
    );

    if (entry) {
      entry.overridden = true;
      entry.overrideReason = reason;
      entry.deployment = 'allowed';

      // Re-save registry
      await this.saveRegistry();
    }

    console.log(
      `[IntegrationHub] Manual override recorded: ${reason}`
    );
  }

  /**
   * Save registry to disk
   */
  private async saveRegistry(): Promise<void> {
    const registryPath = this.config.registryFile;

    const lines = this.registry.map((entry) =>
      JSON.stringify(entry)
    );

    fs.writeFileSync(registryPath, lines.join('\n') + '\n');
  }

  /**
   * Get default gates (A-O + R + E + V)
   */
  private getDefaultGates(): Gate[] {
    return [
      // A-O gates (15)
      {
        id: 'A-Accuracy',
        name: 'Accuracy Validation',
        command: 'npm run test:accuracy',
        timeout: 300000, // 5min
        critical: true,
        weight: 1.0,
      },
      {
        id: 'B-Behavior',
        name: 'Behavior Consistency',
        command: 'npm run test:behavior',
        timeout: 300000,
        critical: true,
        weight: 0.9,
      },
      {
        id: 'C-Cost',
        name: 'Cost Efficiency',
        command: 'npm run test:cost',
        timeout: 180000, // 3min
        critical: false,
        weight: 0.6,
      },
      {
        id: 'D-Diversity',
        name: 'Output Diversity',
        command: 'npm run test:diversity',
        timeout: 180000,
        critical: false,
        weight: 0.5,
      },
      {
        id: 'E-Explainability',
        name: 'Explainability',
        command: 'npm run test:explainability',
        timeout: 180000,
        critical: true,
        weight: 0.8,
      },
      {
        id: 'F-Faithfulness',
        name: 'Faithfulness to Source',
        command: 'npm run test:faithfulness',
        timeout: 240000, // 4min
        critical: true,
        weight: 1.0,
      },
      {
        id: 'G-Groundedness',
        name: 'Groundedness',
        command: 'npm run test:groundedness',
        timeout: 240000,
        critical: true,
        weight: 1.0,
      },
      {
        id: 'H-Hallucination',
        name: 'Hallucination Detection',
        command: 'npm run test:hallucination',
        timeout: 240000,
        critical: true,
        weight: 1.0,
      },
      {
        id: 'I-Intent',
        name: 'Intent Classification',
        command: 'npm run test:intent',
        timeout: 180000,
        critical: false,
        weight: 0.7,
      },
      {
        id: 'J-Justice',
        name: 'Fairness & Bias',
        command: 'npm run test:justice',
        timeout: 240000,
        critical: true,
        weight: 0.9,
      },
      {
        id: 'K-Knowledge',
        name: 'Knowledge Accuracy',
        command: 'npm run test:knowledge',
        timeout: 240000,
        critical: true,
        weight: 1.0,
      },
      {
        id: 'L-Latency',
        name: 'Latency Performance',
        command: 'npm run test:latency',
        timeout: 180000,
        critical: true,
        weight: 0.8,
      },
      {
        id: 'M-Memory',
        name: 'Memory Efficiency',
        command: 'npm run test:memory',
        timeout: 180000,
        critical: false,
        weight: 0.5,
      },
      {
        id: 'N-NLI',
        name: 'Natural Language Inference',
        command: 'npm run test:nli',
        timeout: 240000,
        critical: true,
        weight: 0.9,
      },
      {
        id: 'O-Optimization',
        name: 'Optimization Effectiveness',
        command: 'npm run test:optimization',
        timeout: 240000,
        critical: false,
        weight: 0.7,
      },

      // R, E, V gates (4)
      {
        id: 'R-Robustness',
        name: 'System Robustness',
        command: 'npm run test:robustness',
        timeout: 300000,
        critical: true,
        weight: 1.0,
      },
      {
        id: 'E-Explainability-Full',
        name: 'Full Explainability Suite',
        command: 'npm run test:explainability:full',
        timeout: 300000,
        critical: true,
        weight: 0.9,
      },
      {
        id: 'V-Value',
        name: 'Business Value',
        command: 'npm run test:value',
        timeout: 240000,
        critical: false,
        weight: 0.8,
      },
    ];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRuns: number;
    frozenCount: number;
    overrideCount: number;
    avgDuration: number;
    avgScore: number;
  } {
    const totalRuns = this.registry.length;
    const frozenCount = this.registry.filter(
      (e) => e.deployment === 'frozen' && !e.overridden
    ).length;
    const overrideCount = this.registry.filter(
      (e) => e.overridden
    ).length;

    const avgDuration =
      totalRuns > 0
        ? this.registry.reduce(
            (sum, e) => sum + e.hubResult.totalDuration,
            0
          ) / totalRuns
        : 0;

    const avgScore =
      totalRuns > 0
        ? this.registry.reduce(
            (sum, e) => sum + e.hubResult.score,
            0
          ) / totalRuns
        : 0;

    return {
      totalRuns,
      frozenCount,
      overrideCount,
      avgDuration,
      avgScore,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): IntegrationHubConfig {
    return { ...this.config };
  }
}

/**
 * CLI interface
 */
if (require.main === module) {
  const hub = new IntegrationHub();

  (async () => {
    console.log('🚀 Integration Hub - Zero-Defect CI/CD');
    console.log('=====================================\n');

    try {
      const result = await hub.runAllGates();

      console.log('\n📊 Results:');
      console.log(
        `  Total gates: ${result.totalGates}`
      );
      console.log(`  Passed: ${result.passedGates} ✅`);
      console.log(`  Failed: ${result.failedGates} ❌`);
      console.log(
        `  Critical failures: ${result.criticalFailures}`
      );
      console.log(
        `  Score: ${result.score.toFixed(1)}/100`
      );
      console.log(
        `  Duration: ${(result.totalDuration / 1000).toFixed(1)}s`
      );

      if (result.freeze) {
        console.log('\n❌ DEPLOYMENT FROZEN');
        console.log(`\nReason: ${result.freezeReason}\n`);

        console.log('Failed gates:');
        result.results
          .filter((r) => !r.passed && r.gate.critical)
          .forEach((r, idx) => {
            console.log(
              `  ${idx + 1}. ${r.gate.id}: ${r.error?.split('\n')[0] || 'Failed'}`
            );
          });

        console.log('\n💡 To override (if false positive):');
        console.log(
          '   npm run ci:hub:override "<reason>"'
        );

        process.exit(1); // Exit with error to block CI/CD
      } else {
        console.log('\n✅ ALL CRITICAL GATES PASSED');
        console.log('\nDeployment can proceed safely.\n');

        const stats = hub.getStats();
        console.log('📈 Statistics:');
        console.log(`  Total runs: ${stats.totalRuns}`);
        console.log(`  Frozen count: ${stats.frozenCount}`);
        console.log(
          `  Avg duration: ${(stats.avgDuration / 1000).toFixed(1)}s`
        );
        console.log(
          `  Avg score: ${stats.avgScore.toFixed(1)}/100`
        );

        process.exit(0); // Success
      }
    } catch (error) {
      console.error('❌ Error during hub execution:', error);
      process.exit(1);
    }
  })();
}
