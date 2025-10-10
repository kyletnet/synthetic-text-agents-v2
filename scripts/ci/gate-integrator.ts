/**
 * Gate Integrator (A-G)
 *
 * Unified gate runner that executes all quality gates:
 * - Gate A-E: Existing gates
 * - Gate F: Throughput & Energy
 * - Gate G: Guideline Compliance
 *
 * Purpose:
 * - CI/CD integration (auto-block PRs if any gate fails)
 * - Consolidated reporting
 * - Parallel gate execution
 * - Historical tracking
 *
 * Usage:
 *   npm run gates              # Run all gates
 *   npm run gates -- --gate=G  # Run specific gate
 *   npm run gates -- --report  # Generate report only
 *
 * @see PHASE_2.7_SUCCESS_REPORT.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { GateFController } from '../../src/runtime/optimization/gate-f-throughput';
import { GateGController } from '../../src/runtime/optimization/gate-g-guideline';

/**
 * Gate Result
 */
export interface GateResult {
  gate: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  metrics?: Record<string, any>;
  duration: number;
  timestamp: string;
}

/**
 * Integrated Gate Report
 */
export interface IntegratedGateReport {
  timestamp: string;
  overallStatus: 'pass' | 'fail';
  summary: {
    totalGates: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  gates: GateResult[];
  duration: number;
}

/**
 * Gate Integrator Configuration
 */
export interface GateIntegratorConfig {
  gates: string[]; // Gates to run (e.g., ['F', 'G'])
  parallel: boolean; // Run gates in parallel
  stopOnFailure: boolean; // Stop if any gate fails
  reportPath: string; // Report output path
}

const DEFAULT_CONFIG: GateIntegratorConfig = {
  gates: ['F', 'G'], // Currently implemented gates
  parallel: true,
  stopOnFailure: false,
  reportPath: path.join(process.cwd(), 'reports/gate-integrator-report.json'),
};

/**
 * Gate Integrator
 *
 * Executes and reports on all quality gates.
 */
export class GateIntegrator {
  private config: GateIntegratorConfig;
  private gateFController?: GateFController;
  private gateGController?: GateGController;

