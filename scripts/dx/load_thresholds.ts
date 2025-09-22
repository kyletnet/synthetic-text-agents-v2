/**
 * DxLoop v1 - Threshold Loader
 * Loads and merges thresholds from baseline_config.json with profile-specific overrides
 */

import { promises as fs } from 'fs';
import { DxLoopConfig, DxProfile, DxThresholds } from './types.js';

/**
 * Default DxLoop configuration structure
 */
const DEFAULT_DXLOOP_CONFIG: DxLoopConfig = {
  profiles: {
    dev: {
      name: 'dev',
      budget_max_usd: 1.0,
      timeout_max_ms: 30000,
      per_agent_limits: {
        answer_max_usd: 0.05,
        audit_max_ms: 6000
      }
    },
    stage: {
      name: 'stage',
      budget_max_usd: 2.0,
      timeout_max_ms: 45000,
      per_agent_limits: {
        answer_max_usd: 0.10,
        audit_max_ms: 10000
      }
    },
    prod: {
      name: 'prod',
      budget_max_usd: 5.0,
      timeout_max_ms: 60000,
      per_agent_limits: {
        answer_max_usd: 0.20,
        audit_max_ms: 15000
      }
    }
  },
  thresholds: {
    // P0 - Fixed thresholds (never auto-calibrated)
    p0: {
      pii_hits_max: 0,
      license_violations_max: 2,
      evidence_missing_rate_max: 0.3,
      hallucination_rate_max: 0.05
    },
    // P1 - Auto-calibration candidates
    p1: {
      cost_per_item_warn: 0.08,
      cost_per_item_fail: 0.15,
      latency_p95_warn_ms: 4000,
      latency_p95_fail_ms: 8000,
      failure_rate_warn: 0.10,
      failure_rate_fail: 0.25
    },
    // P2 - Auto-calibration candidates
    p2: {
      duplication_rate_warn: 0.10,
      duplication_rate_fail: 0.20,
      coverage_rate_warn: 0.70,
      coverage_rate_fail: 0.50,
      quality_score_warn: 0.70,
      quality_score_fail: 0.50
    }
  },
  autocalibration: {
    enabled: false,
    lookback_runs: 10,
    percentile_warn: 75,
    percentile_fail: 90,
    drift_guard_max_delta: 0.20
  }
};

/**
 * Load existing baseline_config.json and extract relevant fields
 */
