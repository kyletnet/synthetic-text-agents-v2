/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Application System Module
 *
 * Application services and use cases for system management.
 * Exports all use cases and the system coordinator.
 */

// Check Health Use Case
export type {
  CheckHealthRequest,
  CheckHealthResponse,
  HealthCheckEvent,
} from "./check-health-use-case.js";

export {
  CheckHealthUseCase,
  BatchHealthCheckUseCase,
} from "./check-health-use-case.js";

// Validate System Use Case
export type {
  ValidateSystemRequest,
  ValidationResult,
  ComponentValidation,
  DependencyIssue,
  OperationalReadiness,
} from "./validate-system-use-case.js";

export { ValidateSystemUseCase } from "./validate-system-use-case.js";

// Route Message Use Case
export type {
  RouteMessageRequest,
  RouteMessageResponse,
  RoutingMetrics,
  RoutingHistoryEntry,
} from "./route-message-use-case.js";

export {
  RouteMessageUseCase,
  BatchRouteMessageUseCase,
} from "./route-message-use-case.js";

// Execute Operation Use Case
export type {
  ExecuteOperationRequest,
  ExecuteOperationResponse,
  ExecutionPlan,
  WorkloadAssignment,
  OperationExecutionEvent,
} from "./execute-operation-use-case.js";

export {
  ExecuteOperationUseCase,
  BatchExecuteOperationUseCase,
} from "./execute-operation-use-case.js";

// System Coordinator
export type {
  SystemCoordinatorOptions,
  SystemStatusSummary,
} from "./system-coordinator.js";

export {
  SystemCoordinator,
  createSystemCoordinator,
} from "./system-coordinator.js";
