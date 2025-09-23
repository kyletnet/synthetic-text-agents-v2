interface PiiMatch {
  type: "pii" | "license";
  pattern: string;
  match: string;
  context: string;
  location: {
    field: string;
    index: number;
  };
  risk_level: "low" | "medium" | "high";
}
interface PiiLicenseMetrics {
  total_items_scanned: number;
  pii_hits: number;
  license_risk_hits: number;
  total_violations: number;
  matches: PiiMatch[];
  summary: {
    email_addresses: number;
    phone_numbers: number;
    credit_cards: number;
    social_security: number;
    copyright_notices: number;
    license_terms: number;
  };
  alert_triggered: boolean;
}
interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_text?: string;
  source_text?: string;
  index?: number;
}
/**
 * Scan QA items for PII and license violations
 */
export declare function scanPiiAndLicense(
  qaItems: QAItem[],
  configPath?: string,
): PiiLicenseMetrics;
/**
 * Generate PII and license scan report
 */
export declare function generatePiiLicenseReport(
  metrics: PiiLicenseMetrics,
): string;
export {};
//# sourceMappingURL=piiLicenseScan.d.ts.map
