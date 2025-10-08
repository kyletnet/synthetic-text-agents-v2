/**
 * Phase 3.6 KPI Tracker
 *
 * Comprehensive KPI tracking for Phase 3.6 Hardening
 *
 * Purpose:
 * - Track all Phase 3.6 metrics
 * - Generate dashboard data
 * - Monitor progress towards exit criteria
 *
 * @see RFC 2025-18: Phase 3.6 Hardening Strategy
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Phase 3.6 KPI
 */
export interface Phase36KPI {
  // Testing metrics
  testing: {
    totalTests: number;
    coverage: number; // %
    passRate: number; // %
    regressionGates: {
      total: number;
      passing: number;
    };
  };

  // Privacy metrics
  privacy: {
    kAnonymity: {
      k: number;
      violations: number;
      score: number; // 0-100
    };
    differentialPrivacy: {
      epsilon: number;
      budget: number;
      score: number; // 0-100
    };
    leakDetection: {
      leaks: number;
      severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
    };
  };

  // Optimizer metrics
  optimizer: {
    stability: number; // %
    rollbacks: number;
    successRate: number; // %
    avgCooldown: number; // hours
  };

  // Chaos metrics
  chaos: {
    scenarios: number;
    passed: number;
    resilience: number; // %
  };

  // Overall metrics
  overall: {
    resilience: number; // % (composite)
    readiness: number; // % (for Phase 4.0)
  };

  // Metadata
  timestamp: Date;
  phase: string;
}

/**
 * KPI Target
 */
export interface KPITarget {
  metric: string;
  current: number;
  target: number;
  unit: string;
  status: 'pass' | 'warn' | 'fail';
}

/**
 * KPI Dashboard Data
 */
export interface KPIDashboard {
  summary: {
    phase: string;
    overallHealth: number; // 0-100
    criticalIssues: number;
    warnings: number;
  };
  targets: KPITarget[];
  trends: {
    metric: string;
    history: Array<{ timestamp: Date; value: number }>;
  }[];
  recommendations: string[];
}

/**
 * Phase 3.6 KPI Tracker
 */
