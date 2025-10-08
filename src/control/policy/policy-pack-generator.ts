/**
 * Policy Pack DSL Generator (Phase 2.9)
 *
 * "규제를 DSL로 변환하면 자동 확장이 가능하다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Generate Policy Packs from regulatory frameworks
 * - Enable cross-industry compliance automation
 * - Support domain-specific customization
 *
 * Architecture:
 * Regulatory Framework (HIPAA/SOX/etc.) → **DSL Generator** → Generic Policy Pack → Runtime Enforcement
 *
 * Generation Strategy:
 * 1. Framework Analysis (identify requirements)
 * 2. Rule Extraction (extract compliance rules)
 * 3. DSL Generation (create generic representation)
 * 4. Validation (ensure completeness)
 *
 * Expected Gain: Compliance automation ≥95%, Cross-industry extensibility
 *
 * @see ChatGPT Master Directive: "Generic DSL > Framework-Specific"
 */

/**
 * Policy Pack (DSL representation)
 */
export interface PolicyPack {
  // Identification
  id: string;
  name: string;
  framework: string; // "HIPAA", "SOX", "GDPR", etc.
  version: string;

  // Rules
  rules: PolicyRule[];

  // Metadata
  metadata: {
    createdAt: string;
    industry: string;
    jurisdiction: string;
    totalRules: number;
  };
}

/**
 * Policy Rule
 */
export interface PolicyRule {
  id: string;
  category: PolicyCategory;
  requirement: string; // Natural language requirement
  validation: ValidationRule;
  severity: 'critical' | 'high' | 'medium' | 'low';
  citation?: string; // Legal reference
}

/**
 * Policy Categories
 */
export type PolicyCategory =
  | 'data-protection' // Data privacy/protection
  | 'access-control' // Access and authentication
  | 'audit-logging' // Audit trail requirements
  | 'encryption' // Encryption requirements
  | 'disclosure' // Disclosure requirements
  | 'retention' // Data retention
  | 'incident-response' // Incident response
  | 'training'; // Training requirements

/**
 * Validation Rule (executable check)
 */
export interface ValidationRule {
  type: ValidationType;
  condition: string; // JavaScript expression or query
  parameters?: Record<string, unknown>;
  errorMessage: string;
}

/**
 * Validation Types
 */
export type ValidationType =
  | 'field-exists' // Check if field exists
  | 'field-value' // Check field value
  | 'data-encrypted' // Check encryption
  | 'audit-logged' // Check audit log
  | 'access-controlled' // Check access control
  | 'consent-obtained' // Check user consent
  | 'retention-policy' // Check retention
  | 'custom'; // Custom validation

/**
 * Policy Pack Generator Config
 */
export interface PolicyPackGeneratorConfig {
  // Generation
  enableTemplates: boolean; // Use templates (default: true)
  strictMode: boolean; // Strict validation (default: true)

  // Customization
  enableCustomization: boolean; // Allow domain-specific customization
  customRules?: PolicyRule[]; // Additional custom rules
}

/**
 * Policy Pack Generator
 */
export class PolicyPackGenerator {
  private config: PolicyPackGeneratorConfig;

  constructor(config?: Partial<PolicyPackGeneratorConfig>) {
    this.config = {
      enableTemplates: config?.enableTemplates ?? true,
      strictMode: config?.strictMode ?? true,
      enableCustomization: config?.enableCustomization ?? true,
      customRules: config?.customRules || [],
    };
  }

  /**
   * Generate policy pack from framework
   *
   * Main entry point
   */
  async generate(
    framework: 'HIPAA' | 'SOX' | 'GDPR' | 'CCPA' | 'PCI-DSS',
    options?: {
      industry?: string;
      jurisdiction?: string;
      customRules?: PolicyRule[];
    }
  ): Promise<PolicyPack> {
    // 1. Load framework template
    const template = this.getFrameworkTemplate(framework);

    // 2. Generate rules
    const rules = [...template.rules];

    // 3. Add custom rules
    if (this.config.enableCustomization && options?.customRules) {
      rules.push(...options.customRules);
    }
    if (this.config.customRules) {
      rules.push(...this.config.customRules);
    }

    // 4. Validate
    if (this.config.strictMode) {
      this.validatePolicyPack(rules);
    }

    return {
      id: `policy_${framework.toLowerCase()}_${Date.now()}`,
      name: `${framework} Compliance Pack`,
      framework,
      version: '1.0.0',
      rules,
      metadata: {
        createdAt: new Date().toISOString(),
        industry: options?.industry || 'general',
        jurisdiction: options?.jurisdiction || 'US',
        totalRules: rules.length,
      },
    };
  }

