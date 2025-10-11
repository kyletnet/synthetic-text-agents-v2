/**
 * Sustainability Tracker
 *
 * Continuous monitoring and tracking of system sustainability metrics.
 *
 * Features:
 * - Real-time energy/cost/carbon tracking
 * - Trend analysis and forecasting
 * - Sustainability scoring
 * - Alert system for threshold violations
 *
 * @see Energy Profiler, Gate F
 */

import { EnergyProfiler } from '../../src/runtime/optimization/energy-profiler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Sustainability metrics snapshot
 */
export interface SustainabilitySnapshot {
  timestamp: Date;
  metrics: {
    energyPerKQA: number;
    costPerKQA: number;
    carbonPerKQA: number;
    totalOperations: number;
  };
  trends: {
    energyTrend: 'improving' | 'stable' | 'degrading';
    costTrend: 'improving' | 'stable' | 'degrading';
    carbonTrend: 'improving' | 'stable' | 'degrading';
  };
  score: {
    overall: number; // 0-100
    energy: number;
    cost: number;
    carbon: number;
  };
}

/**
 * Sustainability Tracker
 */
export class SustainabilityTracker {
  private profiler: EnergyProfiler;
  private snapshots: SustainabilitySnapshot[] = [];
  private reportPath: string;

  constructor(profiler: EnergyProfiler = new EnergyProfiler()) {
    this.profiler = profiler;
    this.reportPath = path.join(process.cwd(), 'reports/sustainability-history.json');
    this.loadHistory();
  }

  /**
   * Take snapshot
   */
  takeSnapshot(): SustainabilitySnapshot {
    const profile = this.profiler.getSystemProfile();

    // Calculate trends
    const trends = this.calculateTrends();

    // Calculate scores
    const score = this.calculateScore(profile);

    const snapshot: SustainabilitySnapshot = {
      timestamp: new Date(),
      metrics: {
        energyPerKQA: profile.energyPerKQA,
        costPerKQA: profile.costPerKQA,
        carbonPerKQA: profile.carbonPerKQA,
        totalOperations: profile.totalOperations,
      },
      trends,
      score,
    };

    this.snapshots.push(snapshot);
    this.saveHistory();

    return snapshot;
  }

  /**
   * Calculate trends
   */
  private calculateTrends(): SustainabilitySnapshot['trends'] {
    if (this.snapshots.length < 2) {
      return {
        energyTrend: 'stable',
        costTrend: 'stable',
        carbonTrend: 'stable',
      };
    }

    const recent = this.snapshots.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const energyChange = (last.metrics.energyPerKQA - first.metrics.energyPerKQA) / first.metrics.energyPerKQA;
    const costChange = (last.metrics.costPerKQA - first.metrics.costPerKQA) / first.metrics.costPerKQA;
    const carbonChange = (last.metrics.carbonPerKQA - first.metrics.carbonPerKQA) / first.metrics.carbonPerKQA;

    const getTrend = (change: number) => {
      if (change < -0.05) return 'improving';
      if (change > 0.05) return 'degrading';
      return 'stable';
    };

    return {
      energyTrend: getTrend(energyChange),
      costTrend: getTrend(costChange),
      carbonTrend: getTrend(carbonChange),
    };
  }

  /**
   * Calculate sustainability score
   */
  private calculateScore(profile: ReturnType<EnergyProfiler['getSystemProfile']>): SustainabilitySnapshot['score'] {
    // Baseline targets
    const energyTarget = 1.0; // 1 J/kQA
    const costTarget = 0.0001; // $0.0001/kQA
    const carbonTarget = 0.5; // 0.5 gCO2/kQA

    const energyScore = Math.max(0, Math.min(100, (energyTarget / Math.max(profile.energyPerKQA, 0.001)) * 100));
    const costScore = Math.max(0, Math.min(100, (costTarget / Math.max(profile.costPerKQA, 0.000001)) * 100));
    const carbonScore = Math.max(0, Math.min(100, (carbonTarget / Math.max(profile.carbonPerKQA, 0.001)) * 100));

    const overall = (energyScore + costScore + carbonScore) / 3;

    return {
      overall,
      energy: energyScore,
      cost: costScore,
      carbon: carbonScore,
    };
  }

  /**
   * Get latest snapshot
   */
  getLatest(): SustainabilitySnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /**
   * Save history
   */
  private saveHistory(): void {
    try {
      const dir = path.dirname(this.reportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.reportPath, JSON.stringify(this.snapshots, null, 2));
    } catch (error) {
      console.error('Failed to save sustainability history:', error);
    }
  }

  /**
   * Load history
   */
  private loadHistory(): void {
    try {
      if (fs.existsSync(this.reportPath)) {
        const data = fs.readFileSync(this.reportPath, 'utf-8');
        this.snapshots = JSON.parse(data).map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
        }));
      }
    } catch (error) {
      console.warn('Failed to load sustainability history:', error);
    }
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const tracker = new SustainabilityTracker();
  const snapshot = tracker.takeSnapshot();

  console.log('\n🌱 SUSTAINABILITY SNAPSHOT');
  console.log('='.repeat(70));
  console.log('\nMetrics per kQA:');
  console.log(`  Energy: ${snapshot.metrics.energyPerKQA.toFixed(3)} J`);
  console.log(`  Cost: $${snapshot.metrics.costPerKQA.toFixed(6)}`);
  console.log(`  Carbon: ${snapshot.metrics.carbonPerKQA.toFixed(3)} gCO2`);
  console.log('\nTrends:');
  console.log(`  Energy: ${snapshot.trends.energyTrend}`);
  console.log(`  Cost: ${snapshot.trends.costTrend}`);
  console.log(`  Carbon: ${snapshot.trends.carbonTrend}`);
  console.log('\nScores (0-100):');
  console.log(`  Overall: ${snapshot.score.overall.toFixed(1)}`);
  console.log(`  Energy: ${snapshot.score.energy.toFixed(1)}`);
  console.log(`  Cost: ${snapshot.score.cost.toFixed(1)}`);
  console.log(`  Carbon: ${snapshot.score.carbon.toFixed(1)}`);
  console.log('\n' + '='.repeat(70));
}