export class Phase36KPITracker {
  private kpiHistory: Phase36KPI[] = [];
  private readonly DATA_DIR = 'reports/kpi';

  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
    }

    // Load history
    this.loadHistory();
  }

  /**
   * Collect current KPI
   */
  async collect(): Promise<Phase36KPI> {
    const kpi: Phase36KPI = {
      testing: await this.collectTestingMetrics(),
      privacy: await this.collectPrivacyMetrics(),
      optimizer: await this.collectOptimizerMetrics(),
      chaos: await this.collectChaosMetrics(),
      overall: {
        resilience: 0,
        readiness: 0,
      },
      timestamp: new Date(),
      phase: '3.6',
    };

    // Calculate overall metrics
    kpi.overall.resilience = this.calculateResilience(kpi);
    kpi.overall.readiness = this.calculateReadiness(kpi);

    // Save to history
    this.kpiHistory.push(kpi);
    this.saveHistory();

    return kpi;
  }

  /**
   * Collect testing metrics
   */
  private async collectTestingMetrics(): Promise<Phase36KPI['testing']> {
    // In production: Run actual test suite
    // For now: Simulated based on current state

    return {
      totalTests: 71, // Current state
      coverage: 60, // Estimated
      passRate: 100, // Assuming all pass
      regressionGates: {
        total: 17, // A-O + R + E + V
        passing: 17,
      },
    };
  }

  /**
   * Collect privacy metrics
   */
  private async collectPrivacyMetrics(): Promise<Phase36KPI['privacy']> {
    // In production: Run actual privacy audits
    // For now: Simulated

    return {
      kAnonymity: {
        k: 5,
        violations: 0,
        score: 88, // Current estimate from Phase 3.5
      },
      differentialPrivacy: {
        epsilon: 1.0,
        budget: 0.42,
        score: 90,
      },
      leakDetection: {
        leaks: 0,
        severity: 'none',
      },
    };
  }

  /**
   * Collect optimizer metrics
   */
  private async collectOptimizerMetrics(): Promise<Phase36KPI['optimizer']> {
    // In production: Get from safety controller
    // For now: Simulated

    return {
      stability: 98, // Current estimate
      rollbacks: 2,
      successRate: 95,
      avgCooldown: 24,
    };
  }

  /**
   * Collect chaos metrics
   */
  private async collectChaosMetrics(): Promise<Phase36KPI['chaos']> {
    // In production: Run chaos tests
    // For now: Placeholder

    return {
      scenarios: 0, // Not yet implemented
      passed: 0,
      resilience: 0,
    };
  }

  /**
   * Calculate overall resilience
   */
  private calculateResilience(kpi: Phase36KPI): number {
    // Weighted average of all metrics
    const weights = {
      testing: 0.3,
      privacy: 0.25,
      optimizer: 0.25,
      chaos: 0.2,
    };

    const testingScore =
      (kpi.testing.totalTests / 400) * 50 +
      kpi.testing.coverage * 0.5;

    const privacyScore =
      (kpi.privacy.kAnonymity.score +
        kpi.privacy.differentialPrivacy.score) / 2;

    const optimizerScore = kpi.optimizer.stability;

    const chaosScore = kpi.chaos.resilience;

    return (
      testingScore * weights.testing +
      privacyScore * weights.privacy +
      optimizerScore * weights.optimizer +
      chaosScore * weights.chaos
    );
  }

  /**
   * Calculate Phase 4.0 readiness
   */
  private calculateReadiness(kpi: Phase36KPI): number {
    // Phase 4.0 readiness checklist
    const checklist = [
      { check: kpi.testing.totalTests >= 400, weight: 20 },
      { check: kpi.testing.coverage >= 85, weight: 15 },
      { check: kpi.privacy.kAnonymity.score >= 95, weight: 15 },
      { check: kpi.privacy.differentialPrivacy.score >= 95, weight: 15 },
      { check: kpi.optimizer.stability >= 99, weight: 10 },
      { check: kpi.chaos.resilience >= 90, weight: 15 },
      { check: kpi.overall.resilience >= 95, weight: 10 },
    ];

    const totalWeight = checklist.reduce((sum, item) => sum + item.weight, 0);
    const passedWeight = checklist
      .filter((item) => item.check)
      .reduce((sum, item) => sum + item.weight, 0);

    return (passedWeight / totalWeight) * 100;
  }

  /**
   * Generate dashboard
   */
  generateDashboard(): KPIDashboard {
    if (this.kpiHistory.length === 0) {
      throw new Error('No KPI data available. Run collect() first.');
    }

    const latest = this.kpiHistory[this.kpiHistory.length - 1];

    // Define targets
    const targets: KPITarget[] = [
      {
        metric: 'Total Tests',
        current: latest.testing.totalTests,
        target: 400,
        unit: 'tests',
        status: this.getStatus(latest.testing.totalTests, 400, 'gte'),
      },
      {
        metric: 'Test Coverage',
        current: latest.testing.coverage,
        target: 85,
        unit: '%',
        status: this.getStatus(latest.testing.coverage, 85, 'gte'),
      },
      {
        metric: 'k-Anonymity Score',
        current: latest.privacy.kAnonymity.score,
        target: 95,
        unit: 'score',
        status: this.getStatus(latest.privacy.kAnonymity.score, 95, 'gte'),
      },
      {
        metric: 'ε-DP Score',
        current: latest.privacy.differentialPrivacy.score,
        target: 95,
        unit: 'score',
        status: this.getStatus(
          latest.privacy.differentialPrivacy.score,
          95,
          'gte'
        ),
      },
      {
        metric: 'Optimizer Stability',
        current: latest.optimizer.stability,
        target: 99,
        unit: '%',
        status: this.getStatus(latest.optimizer.stability, 99, 'gte'),
      },
      {
        metric: 'Chaos Resilience',
        current: latest.chaos.resilience,
        target: 90,
        unit: '%',
        status: this.getStatus(latest.chaos.resilience, 90, 'gte'),
      },
    ];

    // Calculate summary
    const criticalIssues = targets.filter((t) => t.status === 'fail').length;
    const warnings = targets.filter((t) => t.status === 'warn').length;

    // Generate trends
    const trends = this.generateTrends();

    // Generate recommendations
    const recommendations = this.generateRecommendations(latest, targets);

    return {
      summary: {
        phase: '3.6',
        overallHealth: latest.overall.resilience,
        criticalIssues,
        warnings,
      },
      targets,
      trends,
      recommendations,
    };
  }

  /**
   * Get status for target
   */
  private getStatus(
    current: number,
    target: number,
    comparison: 'gte' | 'lte'
  ): 'pass' | 'warn' | 'fail' {
    const ratio = current / target;

    if (comparison === 'gte') {
      if (ratio >= 1.0) return 'pass';
      if (ratio >= 0.8) return 'warn';
      return 'fail';
    } else {
      if (ratio <= 1.0) return 'pass';
      if (ratio <= 1.2) return 'warn';
      return 'fail';
    }
  }

  /**
   * Generate trends
   */
  private generateTrends(): KPIDashboard['trends'] {
    const metrics = [
      'resilience',
      'testing.totalTests',
      'privacy.kAnonymity.score',
      'optimizer.stability',
    ];

    return metrics.map((metric) => ({
      metric,
      history: this.kpiHistory.map((kpi) => ({
        timestamp: kpi.timestamp,
        value: this.getNestedValue(kpi, metric),
      })),
    }));
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): number {
    return path.split('.').reduce((curr, key) => curr?.[key], obj) ?? 0;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    kpi: Phase36KPI,
    targets: KPITarget[]
  ): string[] {
    const recommendations: string[] = [];

    // Check each target
    targets.forEach((target) => {
      if (target.status === 'fail') {
        recommendations.push(
          `🔴 CRITICAL: ${target.metric} is at ${target.current}${target.unit} (target: ${target.target}${target.unit})`
        );
      } else if (target.status === 'warn') {
        recommendations.push(
          `🟡 WARNING: ${target.metric} is at ${target.current}${target.unit} (target: ${target.target}${target.unit})`
        );
      }
    });

    // Specific recommendations
    if (kpi.testing.totalTests < 400) {
      const remaining = 400 - kpi.testing.totalTests;
      recommendations.push(
        `📝 Implement ${remaining} more integration tests to reach Phase 3.6 exit criteria`
      );
    }

    if (kpi.privacy.kAnonymity.score < 95) {
      recommendations.push(
        `🔐 Improve k-anonymity by increasing anonymization level or group sizes`
      );
    }

    if (kpi.optimizer.stability < 99) {
      recommendations.push(
        `⚡ Enhance optimizer stability through safety controller tuning`
      );
    }

    if (kpi.chaos.scenarios === 0) {
      recommendations.push(
        `🌪️ Implement 4 chaos simulation scenarios (Timeout/Router/Corpus/Policy)`
      );
    }

    // Readiness check
    if (kpi.overall.readiness < 80) {
      recommendations.push(
        `🚀 Phase 4.0 readiness is at ${kpi.overall.readiness.toFixed(1)}%. Complete Phase 3.6 hardening before proceeding.`
      );
    }

    return recommendations;
  }

  /**
   * Export dashboard as JSON
   */
  exportDashboard(outputPath?: string): string {
    const dashboard = this.generateDashboard();

    const output = outputPath ?? path.join(this.DATA_DIR, 'dashboard.json');

    fs.writeFileSync(output, JSON.stringify(dashboard, null, 2));

    return output;
  }

  /**
   * Export KPI history
   */
  exportHistory(outputPath?: string): string {
    const output = outputPath ?? path.join(this.DATA_DIR, 'kpi-history.json');

    fs.writeFileSync(
      output,
      JSON.stringify(this.kpiHistory, null, 2)
    );

    return output;
  }

  /**
   * Load history from disk
   */
  private loadHistory(): void {
    const historyPath = path.join(this.DATA_DIR, 'kpi-history.json');

    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf-8');
      this.kpiHistory = JSON.parse(data);
    }
  }

  /**
   * Save history to disk
   */
  private saveHistory(): void {
    this.exportHistory();
  }

  /**
   * Get latest KPI
   */
  getLatest(): Phase36KPI | null {
    return this.kpiHistory[this.kpiHistory.length - 1] ?? null;
  }

  /**
   * Get KPI at date
   */
  getAtDate(date: Date): Phase36KPI | null {
    return (
      this.kpiHistory.find(
        (kpi) => kpi.timestamp.getTime() === date.getTime()
      ) ?? null
    );
  }

  /**
   * Get trend for metric
   */
  getTrend(metric: string): Array<{ timestamp: Date; value: number }> {
    return this.kpiHistory.map((kpi) => ({
      timestamp: kpi.timestamp,
      value: this.getNestedValue(kpi, metric),
    }));
  }
}

