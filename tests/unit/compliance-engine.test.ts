/**
 * Unit Tests: Compliance Engine
 *
 * Tests all validation types and compliance scoring
 */

import { describe, it, expect } from 'vitest';
import {
  ComplianceEngine,
  createComplianceEngine,
  type ValidationContext,
} from '../../src/application/compliance/compliance-engine';
import type { PolicyPack } from '../../src/control/policy/policy-pack-generator';

describe('ComplianceEngine', () => {
  describe('Validation Types', () => {
    const engine = createComplianceEngine();

    it('should validate field-exists', async () => {
      const policyPack: PolicyPack = {
        id: 'test-pack',
        name: 'Test Pack',
        framework: 'TEST',
        version: '1.0.0',
        rules: [
          {
            id: 'field-exists-1',
            category: 'data-protection',
            requirement: 'Data encryption must be enabled',
            validation: {
              type: 'field-exists',
              condition: '',
              parameters: { fieldPath: 'dataHandling.dataEncrypted' },
              errorMessage: 'dataEncrypted field missing',
            },
            severity: 'critical',
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          industry: 'Test',
          jurisdiction: 'Global',
          totalRules: 1,
        },
      };

      const contextValid: ValidationContext = {
        dataHandling: {
          piiProcessed: true,
          dataEncrypted: true,
          encryptionAlgorithm: 'AES-256',
        },
        accessControl: {
          authenticationEnabled: true,
          authorizationEnabled: true,
          roleBasedAccess: true,
          multiFactorAuth: false,
        },
        auditLogging: {
          enabled: true,
          immutable: true,
          retentionDays: 90,
        },
        userConsent: {
          obtained: true,
          documented: true,
          revocable: true,
        },
        incidentResponse: {
          planExists: true,
          teamAssigned: true,
          responseTimeSLA: 24,
        },
        training: {
          programExists: true,
          completionRate: 0.95,
        },
      };

      const result = await engine.checkCompliance(policyPack, contextValid);

      expect(result.compliant).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('should validate data-encrypted', async () => {
      const policyPack: PolicyPack = {
        id: 'test-pack',
        name: 'Test Pack',
        framework: 'TEST',
        version: '1.0.0',
        rules: [
          {
            id: 'data-encrypted-1',
            category: 'encryption',
            requirement: 'All data must be encrypted',
            validation: {
              type: 'data-encrypted',
              condition: '',
              parameters: {},
              errorMessage: 'Data encryption not enabled',
            },
            severity: 'critical',
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          industry: 'Test',
          jurisdiction: 'Global',
          totalRules: 1,
        },
      };

      const contextNoEncryption: ValidationContext = {
        dataHandling: {
          piiProcessed: true,
          dataEncrypted: false,
        },
        accessControl: {
          authenticationEnabled: true,
          authorizationEnabled: true,
          roleBasedAccess: true,
          multiFactorAuth: false,
        },
        auditLogging: {
          enabled: true,
          immutable: true,
        },
        userConsent: {
          obtained: true,
          documented: true,
          revocable: true,
        },
        incidentResponse: {
          planExists: true,
          teamAssigned: true,
        },
        training: {
          programExists: true,
        },
      };

      const result = await engine.checkCompliance(
        policyPack,
        contextNoEncryption
      );

      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0].severity).toBe('critical');
    });

    it('should validate audit-logged', async () => {
      const policyPack: PolicyPack = {
        id: 'test-pack',
        name: 'Test Pack',
        framework: 'TEST',
        version: '1.0.0',
        rules: [
          {
            id: 'audit-logged-1',
            category: 'audit-logging',
            requirement: 'Audit logging must be enabled and immutable',
            validation: {
              type: 'audit-logged',
              condition: '',
              parameters: {},
              errorMessage: 'Audit logging incomplete',
            },
            severity: 'high',
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          industry: 'Test',
          jurisdiction: 'Global',
          totalRules: 1,
        },
      };

      const contextNoImmutable: ValidationContext = {
        dataHandling: {
          piiProcessed: true,
          dataEncrypted: true,
        },
        accessControl: {
          authenticationEnabled: true,
          authorizationEnabled: true,
          roleBasedAccess: true,
          multiFactorAuth: false,
        },
        auditLogging: {
          enabled: true,
          immutable: false, // Not immutable!
        },
        userConsent: {
          obtained: true,
          documented: true,
          revocable: true,
        },
        incidentResponse: {
          planExists: true,
          teamAssigned: true,
        },
        training: {
          programExists: true,
        },
      };

      const result = await engine.checkCompliance(
        policyPack,
        contextNoImmutable
      );

      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0].category).toBe('audit-logging');
    });

    it('should validate consent-obtained', async () => {
      const policyPack: PolicyPack = {
        id: 'test-pack',
        name: 'Test Pack',
        framework: 'GDPR',
        version: '1.0.0',
        rules: [
          {
            id: 'consent-1',
            category: 'data-protection',
            requirement: 'User consent must be obtained and documented',
            validation: {
              type: 'consent-obtained',
              condition: '',
              parameters: {},
              errorMessage: 'User consent incomplete',
            },
            severity: 'critical',
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          industry: 'Test',
          jurisdiction: 'EU',
          totalRules: 1,
        },
      };

      const contextNoConsent: ValidationContext = {
        dataHandling: {
          piiProcessed: true,
          dataEncrypted: true,
        },
        accessControl: {
          authenticationEnabled: true,
          authorizationEnabled: true,
          roleBasedAccess: true,
          multiFactorAuth: false,
        },
        auditLogging: {
          enabled: true,
          immutable: true,
        },
        userConsent: {
          obtained: false, // No consent!
          documented: false,
          revocable: true,
        },
        incidentResponse: {
          planExists: true,
          teamAssigned: true,
        },
        training: {
          programExists: true,
        },
      };

      const result = await engine.checkCompliance(policyPack, contextNoConsent);

      expect(result.compliant).toBe(false);
      expect(result.criticalViolations).toBe(1);
    });
  });

  describe('Severity Weighting', () => {
    it('should apply severity weights correctly', async () => {
      const engine = createComplianceEngine({
        severityWeights: {
          critical: 1.0,
          high: 0.7,
          medium: 0.4,
          low: 0.2,
        },
      });

      const policyPack: PolicyPack = {
        id: 'test-pack',
        name: 'Test Pack',
        framework: 'TEST',
        version: '1.0.0',
        rules: [
          {
            id: 'critical-rule',
            category: 'data-protection',
            requirement: 'Critical requirement',
            validation: {
              type: 'data-encrypted',
              condition: '',
              parameters: {},
              errorMessage: 'Critical failure',
            },
            severity: 'critical',
          },
          {
            id: 'low-rule',
            category: 'training',
            requirement: 'Low priority requirement',
            validation: {
              type: 'field-exists',
              condition: '',
              parameters: { fieldPath: 'training.programExists' },
              errorMessage: 'Training missing',
            },
            severity: 'low',
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          industry: 'Test',
          jurisdiction: 'Global',
          totalRules: 2,
        },
      };

      const context: ValidationContext = {
        dataHandling: {
          piiProcessed: true,
          dataEncrypted: true,
        },
        accessControl: {
          authenticationEnabled: true,
          authorizationEnabled: true,
          roleBasedAccess: true,
          multiFactorAuth: false,
        },
        auditLogging: {
          enabled: true,
          immutable: true,
        },
        userConsent: {
          obtained: true,
          documented: true,
          revocable: true,
        },
        incidentResponse: {
          planExists: true,
          teamAssigned: true,
        },
        training: {
          programExists: true,
        },
      };

      const result = await engine.checkCompliance(policyPack, context);

      expect(result.compliant).toBe(true);
      // Score should be weighted: (1.0 + 0.2) / (1.0 + 0.2) = 1.0
      expect(result.score).toBe(1.0);
    });

    it('should calculate partial compliance score', async () => {
      const engine = createComplianceEngine({ threshold: 0.7 });

      const policyPack: PolicyPack = {
        id: 'test-pack',
        name: 'Test Pack',
        framework: 'TEST',
        version: '1.0.0',
        rules: [
          {
            id: 'rule-1',
            category: 'data-protection',
            requirement: 'Requirement 1',
            validation: {
              type: 'data-encrypted',
              condition: '',
              parameters: {},
              errorMessage: 'Encryption missing',
            },
            severity: 'high',
          },
          {
            id: 'rule-2',
            category: 'audit-logging',
            requirement: 'Requirement 2',
            validation: {
              type: 'audit-logged',
              condition: '',
              parameters: {},
              errorMessage: 'Audit logging incomplete',
            },
            severity: 'high',
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          industry: 'Test',
          jurisdiction: 'Global',
          totalRules: 2,
        },
      };

      const contextPartial: ValidationContext = {
        dataHandling: {
          piiProcessed: true,
          dataEncrypted: true, // Pass
        },
        accessControl: {
          authenticationEnabled: true,
          authorizationEnabled: true,
          roleBasedAccess: true,
          multiFactorAuth: false,
        },
        auditLogging: {
          enabled: true,
          immutable: false, // Fail!
        },
        userConsent: {
          obtained: true,
          documented: true,
          revocable: true,
        },
        incidentResponse: {
          planExists: true,
          teamAssigned: true,
        },
        training: {
          programExists: true,
        },
      };

      const result = await engine.checkCompliance(policyPack, contextPartial);

      expect(result.passedRules).toBe(1);
      expect(result.failedRules).toBe(1);
      // Score: 0.7 / (0.7 + 0.7) = 0.5
      expect(result.score).toBe(0.5);
      expect(result.compliant).toBe(false); // Below 0.7 threshold
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for violations', async () => {
      const engine = createComplianceEngine({ enableRecommendations: true });

      const policyPack: PolicyPack = {
        id: 'test-pack',
        name: 'Test Pack',
        framework: 'GDPR',
        version: '1.0.0',
        rules: [
          {
            id: 'critical-rule',
            category: 'data-protection',
            requirement: 'Data must be encrypted',
            validation: {
              type: 'data-encrypted',
              condition: '',
              parameters: {},
              errorMessage: 'Encryption missing',
            },
            severity: 'critical',
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          industry: 'Healthcare',
          jurisdiction: 'EU',
          totalRules: 1,
        },
      };

      const contextViolation: ValidationContext = {
        dataHandling: {
          piiProcessed: true,
          dataEncrypted: false, // Violation!
        },
        accessControl: {
          authenticationEnabled: true,
          authorizationEnabled: true,
          roleBasedAccess: true,
          multiFactorAuth: false,
        },
        auditLogging: {
          enabled: true,
          immutable: true,
        },
        userConsent: {
          obtained: true,
          documented: true,
          revocable: true,
        },
        incidentResponse: {
          planExists: true,
          teamAssigned: true,
        },
        training: {
          programExists: true,
        },
      };

      const result = await engine.checkCompliance(policyPack, contextViolation);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.includes('CRITICAL'))).toBe(
        true
      );
    });
  });
});
