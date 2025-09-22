/**
 * DxLoop v1 - Auto-Calibration System
 * Automatically adjusts P1/P2 thresholds based on recent run history using percentiles
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';
import { DxLoopConfig, ThresholdCalibration } from './types.js';

interface HistoricalRun {
  timestamp: string;
  session_id: string;
  target: string;
  profile: string;
  metrics: {
    cost_per_item: number;
    latency_p95_ms: number;
    failure_rate: number;
    duplication_rate: number;
    coverage_rate: number;
    quality_score: number;
  };
}

/**
 * Load historical run data from session reports and baseline reports
 */
async function loadHistoricalRuns(lookbackRuns: number): Promise<HistoricalRun[]> {
  const runs: HistoricalRun[] = [];

  try {
    // Find session report history files
    const historyFiles = await glob('reports/history/*/session_report.md');

    // Sort by timestamp (most recent first)
    historyFiles.sort((a, b) => {
      const timestampA = a.match(/history\/(\d{8}_\d{6})/)?.[1] || '0';
      const timestampB = b.match(/history\/(\d{8}_\d{6})/)?.[1] || '0';
      return timestampB.localeCompare(timestampA);
    });

    // Process up to lookbackRuns files
    const filesToProcess = historyFiles.slice(0, lookbackRuns);

    for (const filePath of filesToProcess) {
      try {
        const run = await parseHistoricalRun(filePath);
        if (run) {
          runs.push(run);
        }
      } catch (error) {
        console.warn(`Could not parse historical run ${filePath}:`, error);
      }
    }

    console.log(`Loaded ${runs.length} historical runs from ${filesToProcess.length} files`);
    return runs;

  } catch (error) {
    console.error('Error loading historical runs:', error);
    return [];
  }
}

/**
 * Parse individual historical session report
 */
async function parseHistoricalRun(filePath: string): Promise<HistoricalRun | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract summary block
    const summaryMatch = content.match(/```\n(SESSION_ID:.*?)\n```/s);
    if (!summaryMatch) {
      return null;
    }

    const summaryLines = summaryMatch[1].split('\n');
    const data: any = {};

    for (const line of summaryLines) {
      const [key, ...valueParts] = line.split(': ');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(': ').trim();
        data[key.toLowerCase()] = value;
      }
    }

    // Calculate derived metrics
    const costPerItem = parseFloat(data.cost_usd || '0') / Math.max(parseInt(data.cases_total || '1'), 1);
    const latencyP95 = parseInt(data.p95_ms || '0');
    const failureRate = 1.0 - (parseFloat(data.pass_rate || '0') / 100);

    // Look for corresponding baseline report for quality metrics
    const timestampMatch = filePath.match(/history\/(\d{8}_\d{6})/);
    let duplicationRate = 0;
    let coverageRate = 0.8; // Default assumption
    let qualityScore = parseFloat(data.mean_score || '0') / 10; // Convert 0-10 to 0-1

    if (timestampMatch) {
      const baselineReportPath = filePath.replace('session_report.md', '../baseline_report.jsonl');
      try {
        const baselineContent = await fs.readFile(baselineReportPath, 'utf-8');
        const baselineData = JSON.parse(baselineContent.split('\n')[0]);
        duplicationRate = baselineData.duplication_metrics?.rate || 0;
        coverageRate = baselineData.coverage_metrics?.entity_coverage_rate || 0.8;
        qualityScore = baselineData.quality_score || qualityScore;
      } catch {
        // Baseline report not available or malformed
      }
    }

    return {
      timestamp: data.timestamp || new Date().toISOString(),
      session_id: data.session_id || '',
      target: data.target || '',
      profile: data.profile || 'dev',
      metrics: {
        cost_per_item: costPerItem,
        latency_p95_ms: latencyP95,
        failure_rate: failureRate,
        duplication_rate: duplicationRate,
        coverage_rate: coverageRate,
        quality_score: qualityScore
      }
    };

  } catch (error) {
    console.warn(`Error parsing historical run ${filePath}:`, error);
    return null;
  }
}

/**
 * Calculate percentile for array of numbers
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);

  if (index === Math.floor(index)) {
    return sorted[index];
  } else {
    const lower = sorted[Math.floor(index)];
    const upper = sorted[Math.ceil(index)];
    return lower + (upper - lower) * (index - Math.floor(index));
  }
}

/**
 * Detect drift in metric values
 */
