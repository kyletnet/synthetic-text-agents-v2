/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Inspection Results Schema
 * Single Source of Truth for all system diagnostics
 *
 * Design Principles:
 * 1. inspect creates this file (SoT)
 * 2. maintain reads autoFixable items
 * 3. fix reads manualApprovalNeeded items
 * 4. 5-minute TTL enforced
 */

export interface InspectionResults {
  /** Schema version for future migration */
  schemaVersion: "2025-10-inspect-v1";

  /** ISO timestamp when inspection was performed */
  timestamp: string;

  /** TTL in seconds (default: 300 = 5 minutes) */
  ttl: number;

  /** Auto-fixable items (no user approval needed) */
  autoFixable: AutoFixableItem[];

  /** Manual approval needed items (interactive /fix) */
  manualApprovalNeeded: ManualApprovalItem[];

  /** Overall system health summary */
  summary: InspectionSummary;
}

export interface AutoFixableItem {
  /** Unique identifier */
  id: string;

  /** Severity level */
  severity: "low" | "medium";

  /** Human-readable description */
  description: string;

  /** Shell command to execute for fix */
  command: string;

  /** Estimated duration in seconds */
  estimatedDuration?: number;

  /** Impact description */
  impact: string;
}

export interface ManualApprovalItem {
  /** Unique identifier */
  id: string;

  /** Severity level */
  severity: "high" | "critical";

  /** Human-readable description */
  description: string;

  /** Number of occurrences */
  count: number;

  /** Affected files (if applicable) */
  files?: string[];

  /** Impact description */
  impact: string;

  /** Suggested action for user */
  suggestedAction: string;
}

export interface InspectionSummary {
  /** Total issues found */
  totalIssues: number;

  /** Number of auto-fixable items */
  autoFixableCount: number;

  /** Number of manual approval items */
  manualApprovalCount: number;

  /** Overall health score (0-100) */
  healthScore: number;

  /** TypeScript compilation status */
  typescript: "pass" | "fail";

  /** Code style status */
  codeStyle: "pass" | "fail";

  /** Test execution status */
  tests: "pass" | "fail";

  /** Security audit status */
  security: "pass" | "fail";

  /** Integration score */
  integrationScore: number;
}

/**
 * Cache validation result
 */
export interface CacheValidation {
  /** Whether cache exists and is valid */
  valid: boolean;

  /** Age in seconds */
  ageSeconds?: number;

  /** Reason for invalidity (if invalid) */
  reason?: "missing" | "expired" | "corrupted";

  /** Cached results (if valid) */
  results?: InspectionResults;
}
