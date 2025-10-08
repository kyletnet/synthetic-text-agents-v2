/**
 * Metrics Drift Detector Tests
 *
 * Tests for Phase 2B Step 3: Metrics Drift Detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MetricsDriftDetector } from "../../src/application/metrics-drift-detector.js";
import type { MetricsReport } from "../../src/domain/ports/metrics-port.js";
import type { Logger } from "../../src/shared/logger.js";
import { existsSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";

// Mock logger
const mockLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as any;

// Test data
const createMetricsReport = (
  entityCoverage: number,
  evidenceAlignment: number,
  entityCoverageRatio: number,
  questionTypeBalance: number,
): MetricsReport => ({
  quality: {
    entityCoverage,
    questionTypeDistribution: new Map(),
    evidenceAlignment,
    evidenceSourceCounts: new Map(),
    naturalness: 0.8,
    coherence: 0.7,
    totalSamples: 100,
    timestamp: new Date(),
  },
  diversity: {
    entityCoverageRatio,
    questionTypeBalance,
    evidenceSourceDiversity: 0.9,
    meetsTarget: true,
    timestamp: new Date(),
  },
  timestamp: new Date(),
});

describe("MetricsDriftDetector", () => {
  let driftDetector: MetricsDriftDetector;
  const testReportPath = join(
    process.cwd(),
    "reports",
    "test-metrics-drift.json",
  );

  beforeEach(() => {
    // Ensure reports directory exists
    const reportsDir = join(process.cwd(), "reports");
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    driftDetector = new MetricsDriftDetector(mockLogger, process.cwd(), {
      driftThreshold: 0.15,
      baselineTag: "test-baseline",
      driftReportPath: testReportPath,
      rollingWindowSize: 3,
      stableThreshold: 0.05,
    });
  });

  afterEach(() => {
    // Cleanup test report file
    if (existsSync(testReportPath)) {
      unlinkSync(testReportPath);
    }
  });

  describe("Drift Detection", () => {
    it("should detect drift exceeding threshold", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95); // +20%, +33%, +28%, +18%

      const report = await driftDetector.detectDrift(current, baseline);

      expect(report.drift_detected.length).toBe(4);
      const exceededDrifts = report.drift_detected.filter((d) => d.exceeded);
      expect(exceededDrifts.length).toBeGreaterThan(0);
    });

    it("should not detect drift below threshold", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.55, 0.63, 0.73, 0.84); // +10%, +5%, +4.3%, +5%

      const report = await driftDetector.detectDrift(current, baseline);

      expect(report.drift_detected.length).toBe(4);
      const exceededDrifts = report.drift_detected.filter((d) => d.exceeded);
      expect(exceededDrifts.length).toBe(0);
    });

    it("should identify improvement direction", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95);

      const report = await driftDetector.detectDrift(current, baseline);

      const entityCoverageDrift = report.drift_detected.find(
        (d) => d.metric === "entity_coverage",
      );

      expect(entityCoverageDrift).toBeDefined();
      expect(entityCoverageDrift?.direction).toBe("improvement");
    });

    it("should identify degradation direction", async () => {
      const baseline = createMetricsReport(0.8, 0.7, 0.9, 0.85);
      const current = createMetricsReport(0.6, 0.5, 0.7, 0.65);

      const report = await driftDetector.detectDrift(current, baseline);

      const entityCoverageDrift = report.drift_detected.find(
        (d) => d.metric === "entity_coverage",
      );

      expect(entityCoverageDrift).toBeDefined();
      expect(entityCoverageDrift?.direction).toBe("degradation");
    });

    it("should mark stable when drift is below stable threshold", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.51, 0.61, 0.71, 0.81); // +2% each

      const report = await driftDetector.detectDrift(current, baseline);

      const stableDrifts = report.drift_detected.filter(
        (d) => d.direction === "stable",
      );
      expect(stableDrifts.length).toBeGreaterThan(0);
    });
  });

  describe("Rolling Average (Noise Filtering)", () => {
    it("should use rolling average for drift calculation", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);

      // First detection: +0.2
      const current1 = createMetricsReport(0.7, 0.8, 0.9, 1.0);
      const report1 = await driftDetector.detectDrift(current1, baseline);

      // Rolling average should be based on single value
      const drift1 = report1.drift_detected.find(
        (d) => d.metric === "entity_coverage",
      );
      expect(drift1?.drift).toBeCloseTo(0.2, 2);

      // Second detection: +0.1
      const current2 = createMetricsReport(0.6, 0.7, 0.8, 0.9);
      const report2 = await driftDetector.detectDrift(current2, baseline);

      // Rolling average should be (0.2 + 0.1) / 2 = 0.15
      const drift2 = report2.drift_detected.find(
        (d) => d.metric === "entity_coverage",
      );
      expect(drift2?.drift).toBeCloseTo(0.15, 2);

      // Third detection: +0.05
      const current3 = createMetricsReport(0.55, 0.65, 0.75, 0.85);
      const report3 = await driftDetector.detectDrift(current3, baseline);

      // Rolling average should be (0.2 + 0.1 + 0.05) / 3 = 0.1167
      const drift3 = report3.drift_detected.find(
        (d) => d.metric === "entity_coverage",
      );
      expect(drift3?.drift).toBeCloseTo(0.1167, 2);
    });

    it("should limit rolling window to configured size", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);

      // Run 4 detections (window size is 3)
      for (let i = 0; i < 4; i++) {
        const current = createMetricsReport(0.6, 0.7, 0.8, 0.9);
        await driftDetector.detectDrift(current, baseline);
      }

      // Fifth detection
      const current5 = createMetricsReport(0.7, 0.8, 0.9, 1.0);
      const report5 = await driftDetector.detectDrift(current5, baseline);

      // Rolling average should only include last 3 values
      // (0.1 + 0.1 + 0.2) / 3 = 0.1333
      const drift5 = report5.drift_detected.find(
        (d) => d.metric === "entity_coverage",
      );
      expect(drift5?.drift).toBeCloseTo(0.1333, 2);
    });
  });

  describe("Auto Actions", () => {
    it("should generate alert action for degradation exceeding threshold", async () => {
      const baseline = createMetricsReport(0.8, 0.7, 0.9, 0.85);
      const current = createMetricsReport(0.6, 0.5, 0.7, 0.65); // Degradation > 15%

      const report = await driftDetector.detectDrift(current, baseline);

      expect(report.auto_actions.length).toBeGreaterThan(0);
      const alertAction = report.auto_actions.find((a) =>
        a.includes("degraded"),
      );
      expect(alertAction).toBeDefined();
    });

    it("should not generate alert for improvement", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95); // Improvement

      const report = await driftDetector.detectDrift(current, baseline);

      // Should log improvement but not create alert action
      const degradationActions = report.auto_actions.filter((a) =>
        a.includes("Alert"),
      );
      expect(degradationActions.length).toBe(0);
    });
  });

  describe("Report Persistence", () => {
    it("should save drift report to file", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95);

      await driftDetector.detectDrift(current, baseline);

      expect(existsSync(testReportPath)).toBe(true);
    });

    it("should load existing drift report", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95);

      await driftDetector.detectDrift(current, baseline);

      const loadedReport = await driftDetector.loadDriftReport();

      expect(loadedReport).not.toBeNull();
      expect(loadedReport?.baseline_tag).toBe("test-baseline");
      expect(loadedReport?.drift_detected.length).toBe(4);
    });

    it("should return null when report file does not exist", async () => {
      const loadedReport = await driftDetector.loadDriftReport();

      expect(loadedReport).toBeNull();
    });
  });

  describe("Drift Summary", () => {
    it("should calculate drift summary correctly", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95);

      const report = await driftDetector.detectDrift(current, baseline);
      const summary = await driftDetector.getDriftSummary(report);

      expect(summary.hasDrift).toBe(true);
      expect(summary.improvementCount).toBeGreaterThan(0);
      expect(summary.degradationCount).toBe(0);
      expect(summary.maxDrift).toBeGreaterThan(0);
    });

    it("should identify no drift when below threshold", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.55, 0.63, 0.73, 0.84);

      const report = await driftDetector.detectDrift(current, baseline);
      const summary = await driftDetector.getDriftSummary(report);

      expect(summary.hasDrift).toBe(false);
      expect(summary.improvementCount).toBe(0);
      expect(summary.degradationCount).toBe(0);
    });
  });

  describe("Drift History Management", () => {
    it("should clear drift history", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);

      // Run multiple detections to build history
      for (let i = 0; i < 3; i++) {
        const current = createMetricsReport(0.6, 0.7, 0.8, 0.9);
        await driftDetector.detectDrift(current, baseline);
      }

      // Clear history
      driftDetector.clearDriftHistory();

      // Next detection should start fresh
      const current = createMetricsReport(0.7, 0.8, 0.9, 1.0);
      const report = await driftDetector.detectDrift(current, baseline);

      // Drift should be calculated without rolling average
      const drift = report.drift_detected.find(
        (d) => d.metric === "entity_coverage",
      );
      expect(drift?.drift).toBeCloseTo(0.2, 2); // Should be 0.2, not averaged
    });
  });

  describe("Metadata", () => {
    it("should include metadata in drift report", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95);

      const report = await driftDetector.detectDrift(current, baseline);

      expect(report.metadata).toBeDefined();
      expect(report.metadata?.total_drifts).toBeDefined();
      expect(report.metadata?.max_drift).toBeDefined();
    });

    it("should include schema version and timestamp", async () => {
      const baseline = createMetricsReport(0.5, 0.6, 0.7, 0.8);
      const current = createMetricsReport(0.7, 0.8, 0.9, 0.95);

      const report = await driftDetector.detectDrift(current, baseline);

      expect(report.schemaVersion).toBe("1.0.0");
      expect(report.timestamp).toBeDefined();
      expect(new Date(report.timestamp)).toBeInstanceOf(Date);
    });
  });
});