function detectDrift(
  values: number[],
  currentThreshold: number,
  maxDelta: number
): { driftDetected: boolean; reason: string } {
  if (values.length < 3) {
    return { driftDetected: false, reason: 'Insufficient data for drift detection' };
  }

  const recent = values.slice(0, Math.min(3, values.length));
  const older = values.slice(3);

  if (older.length === 0) {
    return { driftDetected: false, reason: 'No historical comparison data' };
  }

  const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderMean = older.reduce((a, b) => a + b, 0) / older.length;

  const relativeChange = Math.abs(recentMean - olderMean) / Math.max(olderMean, 0.001);
  const thresholdChange = Math.abs(recentMean - currentThreshold) / Math.max(currentThreshold, 0.001);

  if (relativeChange > maxDelta) {
    return {
      driftDetected: true,
      reason: `Significant metric drift detected: ${(relativeChange * 100).toFixed(1)}% change`
    };
  }

  if (thresholdChange > maxDelta * 2) {
    return {
      driftDetected: true,
      reason: `Threshold misalignment: ${(thresholdChange * 100).toFixed(1)}% from current data`
    };
  }

  return { driftDetected: false, reason: 'No significant drift detected' };
}

/**
 * Auto-calibrate P1/P2 thresholds based on historical data
 */
