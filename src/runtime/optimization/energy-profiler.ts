/**
 * Energy Profiler
 *
 * Measures computational cost and energy consumption across all layers.
 *
 * Features:
 * - Layer-wise energy measurement
 * - Cost per kQA calculation
 * - Carbon footprint estimation
 * - Efficiency scoring
 * - Gate S (Sustainability) data generation
 *
 * KPI:
 * - Energy usage per kQA: -15%
 * - Cost per kQA: -20%
 * - Carbon footprint reduction
 *
 * @see Phase 2.7 Sustainability Layer
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Energy measurement for a single operation
 */
export interface EnergyMeasurement {
  layerId: string;
  operation: string;
  timestamp: Date;
  metrics: {
    cpuTime: number; // CPU time (ms)
    memoryDelta: number; // Memory delta (bytes)
    estimatedEnergy: number; // Estimated energy (joules)
    estimatedCost: number; // Estimated cost (USD)
    carbonFootprint: number; // Carbon footprint (gCO2)
  };
}

/**
 * Layer energy profile
 */
export interface LayerEnergyProfile {
  layerId: string;
  totalEnergy: number; // Total energy (joules)
  totalCost: number; // Total cost (USD)
  totalCarbon: number; // Total carbon (gCO2)
  operations: number; // Number of operations
  avgEnergyPerOp: number;
  avgCostPerOp: number;
}

/**
 * System energy profile
 */
export interface SystemProfile {
  totalEnergy: number;
  totalCost: number;
  totalCarbon: number;
  totalOperations: number;
  layers: LayerEnergyProfile[];
  costPerKQA: number;
  energyPerKQA: number;
  carbonPerKQA: number;
}

/**
 * Energy profile configuration
 */
export interface EnergyProfilerConfig {
  // Energy cost factors
  cpuEnergyFactor: number; // Joules per CPU-ms
  memoryEnergyFactor: number; // Joules per MB

  // Cost factors
  cpuCostFactor: number; // USD per CPU-hour
  memoryCostFactor: number; // USD per GB-hour

  // Carbon factors
  carbonIntensity: number; // gCO2 per kWh

  // Output
  reportPath: string;
  enableRealtime: boolean;
}

const DEFAULT_CONFIG: EnergyProfilerConfig = {
  // Energy factors (based on typical server hardware)
  cpuEnergyFactor: 0.001, // ~1 joule per CPU-second
  memoryEnergyFactor: 0.0001, // ~0.1 joule per MB

  // Cost factors (AWS-like pricing)
  cpuCostFactor: 0.05, // $0.05 per CPU-hour
  memoryCostFactor: 0.01, // $0.01 per GB-hour

  // Carbon factors (global average)
  carbonIntensity: 475, // 475 gCO2 per kWh (global average)

  // Output
  reportPath: path.join(process.cwd(), 'reports/energy-profile.json'),
  enableRealtime: true,
};

/**
 * Energy Profiler
 *
 * Tracks energy consumption and costs across the system.
 */
export class EnergyProfiler {
  private config: EnergyProfilerConfig;
  private measurements: EnergyMeasurement[] = [];
  private activeTimers = new Map<string, {
    startTime: number;
    startMemory: number;
    layerId: string;
  }>();

