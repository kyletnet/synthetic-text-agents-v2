/**
 * Unit Tests: Audit Summary Generator
 *
 * Tests trust digest generation and aggregation
 */

import { describe, it, expect } from 'vitest';
import {
  AuditSummaryGenerator,
  createAuditSummaryGenerator,
  type AuditDataSources,
} from '../../src/application/audit/audit-summary-generator';
import type { ComplianceResult } from '../../src/application/compliance/compliance-engine';
import type { GateRResult } from '../../src/domain/preflight/gate-r-regulatory-compliance';

describe('AuditSummaryGenerator', () => {
  const createMockDataSources = (): AuditDataSources => ({
    complianceReports: [
      {
        compliant: true,
        score: 0.96,
        framework: 'GDPR',
        totalRules: 10,
        passedRules: 10,
        failedRules: 0,
        criticalViolations: 0,
        highViolations: 0,
        violations: [],
        recommendations: [],
        timestamp: new Date(),
        executionTime: 150,
      },
      {
        compliant: true,
        score: 0.94,
        framework: 'HIPAA',
        totalRules: 8,
        passedRules: 8,
        failedRules: 0,
        criticalViolations: 0,
        highViolations: 0,
        violations: [],
        recommendations: [],
        timestamp: new Date(),
        executionTime: 120,
      },
    ],
    gateRResults: [
      {
        passed: true,
        score: 0.96,
        action: 'allow',
        message: 'GDPR compliance passed',
        details: {
          framework: 'GDPR',
          complianceResult: {} as ComplianceResult,
          criticalViolations: 0,
          highViolations: 0,
        },
      },
      {
        passed: true,
        score: 0.94,
        action: 'allow',
        message: 'HIPAA compliance passed',
        details: {
          framework: 'HIPAA',
          complianceResult: {} as ComplianceResult,
          criticalViolations: 0,
          highViolations: 0,
        },
      },
    ],
    trustMetrics: {
      evidenceCount: 500,
      trustTokenCount: 100,
      provenanceRecordCount: 250,
    },
    performanceMetrics: {
      latencies: [100, 150, 200, 180, 220, 160, 190, 210, 170, 185],
      errors: 2,
      totalRequests: 100,
    },
  });

  describe('Summary Generation', () => {
    it('should generate complete audit summary', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      const summary = await generator.generate(sources, period);

      expect(summary.generatedAt).toBeInstanceOf(Date);
      expect(summary.period.start).toEqual(period.start);
      expect(summary.period.end).toEqual(period.end);
      expect(summary.version).toBe('1.0.0');
    });

    it('should calculate overall trust score correctly', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.overallTrustScore).toBeGreaterThan(0);
      expect(summary.overallTrustScore).toBeLessThanOrEqual(1);
    });

    it('should determine system status', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(['healthy', 'warning', 'critical']).toContain(
        summary.systemStatus
      );
    });

    it('should provide deployment recommendation', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(['approved', 'conditional', 'blocked']).toContain(
        summary.deploymentRecommendation
      );
    });
  });

  describe('Compliance Aggregation', () => {
    it('should aggregate multiple compliance reports', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.compliance.frameworks).toContain('GDPR');
      expect(summary.compliance.frameworks).toContain('HIPAA');
      expect(summary.compliance.totalFrameworks).toBe(2);
      expect(summary.compliance.passedFrameworks).toBe(2);
    });

    it('should calculate overall compliance score', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      // Average of GDPR (0.96) and HIPAA (0.94) = 0.95
      expect(summary.compliance.overallScore).toBeCloseTo(0.95, 2);
    });

    it('should aggregate violations by category', async () => {
      const generator = createAuditSummaryGenerator();
      const sourcesWithViolations = createMockDataSources();
      sourcesWithViolations.complianceReports[0].violations = [
        {
          ruleId: 'gdpr-1',
          category: 'data-protection',
          requirement: 'Data must be encrypted',
          severity: 'critical',
          message: 'Encryption not enabled',
        },
        {
          ruleId: 'gdpr-2',
          category: 'data-protection',
          requirement: 'Consent required',
          severity: 'high',
          message: 'Consent not obtained',
        },
      ];
      sourcesWithViolations.complianceReports[0].criticalViolations = 1;

      const period = { start: new Date(), end: new Date() };
      const summary = await generator.generate(sourcesWithViolations, period);

      expect(summary.compliance.criticalViolations).toBe(1);
      expect(summary.compliance.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Gating Summary', () => {
    it('should aggregate gating results', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.trust.gatingResults.totalGates).toBe(2);
      expect(summary.trust.gatingResults.passedGates).toBe(2);
      expect(summary.trust.gatingResults.failedGates).toBe(0);
    });

    it('should include individual gate results', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.trust.gatingResults.gateResults['Gate-R-GDPR']).toBeDefined();
      expect(summary.trust.gatingResults.gateResults['Gate-R-HIPAA']).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate average latency', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.performance.averageLatency).toBeGreaterThan(0);
    });

    it('should calculate p95 latency', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.performance.p95Latency).toBeGreaterThan(
        summary.performance.averageLatency
      );
    });

    it('should calculate error rate', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      // 2 errors / 100 total = 0.02
      expect(summary.performance.errorRate).toBe(0.02);
      expect(summary.performance.uptime).toBe(0.98);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for violations', async () => {
      const generator = createAuditSummaryGenerator({
        enableRecommendations: true,
      });
      const sourcesWithViolations = createMockDataSources();
      sourcesWithViolations.complianceReports[0].violations = [
        {
          ruleId: 'test-1',
          category: 'data-protection',
          requirement: 'Test requirement',
          severity: 'critical',
          message: 'Test violation',
        },
      ];
      sourcesWithViolations.complianceReports[0].criticalViolations = 1;

      const period = { start: new Date(), end: new Date() };
      const summary = await generator.generate(sourcesWithViolations, period);

      expect(summary.recommendations.length).toBeGreaterThan(0);
      expect(summary.recommendations.some((r) => r.includes('URGENT'))).toBe(
        true
      );
    });

    it('should not generate recommendations if disabled', async () => {
      const generator = createAuditSummaryGenerator({
        enableRecommendations: false,
      });
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.recommendations.length).toBe(0);
    });
  });

  describe('Action Items', () => {
    it('should create action items for critical violations', async () => {
      const generator = createAuditSummaryGenerator();
      const sourcesWithViolations = createMockDataSources();
      sourcesWithViolations.complianceReports[0].violations = [
        {
          ruleId: 'test-1',
          category: 'data-protection',
          requirement: 'Critical requirement',
          severity: 'critical',
          message: 'Critical violation',
        },
      ];
      sourcesWithViolations.complianceReports[0].criticalViolations = 1;

      const period = { start: new Date(), end: new Date() };
      const summary = await generator.generate(sourcesWithViolations, period);

      expect(summary.actionItems.length).toBeGreaterThan(0);
      const criticalItem = summary.actionItems.find(
        (item) => item.priority === 'critical'
      );
      expect(criticalItem).toBeDefined();
      expect(criticalItem?.deadline).toBeInstanceOf(Date);
    });

    it('should create action items for failed gates', async () => {
      const generator = createAuditSummaryGenerator();
      const sourcesWithFailures = createMockDataSources();
      sourcesWithFailures.gateRResults[0].passed = false;
      sourcesWithFailures.gateRResults[0].action = 'block';

      const period = { start: new Date(), end: new Date() };
      const summary = await generator.generate(sourcesWithFailures, period);

      const gateItem = summary.actionItems.find(
        (item) => item.category === 'gating'
      );
      expect(gateItem).toBeDefined();
      expect(gateItem?.priority).toBe('high');
    });
  });

  describe('System Status Determination', () => {
    it('should mark as healthy with high trust score', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.systemStatus).toBe('healthy');
    });

    it('should mark as critical with violations', async () => {
      const generator = createAuditSummaryGenerator();
      const sourcesWithViolations = createMockDataSources();
      sourcesWithViolations.complianceReports[0].violations = [
        {
          ruleId: 'test-1',
          category: 'data-protection',
          requirement: 'Test requirement',
          severity: 'critical',
          message: 'Critical violation',
        },
      ];
      sourcesWithViolations.complianceReports[0].criticalViolations = 1;

      const period = { start: new Date(), end: new Date() };
      const summary = await generator.generate(sourcesWithViolations, period);

      expect(summary.systemStatus).toBe('critical');
    });
  });

  describe('Deployment Recommendation', () => {
    it('should approve deployment with healthy system', async () => {
      const generator = createAuditSummaryGenerator();
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      expect(summary.deploymentRecommendation).toBe('approved');
    });

    it('should block deployment with critical violations', async () => {
      const generator = createAuditSummaryGenerator();
      const sourcesWithViolations = createMockDataSources();
      sourcesWithViolations.complianceReports[0].criticalViolations = 1;

      const period = { start: new Date(), end: new Date() };
      const summary = await generator.generate(sourcesWithViolations, period);

      expect(summary.deploymentRecommendation).toBe('blocked');
    });

    it('should conditionally approve with failed gates', async () => {
      const generator = createAuditSummaryGenerator();
      const sourcesWithFailures = createMockDataSources();
      sourcesWithFailures.gateRResults[0].passed = false;
      sourcesWithFailures.gateRResults[0].action = 'warn';

      const period = { start: new Date(), end: new Date() };
      const summary = await generator.generate(sourcesWithFailures, period);

      expect(summary.deploymentRecommendation).toBe('conditional');
    });
  });

  describe('File I/O', () => {
    it('should save summary to file', async () => {
      const generator = createAuditSummaryGenerator({
        outputPath: '/tmp/test-audit-summary.json',
      });
      const sources = createMockDataSources();
      const period = { start: new Date(), end: new Date() };

      const summary = await generator.generate(sources, period);

      // Just test that save doesn't throw
      await expect(generator.save(summary)).resolves.not.toThrow();
    });
  });
});
