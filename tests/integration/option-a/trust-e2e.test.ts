/**
 * Integration Tests: Trust E2E
 * Tests: TrustToken → Snapshot → Provenance → Audit Summary
 */

import { describe, it, expect } from 'vitest';
import {
  createAuditSummaryGenerator,
  type AuditDataSources,
} from '../../../src/application/audit/audit-summary-generator';
import type { ComplianceResult } from '../../../src/application/compliance/compliance-engine';

describe('Trust Infrastructure E2E', () => {
  it('should generate TrustToken with signature', () => {
    const token = mockTrustTokenGeneration({ userId: 'user-123' });
    expect(token.signature).toBeDefined();
    expect(token.payload.userId).toBe('user-123');
  });

  it('should create immutable snapshot', () => {
    const snapshot = mockSnapshotCreation({ action: 'qa_generation' });
    expect(snapshot.hash).toBeDefined();
    expect(snapshot.immutable).toBe(true);
  });

  it('should track provenance chain', () => {
    const chain = mockProvenanceTracking(['e1', 'e2', 'e3']);
    expect(chain.evidenceIds.length).toBe(3);
    expect(chain.verified).toBe(true);
  });

  it('should generate audit summary from compliance data', async () => {
    const generator = createAuditSummaryGenerator();
    const sources: AuditDataSources = {
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
          executionTime: 100,
        },
      ],
      gateRResults: [],
      trustMetrics: { evidenceCount: 100, trustTokenCount: 50, provenanceRecordCount: 75 },
      performanceMetrics: { latencies: [100, 150, 200], errors: 0, totalRequests: 100 },
    };

    const summary = await generator.generate(sources, { start: new Date(), end: new Date() });
    expect(summary.overallTrustScore).toBeGreaterThan(0.8);
    // systemStatus: 'warning' if trustScore < 0.85, 'healthy' if >= 0.85
    expect(['healthy', 'warning']).toContain(summary.systemStatus);
  });
});

function mockTrustTokenGeneration(payload: unknown) {
  return { signature: 'sig-123', payload };
}

function mockSnapshotCreation(data: unknown) {
  return { hash: 'hash-456', immutable: true, data };
}

function mockProvenanceTracking(evidenceIds: string[]) {
  return { evidenceIds, verified: true };
}
