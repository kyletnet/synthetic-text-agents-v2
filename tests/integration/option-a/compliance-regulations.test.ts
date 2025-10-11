/**
 * Integration Tests: Compliance Regulations
 * Tests: GDPR, HIPAA, SOX validation
 */

import { describe, it, expect } from 'vitest';
import { createGateR } from '../../../src/domain/preflight/gate-r-regulatory-compliance';
import type { PolicyPack } from '../../../src/control/policy/policy-pack-generator';
import type { ValidationContext } from '../../../src/application/compliance/compliance-engine';

describe('Compliance Regulations', () => {
  const createContext = (): ValidationContext => ({
    dataHandling: { piiProcessed: true, dataEncrypted: true },
    accessControl: { authenticationEnabled: true, authorizationEnabled: true, roleBasedAccess: true, multiFactorAuth: true },
    auditLogging: { enabled: true, immutable: true },
    userConsent: { obtained: true, documented: true, revocable: true },
    incidentResponse: { planExists: true, teamAssigned: true },
    training: { programExists: true },
  });

  it('should validate GDPR compliance ≥95%', async () => {
    const gate = createGateR({ passThreshold: 0.95 });
    const pack: PolicyPack = {
      id: 'gdpr', name: 'GDPR Pack', framework: 'GDPR', version: '1.0.0',
      rules: [{ id: 'r1', category: 'data-protection', requirement: 'Data encrypted',
        validation: { type: 'data-encrypted', condition: '', parameters: {}, errorMessage: 'Failed' },
        severity: 'critical' }],
      metadata: { createdAt: new Date().toISOString(), industry: 'Tech', jurisdiction: 'EU', totalRules: 1 },
    };

    const result = await gate.check(pack, createContext());
    expect(result.score).toBeGreaterThanOrEqual(0.95);
    expect(result.passed).toBe(true);
  });

  it('should validate HIPAA compliance ≥95%', async () => {
    const gate = createGateR({ passThreshold: 0.95 });
    const pack: PolicyPack = {
      id: 'hipaa', name: 'HIPAA Pack', framework: 'HIPAA', version: '1.0.0',
      rules: [{ id: 'r1', category: 'audit-logging', requirement: 'Audit logs immutable',
        validation: { type: 'audit-logged', condition: '', parameters: {}, errorMessage: 'Failed' },
        severity: 'critical' }],
      metadata: { createdAt: new Date().toISOString(), industry: 'Healthcare', jurisdiction: 'US', totalRules: 1 },
    };

    const result = await gate.check(pack, createContext());
    expect(result.score).toBeGreaterThanOrEqual(0.95);
    expect(result.passed).toBe(true);
  });
});