  /**
   * Get framework template
   */
  private getFrameworkTemplate(
    framework: 'HIPAA' | 'SOX' | 'GDPR' | 'CCPA' | 'PCI-DSS'
  ): Omit<PolicyPack, 'id' | 'metadata'> {
    switch (framework) {
      case 'HIPAA':
        return this.getHIPAATemplate();
      case 'SOX':
        return this.getSOXTemplate();
      case 'GDPR':
        return this.getGDPRTemplate();
      case 'CCPA':
        return this.getCCPATemplate();
      case 'PCI-DSS':
        return this.getPCIDSSTemplate();
      default:
        throw new Error(`Unknown framework: ${framework}`);
    }
  }

  /**
   * HIPAA Template
   */
  private getHIPAATemplate(): Omit<PolicyPack, 'id' | 'metadata'> {
    return {
      name: 'HIPAA Compliance Pack',
      framework: 'HIPAA',
      version: '1.0.0',
      rules: [
        {
          id: 'hipaa_data_encryption',
          category: 'encryption',
          requirement: 'All PHI must be encrypted at rest and in transit',
          validation: {
            type: 'data-encrypted',
            condition: 'data.containsPHI && !data.isEncrypted',
            errorMessage: 'PHI must be encrypted',
          },
          severity: 'critical',
          citation: '45 CFR § 164.312(a)(2)(iv)',
        },
        {
          id: 'hipaa_access_control',
          category: 'access-control',
          requirement: 'Implement access controls to limit PHI access',
          validation: {
            type: 'access-controlled',
            condition: 'user.role !== "authorized" && accessing PHI',
            errorMessage: 'Unauthorized PHI access',
          },
          severity: 'critical',
          citation: '45 CFR § 164.312(a)(1)',
        },
        {
          id: 'hipaa_audit_logging',
          category: 'audit-logging',
          requirement: 'Maintain audit logs for PHI access',
          validation: {
            type: 'audit-logged',
            condition: 'phiAccess && !auditLog.exists',
            errorMessage: 'PHI access must be audit logged',
          },
          severity: 'high',
          citation: '45 CFR § 164.312(b)',
        },
        {
          id: 'hipaa_minimum_necessary',
          category: 'data-protection',
          requirement: 'Disclose only minimum necessary PHI',
          validation: {
            type: 'custom',
            condition: 'disclosure.phiFields.length > minimumNecessary',
            errorMessage: 'Disclosed PHI exceeds minimum necessary',
          },
          severity: 'high',
          citation: '45 CFR § 164.502(b)',
        },
      ],
    };
  }

  /**
   * SOX Template
   */
  private getSOXTemplate(): Omit<PolicyPack, 'id' | 'metadata'> {
    return {
      name: 'SOX Compliance Pack',
      framework: 'SOX',
      version: '1.0.0',
      rules: [
        {
          id: 'sox_financial_audit',
          category: 'audit-logging',
          requirement: 'Maintain audit trail for financial data changes',
          validation: {
            type: 'audit-logged',
            condition: 'financialDataChange && !auditLog.exists',
            errorMessage: 'Financial data changes must be audit logged',
          },
          severity: 'critical',
          citation: 'SOX Section 302',
        },
        {
          id: 'sox_access_separation',
          category: 'access-control',
          requirement: 'Separate duties for financial operations',
          validation: {
            type: 'access-controlled',
            condition: 'user.canApprove && user.canInitiate',
            errorMessage: 'User cannot both initiate and approve',
          },
          severity: 'critical',
          citation: 'SOX Section 404',
        },
        {
          id: 'sox_data_retention',
          category: 'retention',
          requirement: 'Retain financial records for 7 years',
          validation: {
            type: 'retention-policy',
            condition: 'record.age < 7 years',
            parameters: { minRetention: '7 years' },
            errorMessage: 'Financial records must be retained for 7 years',
          },
          severity: 'high',
          citation: 'SOX Section 802',
        },
      ],
    };
  }