export async function autoCalibrateThresholds(
  config: DxLoopConfig,
  profile: string
): Promise<ThresholdCalibration[]> {
  const calibrations: ThresholdCalibration[] = [];

  try {
    console.log('Starting auto-calibration process...');

    if (!config.autocalibration.enabled) {
      console.log('Auto-calibration is disabled');
      return calibrations;
    }

    // Load historical run data
    const historicalRuns = await loadHistoricalRuns(config.autocalibration.lookback_runs);

    if (historicalRuns.length < 5) {
      console.warn(`Insufficient historical data for calibration: ${historicalRuns.length} runs (minimum 5 required)`);
      return calibrations;
    }

    // Filter runs by profile if specified
    const profileRuns = profile ? historicalRuns.filter(run => run.profile === profile) : historicalRuns;

    if (profileRuns.length < 3) {
      console.warn(`Insufficient profile-specific data for calibration: ${profileRuns.length} runs`);
      return calibrations;
    }

    console.log(`Using ${profileRuns.length} profile-matched runs for calibration`);

    // Extract metric arrays
    const costPerItem = profileRuns.map(run => run.metrics.cost_per_item).filter(v => v > 0);
    const latencyP95 = profileRuns.map(run => run.metrics.latency_p95_ms).filter(v => v > 0);
    const failureRate = profileRuns.map(run => run.metrics.failure_rate).filter(v => v >= 0);
    const duplicationRate = profileRuns.map(run => run.metrics.duplication_rate).filter(v => v >= 0);
    const coverageRate = profileRuns.map(run => run.metrics.coverage_rate).filter(v => v > 0);
    const qualityScore = profileRuns.map(run => run.metrics.quality_score).filter(v => v > 0);

    // P1 Calibrations
    if (costPerItem.length >= 3) {
      const warnThreshold = calculatePercentile(costPerItem, config.autocalibration.percentile_warn);
      const failThreshold = calculatePercentile(costPerItem, config.autocalibration.percentile_fail);
      const drift = detectDrift(costPerItem, config.thresholds.p1.cost_per_item_warn, config.autocalibration.drift_guard_max_delta);

      calibrations.push({
        metric: 'cost_per_item',
        current_warn: config.thresholds.p1.cost_per_item_warn,
        current_fail: config.thresholds.p1.cost_per_item_fail,
        suggested_warn: Math.round(warnThreshold * 1000) / 1000,
        suggested_fail: Math.round(failThreshold * 1000) / 1000,
        confidence: Math.min(costPerItem.length / config.autocalibration.lookback_runs, 1.0),
        lookback_runs: costPerItem.length,
        drift_detected: drift.driftDetected,
        change_reason: drift.reason
      });
    }

    if (latencyP95.length >= 3) {
      const warnThreshold = calculatePercentile(latencyP95, config.autocalibration.percentile_warn);
      const failThreshold = calculatePercentile(latencyP95, config.autocalibration.percentile_fail);
      const drift = detectDrift(latencyP95, config.thresholds.p1.latency_p95_warn_ms, config.autocalibration.drift_guard_max_delta);

      calibrations.push({
        metric: 'latency_p95_ms',
        current_warn: config.thresholds.p1.latency_p95_warn_ms,
        current_fail: config.thresholds.p1.latency_p95_fail_ms,
        suggested_warn: Math.round(warnThreshold),
        suggested_fail: Math.round(failThreshold),
        confidence: Math.min(latencyP95.length / config.autocalibration.lookback_runs, 1.0),
        lookback_runs: latencyP95.length,
        drift_detected: drift.driftDetected,
        change_reason: drift.reason
      });
    }

    if (failureRate.length >= 3) {
      const warnThreshold = calculatePercentile(failureRate, config.autocalibration.percentile_warn);
      const failThreshold = calculatePercentile(failureRate, config.autocalibration.percentile_fail);
      const drift = detectDrift(failureRate, config.thresholds.p1.failure_rate_warn, config.autocalibration.drift_guard_max_delta);

      calibrations.push({
        metric: 'failure_rate',
        current_warn: config.thresholds.p1.failure_rate_warn,
        current_fail: config.thresholds.p1.failure_rate_fail,
        suggested_warn: Math.round(warnThreshold * 1000) / 1000,
        suggested_fail: Math.round(failThreshold * 1000) / 1000,
        confidence: Math.min(failureRate.length / config.autocalibration.lookback_runs, 1.0),
        lookback_runs: failureRate.length,
        drift_detected: drift.driftDetected,
        change_reason: drift.reason
      });
    }

    // P2 Calibrations
    if (duplicationRate.length >= 3) {
      const warnThreshold = calculatePercentile(duplicationRate, config.autocalibration.percentile_warn);
      const failThreshold = calculatePercentile(duplicationRate, config.autocalibration.percentile_fail);
      const drift = detectDrift(duplicationRate, config.thresholds.p2.duplication_rate_warn, config.autocalibration.drift_guard_max_delta);

      calibrations.push({
        metric: 'duplication_rate',
        current_warn: config.thresholds.p2.duplication_rate_warn,
        current_fail: config.thresholds.p2.duplication_rate_fail,
        suggested_warn: Math.round(warnThreshold * 1000) / 1000,
        suggested_fail: Math.round(failThreshold * 1000) / 1000,
        confidence: Math.min(duplicationRate.length / config.autocalibration.lookback_runs, 1.0),
        lookback_runs: duplicationRate.length,
        drift_detected: drift.driftDetected,
        change_reason: drift.reason
      });
    }

    if (coverageRate.length >= 3) {
      // For coverage, lower percentiles are worse (invert)
      const warnThreshold = calculatePercentile(coverageRate, 100 - config.autocalibration.percentile_warn);
      const failThreshold = calculatePercentile(coverageRate, 100 - config.autocalibration.percentile_fail);
      const drift = detectDrift(coverageRate, config.thresholds.p2.coverage_rate_warn, config.autocalibration.drift_guard_max_delta);

      calibrations.push({
        metric: 'coverage_rate',
        current_warn: config.thresholds.p2.coverage_rate_warn,
        current_fail: config.thresholds.p2.coverage_rate_fail,
        suggested_warn: Math.round(warnThreshold * 1000) / 1000,
        suggested_fail: Math.round(failThreshold * 1000) / 1000,
        confidence: Math.min(coverageRate.length / config.autocalibration.lookback_runs, 1.0),
        lookback_runs: coverageRate.length,
        drift_detected: drift.driftDetected,
        change_reason: drift.reason
      });
    }

    if (qualityScore.length >= 3) {
      // For quality score, lower percentiles are worse (invert)
      const warnThreshold = calculatePercentile(qualityScore, 100 - config.autocalibration.percentile_warn);
      const failThreshold = calculatePercentile(qualityScore, 100 - config.autocalibration.percentile_fail);
      const drift = detectDrift(qualityScore, config.thresholds.p2.quality_score_warn, config.autocalibration.drift_guard_max_delta);

      calibrations.push({
        metric: 'quality_score',
        current_warn: config.thresholds.p2.quality_score_warn,
        current_fail: config.thresholds.p2.quality_score_fail,
        suggested_warn: Math.round(warnThreshold * 1000) / 1000,
        suggested_fail: Math.round(failThreshold * 1000) / 1000,
        confidence: Math.min(qualityScore.length / config.autocalibration.lookback_runs, 1.0),
        lookback_runs: qualityScore.length,
        drift_detected: drift.driftDetected,
        change_reason: drift.reason
      });
    }

    console.log(`Auto-calibration completed: ${calibrations.length} calibrations generated`);
    return calibrations;

  } catch (error) {
    console.error('Error during auto-calibration:', error);
    throw error;
  }
}

/**
 * Apply calibrations to configuration (returns updated config without saving)
 */