/**
 * CLI interface
 */
if (require.main === module) {
  const tracker = new Phase36KPITracker();

  (async () => {
    console.log('📊 Phase 3.6 KPI Tracker');
    console.log('========================\n');

    // Collect current KPI
    console.log('Collecting current KPI...');
    const kpi = await tracker.collect();

    console.log('\n✅ KPI collected:');
    console.log(`  Testing: ${kpi.testing.totalTests} tests`);
    console.log(`  Privacy Score: ${kpi.privacy.kAnonymity.score}`);
    console.log(`  Optimizer Stability: ${kpi.optimizer.stability}%`);
    console.log(`  Overall Resilience: ${kpi.overall.resilience.toFixed(1)}%`);
    console.log(`  Phase 4.0 Readiness: ${kpi.overall.readiness.toFixed(1)}%`);

    // Generate dashboard
    console.log('\nGenerating dashboard...');
    const dashboard = tracker.generateDashboard();

    console.log(`\n📈 Dashboard Summary:`);
    console.log(`  Overall Health: ${dashboard.summary.overallHealth.toFixed(1)}%`);
    console.log(`  Critical Issues: ${dashboard.summary.criticalIssues}`);
    console.log(`  Warnings: ${dashboard.summary.warnings}`);

    // Show recommendations
    if (dashboard.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      dashboard.recommendations.forEach((rec) => console.log(`  ${rec}`));
    }

    // Export
    const dashboardPath = tracker.exportDashboard();
    const historyPath = tracker.exportHistory();

    console.log('\n📁 Exported:');
    console.log(`  Dashboard: ${dashboardPath}`);
    console.log(`  History: ${historyPath}`);
  })();
}
