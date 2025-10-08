/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Domain System Module
 *
 * Pure domain logic for system management.
 * Exports all domain types, value objects, and domain services.
 */

// System status types and services
export type {
  ComponentId,
  MessageType,
  Priority,
  ComponentStatusType,
  OperationType,
  OperationStatus,
  ComponentStatus,
  Operation,
  SystemMetrics,
  SystemState,
  UnifiedMessage,
  HealthAssessment,
  ComponentHealthCheck,
} from "./system-status.js";

export {
  SystemHealthCalculator,
  OperationPriorityCalculator,
} from "./system-status.js";

// Health check rules and types
export type {
  HealthCheckThresholds,
  HealthCheckResult,
  SystemHealthStatus,
} from "./health-check.js";

export {
  HealthCheckRules,
  HeartbeatValidator,
  DEFAULT_HEALTH_THRESHOLDS,
} from "./health-check.js";

// Integration rules and types
export type {
  RoutingMode,
  ExecutionStrategy,
  RoutingDecision,
  StrategyDecision,
} from "./integration-rules.js";

export {
  RoutingRules,
  ExecutionStrategyRules,
  ComponentDependencyRules,
  RiskAssessmentRules,
} from "./integration-rules.js";