export function applyCalibrations(
  config: DxLoopConfig,
  calibrations: ThresholdCalibration[],
  driftGuardEnabled: boolean = true
): { updatedConfig: DxLoopConfig; appliedChanges: string[] } {
  const updatedConfig = JSON.parse(JSON.stringify(config)); // Deep copy
  const appliedChanges: string[] = [];

  for (const calibration of calibrations) {
    // Skip if drift guard is enabled and drift exceeds maximum allowed delta
    if (driftGuardEnabled && calibration.drift_detected) {
      const currentWarn = calibration.current_warn;
      const suggestedWarn = calibration.suggested_warn;
      const deltaWarn = Math.abs(suggestedWarn - currentWarn) / Math.max(currentWarn, 0.001);

      if (deltaWarn > config.autocalibration.drift_guard_max_delta) {
        console.warn(`Skipping ${calibration.metric} calibration: drift exceeds guard limit (${(deltaWarn * 100).toFixed(1)}%)`);
        continue;
      }
    }

    // Apply calibration based on metric
    if (calibration.metric in updatedConfig.thresholds.p1) {
      const p1Key = calibration.metric as keyof typeof updatedConfig.thresholds.p1;
      if (calibration.metric.includes('warn')) {
        (updatedConfig.thresholds.p1 as any)[p1Key] = calibration.suggested_warn;
      } else if (calibration.metric.includes('fail')) {
        (updatedConfig.thresholds.p1 as any)[p1Key] = calibration.suggested_fail;
      } else {
        // Update both warn and fail thresholds
        const warnKey = `${calibration.metric}_warn` as keyof typeof updatedConfig.thresholds.p1;
        const failKey = `${calibration.metric}_fail` as keyof typeof updatedConfig.thresholds.p1;
        if (warnKey in updatedConfig.thresholds.p1) {
          (updatedConfig.thresholds.p1 as any)[warnKey] = calibration.suggested_warn;
        }
        if (failKey in updatedConfig.thresholds.p1) {
          (updatedConfig.thresholds.p1 as any)[failKey] = calibration.suggested_fail;
        }
      }
    }

    if (calibration.metric in updatedConfig.thresholds.p2) {
      const p2Key = calibration.metric as keyof typeof updatedConfig.thresholds.p2;
      const warnKey = `${calibration.metric}_warn` as keyof typeof updatedConfig.thresholds.p2;
      const failKey = `${calibration.metric}_fail` as keyof typeof updatedConfig.thresholds.p2;
      if (warnKey in updatedConfig.thresholds.p2) {
        (updatedConfig.thresholds.p2 as any)[warnKey] = calibration.suggested_warn;
      }
      if (failKey in updatedConfig.thresholds.p2) {
        (updatedConfig.thresholds.p2 as any)[failKey] = calibration.suggested_fail;
      }
    }

    appliedChanges.push(`${calibration.metric}: ${calibration.current_warn}→${calibration.suggested_warn} (warn), ${calibration.current_fail}→${calibration.suggested_fail} (fail)`);
  }

  return { updatedConfig, appliedChanges };
}

/**
 * CLI interface for auto-calibration
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'calibrate') {
    const profile = process.argv[3] || 'dev';

    // This would typically load config from load_thresholds
    const defaultConfig: DxLoopConfig = {
      profiles: { dev: { name: 'dev', budget_max_usd: 1, timeout_max_ms: 30000, per_agent_limits: { answer_max_usd: 0.05, audit_max_ms: 6000 } }, stage: { name: 'stage', budget_max_usd: 2, timeout_max_ms: 45000, per_agent_limits: { answer_max_usd: 0.1, audit_max_ms: 10000 } }, prod: { name: 'prod', budget_max_usd: 5, timeout_max_ms: 60000, per_agent_limits: { answer_max_usd: 0.2, audit_max_ms: 15000 } } },
      thresholds: { p0: { pii_hits_max: 0, license_violations_max: 2, evidence_missing_rate_max: 0.3, hallucination_rate_max: 0.05 }, p1: { cost_per_item_warn: 0.08, cost_per_item_fail: 0.15, latency_p95_warn_ms: 4000, latency_p95_fail_ms: 8000, failure_rate_warn: 0.1, failure_rate_fail: 0.25 }, p2: { duplication_rate_warn: 0.1, duplication_rate_fail: 0.2, coverage_rate_warn: 0.7, coverage_rate_fail: 0.5, quality_score_warn: 0.7, quality_score_fail: 0.5 } },
      autocalibration: { enabled: true, lookback_runs: 10, percentile_warn: 75, percentile_fail: 90, drift_guard_max_delta: 0.2 }
    };

    autoCalibrateThresholds(defaultConfig, profile)
      .then((calibrations) => {
        console.log('Auto-calibration Result:');
        console.log(JSON.stringify(calibrations, null, 2));
      })
      .catch((error) => {
        console.error('Auto-calibration failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node autocalibrate.js calibrate [profile]');
    process.exit(1);
  }
}