  /**
   * GDPR Template
   */
  private getGDPRTemplate(): Omit<PolicyPack, 'id' | 'metadata'> {
    return {
      name: 'GDPR Compliance Pack',
      framework: 'GDPR',
      version: '1.0.0',
      rules: [
        {
          id: 'gdpr_consent',
          category: 'data-protection',
          requirement: 'Obtain explicit user consent for data processing',
          validation: {
            type: 'consent-obtained',
            condition: 'processing && !consent.explicit',
            errorMessage: 'Explicit consent required for data processing',
          },
          severity: 'critical',
          citation: 'GDPR Article 6',
        },
        {
          id: 'gdpr_right_to_erasure',
          category: 'data-protection',
          requirement: 'Enable data deletion upon user request',
          validation: {
            type: 'custom',
            condition: 'deleteRequest && !canDelete',
            errorMessage: 'Must support right to erasure',
          },
          severity: 'high',
          citation: 'GDPR Article 17',
        },
        {
          id: 'gdpr_data_portability',
          category: 'data-protection',
          requirement: 'Enable data export in machine-readable format',
          validation: {
            type: 'custom',
            condition: 'exportRequest && !machineReadableFormat',
            errorMessage: 'Data must be exportable in machine-readable format',
          },
          severity: 'medium',
          citation: 'GDPR Article 20',
        },
      ],
    };
  }

  /**
   * CCPA Template
   */
  private getCCPATemplate(): Omit<PolicyPack, 'id' | 'metadata'> {
    return {
      name: 'CCPA Compliance Pack',
      framework: 'CCPA',
      version: '1.0.0',
      rules: [
        {
          id: 'ccpa_disclosure',
          category: 'disclosure',
          requirement: 'Disclose personal information collection practices',
          validation: {
            type: 'custom',
            condition: 'collecting && !disclosed',
            errorMessage: 'Must disclose data collection practices',
          },
          severity: 'critical',
          citation: 'CCPA § 1798.100(b)',
        },
        {
          id: 'ccpa_opt_out',
          category: 'data-protection',
          requirement: 'Provide opt-out for data sale',
          validation: {
            type: 'custom',
            condition: 'selling && !optOutAvailable',
            errorMessage: 'Must provide opt-out for data sale',
          },
          severity: 'critical',
          citation: 'CCPA § 1798.120',
        },
      ],
    };
  }

  /**
   * PCI-DSS Template
   */
  private getPCIDSSTemplate(): Omit<PolicyPack, 'id' | 'metadata'> {
    return {
      name: 'PCI-DSS Compliance Pack',
      framework: 'PCI-DSS',
      version: '1.0.0',
      rules: [
        {
          id: 'pci_card_encryption',
          category: 'encryption',
          requirement: 'Encrypt cardholder data in transit and at rest',
          validation: {
            type: 'data-encrypted',
            condition: 'cardData && !encrypted',
            errorMessage: 'Cardholder data must be encrypted',
          },
          severity: 'critical',
          citation: 'PCI-DSS Requirement 3',
        },
        {
          id: 'pci_access_control',
          category: 'access-control',
          requirement: 'Restrict access to cardholder data by business need-to-know',
          validation: {
            type: 'access-controlled',
            condition: 'accessing cardData && !needToKnow',
            errorMessage: 'Access restricted to business need-to-know',
          },
          severity: 'critical',
          citation: 'PCI-DSS Requirement 7',
        },
      ],
    };
  }

  /**
   * Validate policy pack
   */
  private validatePolicyPack(rules: PolicyRule[]): void {
    // Check for empty pack
    if (rules.length === 0) {
      throw new Error('Policy pack cannot be empty');
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    rules.forEach((rule) => {
      if (ids.has(rule.id)) {
        throw new Error(`Duplicate rule ID: ${rule.id}`);
      }
      ids.add(rule.id);
    });

    // Check for required fields
    rules.forEach((rule) => {
      if (!rule.requirement || rule.requirement.trim() === '') {
        throw new Error(`Rule ${rule.id} missing requirement`);
      }
      if (!rule.validation || !rule.validation.condition) {
        throw new Error(`Rule ${rule.id} missing validation`);
      }
    });
  }

  /**
   * Get configuration
   */
  getConfig(): PolicyPackGeneratorConfig {
    return { ...this.config };
  }
}

/**
 * Default singleton instance
 */
export const policyPackGenerator = new PolicyPackGenerator();
