/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * DEPRECATED: Legacy re-export for backward compatibility
 * Please use src/application/metrics/threshold-manager-service.ts instead
 *
 * This file will be removed in a future version.
 */

export {
  ThresholdManagerService as ThresholdManager,
  createThresholdManagerService as createThresholdManager,
  type ProfileConfig,
  type AutoCalibrationConfig,
  type HistoricalMetrics,
} from "../../application/metrics/threshold-manager-service.js";

export {
  type P0Thresholds,
  type P1Thresholds,
  type P2Thresholds,
  type ThresholdViolation,
  type GatingResult,
  type CalibrationResult,
} from "../../domain/metrics/threshold-rules.js";

// Additional helper function for backward compatibility
import { ThresholdManagerService } from "../../application/metrics/threshold-manager-service.js";
import {
  type P0Thresholds,
  type P1Thresholds,
  type P2Thresholds,
} from "../../domain/metrics/threshold-rules.js";

export interface ThresholdConfig {
  p0: P0Thresholds;
  p1: P1Thresholds;
  p2: P2Thresholds;
}

export function getAllThresholds(
  profile: string = "dev",
  configPath?: string,
): ThresholdConfig {
  const manager = new ThresholdManagerService(configPath);
  return {
    p0: manager.getP0Thresholds(),
    p1: manager.getP1Thresholds(profile),
    p2: manager.getP2Thresholds(profile),
  };
}
