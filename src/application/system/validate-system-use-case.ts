/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Validate System Use Case
 *
 * Application service for system validation operations.
 * Validates system integrity, component dependencies, and operational readiness.
 */

import type { Logger } from "../../shared/logger.js";
import type {
  ComponentId,
  SystemState,
  Operation,
} from "../../domain/system/system-status.js";
import {
  ComponentDependencyRules,
  RiskAssessmentRules,
  ExecutionStrategyRules,
} from "../../domain/system/integration-rules.js";

/**
 * Validation request
 */
export interface ValidateSystemRequest {
  readonly checkDependencies?: boolean;
  readonly checkOperationalReadiness?: boolean;
  readonly targetOperation?: Operation;
  readonly strictMode?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly componentValidations: ReadonlyMap<ComponentId, ComponentValidation>;
  readonly dependencyIssues: readonly DependencyIssue[];
  readonly operationalReadiness: OperationalReadiness;
  readonly executionTime: number;
}

/**
 * Component validation result
 */
export interface ComponentValidation {
  readonly componentId: ComponentId;
  readonly isValid: boolean;
  readonly isHealthy: boolean;
  readonly dependenciesSatisfied: boolean;
  readonly canStart: boolean;
  readonly issues: readonly string[];
}

/**
 * Dependency issue
 */
export interface DependencyIssue {
  readonly componentId: ComponentId;
  readonly blockedBy: readonly ComponentId[];
  readonly severity: "error" | "warning";
  readonly message: string;
}

/**
 * Operational readiness assessment
 */
export interface OperationalReadiness {
  readonly ready: boolean;
  readonly healthyComponents: number;
  readonly totalComponents: number;
  readonly criticalComponentsDown: readonly ComponentId[];
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly riskFactors: readonly string[];
  readonly recommendations: readonly string[];
}

/**
 * Validate System Use Case
 *
 * Responsibilities:
 * - Validate system integrity
 * - Check component dependencies
 * - Assess operational readiness
 * - Provide validation recommendations
 */
export class ValidateSystemUseCase {
  constructor(private readonly logger: Logger) {}

  /**
   * Execute system validation
   */
  async execute(
    systemState: SystemState,
    request: ValidateSystemRequest = {},
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    this.logger.debug("Executing system validation", {
      componentCount: systemState.components.size,
      checkDependencies: request.checkDependencies ?? true,
      checkOperationalReadiness: request.checkOperationalReadiness ?? true,
    });

    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate each component
      const componentValidations = this.validateAllComponents(
        systemState,
        request.checkDependencies ?? true,
      );

      // Collect errors and warnings from component validations
      for (const validation of componentValidations.values()) {
        if (!validation.isValid) {
          errors.push(
            ...validation.issues.map(
              (issue) => `${validation.componentId}: ${issue}`,
            ),
          );
        }
      }

      // Check dependency issues
      const dependencyIssues = request.checkDependencies
        ? this.checkDependencies(systemState)
        : [];

      for (const issue of dependencyIssues) {
        if (issue.severity === "error") {
          errors.push(issue.message);
        } else {
          warnings.push(issue.message);
        }
      }

      // Assess operational readiness
      const operationalReadiness = request.checkOperationalReadiness
        ? this.assessOperationalReadiness(systemState, request.targetOperation)
        : this.createDefaultReadiness(systemState);

      if (!operationalReadiness.ready && request.strictMode) {
        errors.push("System is not operationally ready");
      }

      const valid =
        errors.length === 0 &&
        (!request.strictMode || operationalReadiness.ready);

      const executionTime = Date.now() - startTime;

      this.logger.info("System validation completed", {
        valid,
        errors: errors.length,
        warnings: warnings.length,
        dependencyIssues: dependencyIssues.length,
        executionTime,
      });

      return {
        valid,
        errors,
        warnings,
        componentValidations,
        dependencyIssues,
        operationalReadiness,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error("System validation failed", {
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });

      throw error;
    }
  }

  /**
   * Validate all components
   */
  private validateAllComponents(
    systemState: SystemState,
    checkDependencies: boolean,
  ): ReadonlyMap<ComponentId, ComponentValidation> {
    const validations = new Map<ComponentId, ComponentValidation>();

    for (const [id, component] of systemState.components.entries()) {
      const issues: string[] = [];
      const isHealthy = component.status === "healthy";

      if (!isHealthy) {
        issues.push(`Component is ${component.status}`);
      }

      // Check dependencies if requested
      let dependenciesSatisfied = true;
      let canStart = true;

      if (checkDependencies) {
        dependenciesSatisfied =
          ComponentDependencyRules.areDependenciesSatisfied(
            component,
            systemState,
          );

        if (!dependenciesSatisfied) {
          const failedDeps = ComponentDependencyRules.getFailedDependencies(
            component,
            systemState,
          );
          issues.push(`Dependencies not satisfied: ${failedDeps.join(", ")}`);
        }

        const startCheck = ComponentDependencyRules.canStart(
          component,
          systemState,
        );
        canStart = startCheck.canStart;

        if (!canStart) {
          issues.push(startCheck.reason);
        }
      }

      const isValid = issues.length === 0;

      validations.set(id, {
        componentId: id,
        isValid,
        isHealthy,
        dependenciesSatisfied,
        canStart,
        issues,
      });
    }

    return validations;
  }

