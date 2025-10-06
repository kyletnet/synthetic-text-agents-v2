/**
 * Metric Validator - Governance-Metric Integration
 *
 * Purpose:
 * - Validate metric changes against governance policies
 * - Enforce auto-adjust limits (5-10% for P0 metrics)
 * - Require approval for significant changes
 * - Log all metric changes to governance.jsonl
 *
 * Design Philosophy:
 * - Protect P0 metrics (guideline_compliance, retrieval_quality_score)
 * - Allow gradual improvements, block sudden drops
 * - Traceability: all changes logged
 */

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

/**
 * Metric change request
 */
export interface MetricChangeRequest {
  /** Metric name (e.g., guideline_compliance) */
  metricName: string;

  /** Previous value */
  oldValue: number | null;

  /** New value */
  newValue: number;

  /** Reason for change */
  reason: string;

  /** Approver (if manual approval) */
  approver?: string;

  /** Session ID (for traceability) */
  sessionId?: string;
}

/**
 * Metric validation result
 */
export interface MetricValidationResult {
  /** Whether change is allowed */
  allowed: boolean;

  /** Whether manual approval is required */
  requiresApproval: boolean;

  /** Reason for decision */
  reason: string;

  /** Violations (if blocked) */
  violations?: string[];

  /** Metric priority (P0, P1, etc.) */
  priority?: string;

  /** Delta between old and new */
  delta?: number;
}

/**
 * Metric protection policy (from governance-rules.json)
 */
interface MetricProtectionPolicy {
  name: string;
  priority: string;
  description: string;
  autoAdjustLimit: {
    enabled: boolean;
    minDelta: number;
    maxDelta: number;
    requireApprovalIf: {
      deltaExceeds?: number;
      absoluteValueBelow?: number;
      consecutiveDrops?: number;
    };
  };
  governance: {
    logChanges: boolean;
    notifyOn: string[];
    thresholds: {
      critical?: number;
      warning?: number;
      target: number;
    };
  };
}

/**
 * Metric Validator
 */