  constructor(config: Partial<EnergyProfilerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start energy measurement
   */
  start(layerId: string, operation: string = 'default'): void {
    const key = `${layerId}:${operation}`;
    const memUsage = process.memoryUsage();

    this.activeTimers.set(key, {
      startTime: performance.now(),
      startMemory: memUsage.heapUsed,
      layerId,
    });
  }

  /**
   * End energy measurement
   */
  end(layerId: string, operation: string = 'default'): EnergyMeasurement | null {
    const key = `${layerId}:${operation}`;
    const timer = this.activeTimers.get(key);

    if (!timer) {
      console.warn(`No active timer for ${key}`);
      return null;
    }

    const endTime = performance.now();
    const memUsage = process.memoryUsage();

    // Calculate metrics
    const cpuTime = endTime - timer.startTime;
    const memoryDelta = Math.max(0, memUsage.heapUsed - timer.startMemory);

    // Estimate energy (joules)
    const cpuEnergy = (cpuTime / 1000) * this.config.cpuEnergyFactor;
    const memoryEnergy = (memoryDelta / (1024 * 1024)) * this.config.memoryEnergyFactor;
    const estimatedEnergy = cpuEnergy + memoryEnergy;

    // Estimate cost (USD)
    const cpuCost = (cpuTime / (1000 * 60 * 60)) * this.config.cpuCostFactor;
    const memoryCost = (memoryDelta / (1024 * 1024 * 1024)) * (cpuTime / (1000 * 60 * 60)) * this.config.memoryCostFactor;
    const estimatedCost = cpuCost + memoryCost;

    // Estimate carbon footprint (gCO2)
    const energyKWh = estimatedEnergy / (1000 * 3600); // joules to kWh
    const carbonFootprint = energyKWh * this.config.carbonIntensity;

    const measurement: EnergyMeasurement = {
      layerId,
      operation,
      timestamp: new Date(),
      metrics: {
        cpuTime,
        memoryDelta,
        estimatedEnergy,
        estimatedCost,
        carbonFootprint,
      },
    };

    this.measurements.push(measurement);
    this.activeTimers.delete(key);

    return measurement;
  }

  /**
   * Get energy profile by layer
   */
  getLayerProfile(layerId: string): LayerEnergyProfile {
    const layerMeasurements = this.measurements.filter((m) => m.layerId === layerId);

    if (layerMeasurements.length === 0) {
      return {
        layerId,
        totalEnergy: 0,
        totalCost: 0,
        totalCarbon: 0,
        operations: 0,
        avgEnergyPerOp: 0,
        avgCostPerOp: 0,
      };
    }

    const totalEnergy = layerMeasurements.reduce((sum, m) => sum + m.metrics.estimatedEnergy, 0);
    const totalCost = layerMeasurements.reduce((sum, m) => sum + m.metrics.estimatedCost, 0);
    const totalCarbon = layerMeasurements.reduce((sum, m) => sum + m.metrics.carbonFootprint, 0);
    const operations = layerMeasurements.length;

    return {
      layerId,
      totalEnergy,
      totalCost,
      totalCarbon,
      operations,
      avgEnergyPerOp: totalEnergy / operations,
      avgCostPerOp: totalCost / operations,
    };
  }

  /**
   * Get total system profile
   */
  getSystemProfile(): SystemProfile {
    const uniqueLayers = [...new Set(this.measurements.map((m) => m.layerId))];
    const layers = uniqueLayers.map((layerId) => this.getLayerProfile(layerId));

    const totalEnergy = layers.reduce((sum, l) => sum + l.totalEnergy, 0);
    const totalCost = layers.reduce((sum, l) => sum + l.totalCost, 0);
    const totalCarbon = layers.reduce((sum, l) => sum + l.totalCarbon, 0);
    const totalOperations = layers.reduce((sum, l) => sum + l.operations, 0);

    // Estimate per kQA (assuming 1 operation = 1 QA)
    const costPerKQA = (totalCost / totalOperations) * 1000;
    const energyPerKQA = (totalEnergy / totalOperations) * 1000;
    const carbonPerKQA = (totalCarbon / totalOperations) * 1000;

    return {
      totalEnergy,
      totalCost,
      totalCarbon,
      totalOperations,
      layers,
      costPerKQA,
      energyPerKQA,
      carbonPerKQA,
    };
  }

  /**
   * Generate sustainability report
   */
  generateReport(): {
    timestamp: Date;
    systemProfile: SystemProfile;
    efficiency: {
      energyEfficiency: number; // operations per joule
      costEfficiency: number; // operations per USD
      carbonEfficiency: number; // operations per gCO2
    };
    recommendations: string[];
  } {
    const systemProfile = this.getSystemProfile();

    const efficiency = {
      energyEfficiency: systemProfile.totalOperations / Math.max(systemProfile.totalEnergy, 0.001),
      costEfficiency: systemProfile.totalOperations / Math.max(systemProfile.totalCost, 0.001),
      carbonEfficiency: systemProfile.totalOperations / Math.max(systemProfile.totalCarbon, 0.001),
    };

    const recommendations: string[] = [];

    // Find energy-intensive layers
    const sortedByEnergy = [...systemProfile.layers].sort((a, b) => b.avgEnergyPerOp - a.avgEnergyPerOp);
    if (sortedByEnergy.length > 0 && sortedByEnergy[0].avgEnergyPerOp > 0.01) {
      recommendations.push(`Optimize ${sortedByEnergy[0].layerId}: highest energy per operation`);
    }

    // Cost optimization
    if (systemProfile.costPerKQA > 0.1) {
      recommendations.push('Cost per kQA is high - consider caching or batch optimization');
    }

    // Carbon footprint
    if (systemProfile.carbonPerKQA > 10) {
      recommendations.push('Carbon footprint is high - consider green computing options');
    }

    return {
      timestamp: new Date(),
      systemProfile,
      efficiency,
      recommendations,
    };
  }

  /**
   * Save report to file
   */
  saveReport(): void {
    const report = this.generateReport();

    try {
      const dir = path.dirname(this.config.reportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📊 Energy profile saved to: ${this.config.reportPath}`);
    } catch (error) {
      console.error('Failed to save energy profile:', error);
    }
  }

  /**
   * Print report to console
   */
  printReport(): void {
    const report = this.generateReport();
    const { systemProfile, efficiency } = report;

    console.log('\n⚡ ENERGY PROFILE REPORT');
    console.log('='.repeat(70));
    console.log('\nSystem Summary:');
    console.log(`  Total Operations: ${systemProfile.totalOperations}`);
    console.log(`  Total Energy: ${systemProfile.totalEnergy.toFixed(3)} J`);
    console.log(`  Total Cost: $${systemProfile.totalCost.toFixed(6)}`);
    console.log(`  Total Carbon: ${systemProfile.totalCarbon.toFixed(3)} gCO2`);
    console.log();
    console.log('Per kQA:');
    console.log(`  Energy: ${systemProfile.energyPerKQA.toFixed(3)} J/kQA`);
    console.log(`  Cost: $${systemProfile.costPerKQA.toFixed(6)}/kQA`);
    console.log(`  Carbon: ${systemProfile.carbonPerKQA.toFixed(3)} gCO2/kQA`);
    console.log();
    console.log('Efficiency:');
    console.log(`  Energy: ${efficiency.energyEfficiency.toFixed(0)} ops/J`);
    console.log(`  Cost: ${efficiency.costEfficiency.toFixed(0)} ops/$`);
    console.log(`  Carbon: ${efficiency.carbonEfficiency.toFixed(0)} ops/gCO2`);
    console.log();

    if (report.recommendations.length > 0) {
      console.log('Recommendations:');
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
      console.log();
    }

    console.log('='.repeat(70));
  }

  /**
   * Clear measurements
   */
  clear(): void {
    this.measurements = [];
    this.activeTimers.clear();
  }

  /**
   * Get measurements
   */
  getMeasurements(): EnergyMeasurement[] {
    return this.measurements;
  }
}

/**
 * Default singleton instance
 */
export const energyProfiler = new EnergyProfiler();