  /**
   * Check for dependency issues
   */
  private checkDependencies(
    systemState: SystemState,
  ): readonly DependencyIssue[] {
    const issues: DependencyIssue[] = [];

    for (const component of systemState.components.values()) {
      const startCheck = ComponentDependencyRules.canStart(
        component,
        systemState,
      );

      if (!startCheck.canStart) {
        issues.push({
          componentId: component.id,
          blockedBy: startCheck.blockedBy,
          severity: component.status === "failed" ? "error" : "warning",
          message: `${component.id} cannot start: ${startCheck.reason}`,
        });
      }
    }

    return issues;
  }

  /**
   * Assess operational readiness
   */
  private assessOperationalReadiness(
    systemState: SystemState,
    targetOperation?: Operation,
  ): OperationalReadiness {
    const healthyComponents = Array.from(
      systemState.components.values(),
    ).filter((c) => c.status === "healthy").length;

    const totalComponents = systemState.components.size;

    // Find critical components that are down
    const criticalComponentsDown: ComponentId[] = [];
    for (const [id, component] of systemState.components.entries()) {
      if (component.status === "failed" || component.status === "degraded") {
        // Consider components with many dependents as critical
        const dependentCount = Array.from(
          systemState.components.values(),
        ).filter((c) => c.dependencies.includes(id)).length;

        if (dependentCount > 2) {
          criticalComponentsDown.push(id);
        }
      }
    }

    // Assess risk if operation is provided
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    let riskFactors: string[] = [];

    if (targetOperation) {
      const riskAssessment = RiskAssessmentRules.assessOperationRisk(
        targetOperation,
        systemState,
      );
      riskLevel = riskAssessment.riskLevel;
      riskFactors = [...riskAssessment.factors];
    } else {
      // General system risk assessment
      if (systemState.health < 50) {
        riskLevel = "critical";
        riskFactors.push("System health below 50%");
      } else if (systemState.health < 70) {
        riskLevel = "high";
        riskFactors.push("System health below 70%");
      } else if (criticalComponentsDown.length > 0) {
        riskLevel = "medium";
        riskFactors.push(
          `${criticalComponentsDown.length} critical components down`,
        );
      }
    }

    // Generate recommendations
    const recommendations = this.generateReadinessRecommendations(
      systemState,
      criticalComponentsDown,
      riskLevel,
    );

    const ready =
      healthyComponents > 0 &&
      criticalComponentsDown.length === 0 &&
      riskLevel !== "critical";

    return {
      ready,
      healthyComponents,
      totalComponents,
      criticalComponentsDown,
      riskLevel,
      riskFactors,
      recommendations,
    };
  }

  /**
   * Generate readiness recommendations
   */
  private generateReadinessRecommendations(
    systemState: SystemState,
    criticalComponentsDown: readonly ComponentId[],
    riskLevel: "low" | "medium" | "high" | "critical",
  ): readonly string[] {
    const recommendations: string[] = [];

    if (criticalComponentsDown.length > 0) {
      recommendations.push(
        `Restore critical components: ${criticalComponentsDown.join(", ")}`,
      );
    }

    if (systemState.health < 50) {
      recommendations.push(
        "System health critical - perform full system check",
      );
    } else if (systemState.health < 70) {
      recommendations.push(
        "System health degraded - investigate component issues",
      );
    }

    if (systemState.metrics.errorRate > 0.1) {
      recommendations.push(
        `High error rate (${(systemState.metrics.errorRate * 100).toFixed(
          1,
        )}%) - review error logs`,
      );
    }

    if (systemState.activeOperations.size > 10) {
      recommendations.push(
        "High number of active operations - consider reducing load",
      );
    }

    if (riskLevel === "critical" || riskLevel === "high") {
      recommendations.push(
        "High risk level detected - defer non-critical operations",
      );
    }

    return recommendations;
  }

  /**
   * Create default operational readiness
   */
  private createDefaultReadiness(
    systemState: SystemState,
  ): OperationalReadiness {
    const healthyComponents = Array.from(
      systemState.components.values(),
    ).filter((c) => c.status === "healthy").length;

    return {
      ready: healthyComponents > 0,
      healthyComponents,
      totalComponents: systemState.components.size,
      criticalComponentsDown: [],
      riskLevel: "low",
      riskFactors: [],
      recommendations: [],
    };
  }

  /**
   * Validate that operation can be executed safely
   */
  async validateOperation(
    operation: Operation,
    systemState: SystemState,
  ): Promise<{
    canExecute: boolean;
    shouldProceed: boolean;
    riskAssessment: {
      riskLevel: "low" | "medium" | "high" | "critical";
      factors: readonly string[];
    };
    recommendation: string;
  }> {
    const riskAssessment = RiskAssessmentRules.assessOperationRisk(
      operation,
      systemState,
    );

    const canExecute = ExecutionStrategyRules.canExecuteImmediately(
      operation,
      systemState,
    );

    const shouldProceed = RiskAssessmentRules.shouldProceed(
      riskAssessment.riskLevel,
      (operation.metadata.priority as any) ?? "P2",
    );

    let recommendation: string;
    if (!canExecute) {
      recommendation =
        "Operation cannot be executed immediately - will be queued";
    } else if (!shouldProceed) {
      recommendation = "Operation execution not recommended due to high risk";
    } else {
      recommendation = "Operation can proceed safely";
    }

    return {
      canExecute,
      shouldProceed,
      riskAssessment,
      recommendation,
    };
  }
}