export class MetricValidator {
  private projectRoot: string;
  private governancePath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.governancePath = join(
      projectRoot,
      "reports",
      "operations",
      "governance.jsonl",
    );
  }

  /**
   * Validate metric change request
   *
   * Algorithm:
   * 1. Load metric protection policy
   * 2. Calculate delta
   * 3. Check auto-adjust limits
   * 4. Check approval requirements
   * 5. Log to governance
   * 6. Return validation result
   */
  async validate(
    request: MetricChangeRequest,
  ): Promise<MetricValidationResult> {
    try {
      // 1. Load protection policy for this metric
      const policy = this.loadMetricPolicy(request.metricName);

      if (!policy) {
        // Metric not protected, allow change
        await this.logChange(request, {
          allowed: true,
          requiresApproval: false,
          reason: "Metric not protected by governance",
        });

        return {
          allowed: true,
          requiresApproval: false,
          reason: "Metric not protected by governance",
        };
      }

      // 2. Calculate delta
      const delta =
        request.oldValue !== null ? request.newValue - request.oldValue : null;

      // 3. Check auto-adjust limits
      const violations: string[] = [];

      if (delta !== null && policy.autoAdjustLimit.enabled) {
        if (delta < policy.autoAdjustLimit.minDelta) {
          violations.push(
            `Delta (${delta.toFixed(3)}) below minimum allowed (${policy.autoAdjustLimit.minDelta})`,
          );
        }

        if (delta > policy.autoAdjustLimit.maxDelta) {
          violations.push(
            `Delta (${delta.toFixed(3)}) exceeds maximum allowed (${policy.autoAdjustLimit.maxDelta})`,
          );
        }
      }

      // 4. Check absolute value thresholds
      if (
        policy.governance.thresholds.critical &&
        request.newValue < policy.governance.thresholds.critical
      ) {
        violations.push(
          `Value (${request.newValue.toFixed(3)}) below critical threshold (${policy.governance.thresholds.critical})`,
        );
      }

      // 5. Check approval requirements
      let requiresApproval = false;
      const approvalReasons: string[] = [];

      if (delta !== null) {
        const { requireApprovalIf } = policy.autoAdjustLimit;

        if (
          requireApprovalIf.deltaExceeds &&
          Math.abs(delta) > requireApprovalIf.deltaExceeds
        ) {
          requiresApproval = true;
          approvalReasons.push(
            `Delta exceeds threshold (${requireApprovalIf.deltaExceeds})`,
          );
        }

        if (
          requireApprovalIf.absoluteValueBelow &&
          request.newValue < requireApprovalIf.absoluteValueBelow
        ) {
          requiresApproval = true;
          approvalReasons.push(
            `Value below approval threshold (${requireApprovalIf.absoluteValueBelow})`,
          );
        }
      }

      // 6. Determine if change is allowed
      const allowed = violations.length === 0;

      // 7. If approval is required and no approver provided, block
      if (requiresApproval && !request.approver) {
        const result: MetricValidationResult = {
          allowed: false,
          requiresApproval: true,
          reason: `Manual approval required: ${approvalReasons.join(", ")}`,
          violations: approvalReasons,
          priority: policy.priority,
          delta: delta !== null ? delta : undefined,
        };

        await this.logChange(request, result);
        return result;
      }

      // 8. Build result
      const result: MetricValidationResult = {
        allowed,
        requiresApproval,
        reason: allowed
          ? "Change within allowed limits"
          : `Violations: ${violations.join(", ")}`,
        violations: violations.length > 0 ? violations : undefined,
        priority: policy.priority,
        delta: delta !== null ? delta : undefined,
      };

      // 9. Log to governance
      await this.logChange(request, result);

      return result;
    } catch (error) {
      console.error(`Metric validation error: ${error}`);

      return {
        allowed: false,
        requiresApproval: false,
        reason: `Validation error: ${error}`,
        violations: [String(error)],
      };
    }
  }

  /**
   * Load metric protection policy from governance-rules.json
   */
  private loadMetricPolicy(metricName: string): MetricProtectionPolicy | null {
    try {
      const rulesPath = join(this.projectRoot, "governance-rules.json");
      const rules = JSON.parse(readFileSync(rulesPath, "utf8"));

      if (!rules.metricProtection?.enabled) {
        return null;
      }

      const protectedMetrics = rules.metricProtection.protectedMetrics || [];
      return (
        protectedMetrics.find(
          (m: MetricProtectionPolicy) => m.name === metricName,
        ) || null
      );
    } catch (error) {
      console.warn(`Failed to load metric policy: ${error}`);
      return null;
    }
  }

  /**
   * Log metric change to governance.jsonl
   */
  private async logChange(
    request: MetricChangeRequest,
    result: MetricValidationResult,
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(this.governancePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Create log entry
      const logEntry = {
        id: `op-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        operation: "metric-change",
        phase: result.allowed ? "success" : "blocked",
        status: result.allowed ? "success" : "blocked",
        duration: null,
        details: {
          metricName: request.metricName,
          oldValue: request.oldValue,
          newValue: request.newValue,
          delta: result.delta,
          reason: request.reason,
          approver: request.approver,
          sessionId: request.sessionId,
          validationResult: {
            allowed: result.allowed,
            requiresApproval: result.requiresApproval,
            reason: result.reason,
            violations: result.violations,
            priority: result.priority,
          },
        },
        environment: {
          node: process.version,
          platform: process.platform,
          cwd: process.cwd(),
        },
      };

      // Append to JSONL
      appendFileSync(
        this.governancePath,
        JSON.stringify(logEntry) + "\n",
        "utf8",
      );
    } catch (error) {
      console.warn(`Failed to log metric change: ${error}`);
    }
  }

  /**
   * Check if metric change requires approval
   * (Quick check without full validation)
   */
  requiresApproval(metricName: string, delta: number): boolean {
    const policy = this.loadMetricPolicy(metricName);
    if (!policy) return false;

    const { requireApprovalIf } = policy.autoAdjustLimit;

    if (
      requireApprovalIf.deltaExceeds &&
      Math.abs(delta) > requireApprovalIf.deltaExceeds
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get metric thresholds (for UI display)
   */
  getThresholds(
    metricName: string,
  ): { critical?: number; warning?: number; target: number } | null {
    const policy = this.loadMetricPolicy(metricName);
    return policy?.governance.thresholds || null;
  }
}

/**
 * Global singleton
 */
let globalValidator: MetricValidator | null = null;

export function getMetricValidator(projectRoot?: string): MetricValidator {
  if (!globalValidator) {
    globalValidator = new MetricValidator(projectRoot);
  }
  return globalValidator;
}