async function loadBaselineConfig(configPath: string = 'baseline_config.json'): Promise<any> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Could not load baseline config from ${configPath}:`, error);
    return {};
  }
}

/**
 * Merge DxLoop configuration with existing baseline config
 */
function mergeDxLoopConfig(baselineConfig: any, dxConfig: DxLoopConfig): any {
  // Extract existing thresholds and convert to DxLoop format
  const merged = { ...baselineConfig };

  // Add DxLoop-specific configuration
  merged.dxloop = {
    profiles: dxConfig.profiles,
    thresholds: dxConfig.thresholds,
    autocalibration: dxConfig.autocalibration
  };

  // Map existing alert thresholds to DxLoop P0/P1/P2 structure
  if (baselineConfig.duplication_metrics?.alert_thresholds) {
    merged.dxloop.thresholds.p2.duplication_rate_warn =
      baselineConfig.duplication_metrics.alert_thresholds.duplication_rate_max * 0.7;
    merged.dxloop.thresholds.p2.duplication_rate_fail =
      baselineConfig.duplication_metrics.alert_thresholds.duplication_rate_max;
  }

  if (baselineConfig.evidence_quality?.alert_thresholds) {
    merged.dxloop.thresholds.p0.evidence_missing_rate_max =
      1.0 - baselineConfig.evidence_quality.alert_thresholds.evidence_presence_rate_min;
  }

  if (baselineConfig.hallucination_detection?.alert_thresholds) {
    merged.dxloop.thresholds.p0.hallucination_rate_max =
      baselineConfig.hallucination_detection.alert_thresholds.hallucination_rate_max;
  }

  if (baselineConfig.pii_license_scan?.alert_thresholds) {
    merged.dxloop.thresholds.p0.pii_hits_max =
      baselineConfig.pii_license_scan.alert_thresholds.pii_hits_max;
    merged.dxloop.thresholds.p0.license_violations_max =
      baselineConfig.pii_license_scan.alert_thresholds.license_risk_hits_max;
  }

  if (baselineConfig.cost_latency?.alert_thresholds) {
    merged.dxloop.thresholds.p1.cost_per_item_warn =
      baselineConfig.cost_latency.alert_thresholds.cost_per_item_max * 0.7;
    merged.dxloop.thresholds.p1.cost_per_item_fail =
      baselineConfig.cost_latency.alert_thresholds.cost_per_item_max;
    merged.dxloop.thresholds.p1.latency_p95_warn_ms =
      baselineConfig.cost_latency.alert_thresholds.latency_p95_max_ms * 0.8;
    merged.dxloop.thresholds.p1.latency_p95_fail_ms =
      baselineConfig.cost_latency.alert_thresholds.latency_p95_max_ms;
  }

  return merged;
}

/**
 * Load thresholds for specific profile
 */
export async function loadThresholds(
  profile: string = 'dev',
  configPath: string = 'baseline_config.json'
): Promise<{ config: DxLoopConfig; profile_config: DxProfile; merged_config: any }> {
  try {
    console.log(`Loading thresholds for profile: ${profile}`);

    // Load existing baseline config
    const baselineConfig = await loadBaselineConfig(configPath);

    // Start with default configuration
    let dxConfig = { ...DEFAULT_DXLOOP_CONFIG };

    // Override with existing DxLoop config if present
    if (baselineConfig.dxloop) {
      dxConfig = {
        ...dxConfig,
        ...baselineConfig.dxloop,
        profiles: { ...dxConfig.profiles, ...baselineConfig.dxloop.profiles },
        thresholds: {
          p0: { ...dxConfig.thresholds.p0, ...baselineConfig.dxloop.thresholds?.p0 },
          p1: { ...dxConfig.thresholds.p1, ...baselineConfig.dxloop.thresholds?.p1 },
          p2: { ...dxConfig.thresholds.p2, ...baselineConfig.dxloop.thresholds?.p2 }
        }
      };
    }

    // Get profile-specific configuration
    const profileConfig = dxConfig.profiles[profile as keyof typeof dxConfig.profiles];
    if (!profileConfig) {
      throw new Error(`Unknown profile: ${profile}. Available: ${Object.keys(dxConfig.profiles).join(', ')}`);
    }

    // Merge with baseline config
    const mergedConfig = mergeDxLoopConfig(baselineConfig, dxConfig);

    console.log('Thresholds loaded successfully:', {
      profile,
      autocalibration_enabled: dxConfig.autocalibration.enabled,
      p0_thresholds: Object.keys(dxConfig.thresholds.p0).length,
      p1_thresholds: Object.keys(dxConfig.thresholds.p1).length,
      p2_thresholds: Object.keys(dxConfig.thresholds.p2).length
    });

    return {
      config: dxConfig,
      profile_config: profileConfig,
      merged_config: mergedConfig
    };

  } catch (error) {
    console.error('Error loading thresholds:', error);
    throw error;
  }
}

/**
 * Save updated configuration back to baseline_config.json
 */
export async function saveThresholds(
  mergedConfig: any,
  configPath: string = 'baseline_config.json'
): Promise<void> {
  try {
    console.log('Saving updated configuration...');

    // Create backup
    const backupPath = `${configPath}.backup.${Date.now()}`;
    try {
      await fs.copyFile(configPath, backupPath);
      console.log(`Backup created: ${backupPath}`);
    } catch {
      console.warn('Could not create backup (file may not exist)');
    }

    // Write updated configuration
    const content = JSON.stringify(mergedConfig, null, 2);
    await fs.writeFile(configPath, content, 'utf-8');

    console.log(`Configuration saved to: ${configPath}`);

  } catch (error) {
    console.error('Error saving thresholds:', error);
    throw error;
  }
}

/**
 * CLI interface for threshold loading
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const profile = process.argv[3] || 'dev';
  const configPath = process.argv[4] || 'baseline_config.json';

  if (command === 'load') {
    loadThresholds(profile, configPath)
      .then((result) => {
        console.log('Threshold Loading Result:');
        console.log(JSON.stringify({
          profile: result.profile_config,
          thresholds: result.config.thresholds,
          autocalibration: result.config.autocalibration
        }, null, 2));
      })
      .catch((error) => {
        console.error('Threshold loading failed:', error);
        process.exit(1);
      });
  } else if (command === 'init') {
    // Initialize with default DxLoop configuration
    loadBaselineConfig(configPath)
      .then((baselineConfig) => {
        const mergedConfig = mergeDxLoopConfig(baselineConfig, DEFAULT_DXLOOP_CONFIG);
        return saveThresholds(mergedConfig, configPath);
      })
      .then(() => {
        console.log('DxLoop configuration initialized successfully');
      })
      .catch((error) => {
        console.error('Initialization failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  node load_thresholds.js load [profile] [config_path]');
    console.log('  node load_thresholds.js init [config_path]');
    process.exit(1);
  }
}