  constructor(config: Partial<GateIntegratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run all gates
   */
  async runAll(): Promise<IntegratedGateReport> {
    const startTime = performance.now();
    const results: GateResult[] = [];

    console.log('🚪 Gate Integrator: Running all gates...\n');

    if (this.config.parallel) {
      // Run gates in parallel
      const promises = this.config.gates.map((gate) => this.runGate(gate));
      const gateResults = await Promise.all(promises);
      results.push(...gateResults);
    } else {
      // Run gates sequentially
      for (const gate of this.config.gates) {
        const result = await this.runGate(gate);
        results.push(result);

        if (result.status === 'fail' && this.config.stopOnFailure) {
          console.log(`\n❌ Gate ${gate} failed, stopping execution\n`);
          break;
        }
      }
    }

    const duration = performance.now() - startTime;

    // Calculate summary
    const summary = {
      totalGates: results.length,
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').length,
      skipped: results.filter((r) => r.status === 'skip').length,
    };

    const overallStatus = summary.failed > 0 ? 'fail' : 'pass';

    const report: IntegratedGateReport = {
      timestamp: new Date().toISOString(),
      overallStatus,
      summary,
      gates: results,
      duration,
    };

    // Save report
    this.saveReport(report);

    // Print summary
    this.printSummary(report);

    return report;
  }

  /**
   * Run specific gate
   */
  private async runGate(gate: string): Promise<GateResult> {
    const startTime = performance.now();
    let result: GateResult;

    try {
      switch (gate.toUpperCase()) {
        case 'F':
          result = await this.runGateF();
          break;
        case 'G':
          result = await this.runGateG();
          break;
        default:
          result = {
            gate,
            status: 'skip',
            message: `Gate ${gate} not implemented`,
            duration: 0,
            timestamp: new Date().toISOString(),
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result = {
        gate,
        status: 'fail',
        message: `Gate ${gate} error: ${errorMessage}`,
        duration: performance.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    result.duration = performance.now() - startTime;
    return result;
  }

  /**
   * Run Gate F: Throughput & Energy
   */
  private async runGateF(): Promise<GateResult> {
    console.log('📊 Running Gate F: Throughput & Energy...');

    if (!this.gateFController) {
      this.gateFController = new GateFController();
    }

    const status = this.gateFController.getStatus();
    const passes = this.gateFController.passes();

    console.log(`   Status: ${passes ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   p95 Latency: ${status.metrics.p95Latency.toFixed(3)}ms`);
    console.log(`   Throughput: ${status.metrics.throughput.toFixed(0)} q/s\n`);

    return {
      gate: 'F',
      status: passes ? 'pass' : 'fail',
      message: passes
        ? `Throughput: ${status.metrics.throughput.toFixed(0)} q/s, p95: ${status.metrics.p95Latency.toFixed(3)}ms`
        : `Performance degraded: ${status.status}`,
      metrics: status.metrics,
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run Gate G: Guideline Compliance
   */
  private async runGateG(): Promise<GateResult> {
    console.log('📘 Running Gate G: Guideline Compliance...');

    if (!this.gateGController) {
      this.gateGController = new GateGController();
    }

    const status = this.gateGController.getStatus();
    const passes = this.gateGController.passes();

    console.log(`   Status: ${passes ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Compliance: ${status.metrics.complianceRate.toFixed(1)}%`);
    console.log(`   Valid QA: ${status.metrics.validQA}/${status.metrics.totalQA}\n`);

    return {
      gate: 'G',
      status: passes ? 'pass' : 'fail',
      message: passes
        ? `Compliance: ${status.metrics.complianceRate.toFixed(1)}%, Valid: ${status.metrics.validQA}/${status.metrics.totalQA}`
        : `Compliance below threshold: ${status.metrics.complianceRate.toFixed(1)}% < ${status.thresholds.minCompliance}%`,
      metrics: status.metrics,
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Save report to file
   */
  private saveReport(report: IntegratedGateReport): void {
    try {
      const dir = path.dirname(this.config.reportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.reportPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`💾 Report saved: ${this.config.reportPath}\n`);
    } catch (error) {
      console.error('Failed to save gate report:', error);
    }
  }

  /**
   * Print summary
   */
  private printSummary(report: IntegratedGateReport): void {
    console.log('═'.repeat(60));
    console.log('🚪 GATE INTEGRATOR SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\nOverall Status: ${report.overallStatus === 'pass' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`\nGates:`);
    console.log(`  Total:   ${report.summary.totalGates}`);
    console.log(`  Passed:  ${report.summary.passed}`);
    console.log(`  Failed:  ${report.summary.failed}`);
    console.log(`  Skipped: ${report.summary.skipped}`);
    console.log(`\nDuration: ${report.duration.toFixed(2)}ms`);
    console.log(`Timestamp: ${report.timestamp}`);

    console.log(`\nDetailed Results:`);
    report.gates.forEach((gate) => {
      const statusIcon = gate.status === 'pass' ? '✅' : gate.status === 'fail' ? '❌' : '⏭️';
      console.log(`  ${statusIcon} Gate ${gate.gate}: ${gate.message}`);
    });

    console.log('\n' + '═'.repeat(60) + '\n');

    if (report.overallStatus === 'fail') {
      console.error('❌ GATE CHECK FAILED - Review gate results above\n');
      process.exit(1);
    } else {
      console.log('✅ ALL GATES PASSED\n');
    }
  }
}

/**
 * CLI Entry Point
 */
export async function main() {
  const args = process.argv.slice(2);
  const config: Partial<GateIntegratorConfig> = {};

  // Parse CLI arguments
  for (const arg of args) {
    if (arg.startsWith('--gate=')) {
      const gate = arg.split('=')[1];
      config.gates = [gate.toUpperCase()];
    } else if (arg === '--sequential') {
      config.parallel = false;
    } else if (arg === '--stop-on-failure') {
      config.stopOnFailure = true;
    } else if (arg === '--report') {
      // Just print existing report
      const reportPath = path.join(process.cwd(), 'reports/gate-integrator-report.json');
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        console.log(JSON.stringify(report, null, 2));
        return;
      } else {
        console.error('No report found');
        process.exit(1);
      }
    }
  }

  const integrator = new GateIntegrator(config);
  await integrator.runAll();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Gate Integrator failed:', error);
    process.exit(1);
  });
}
