/**
 * Standardized error handling for the Synthetic Text Agents system
 */
export declare enum ErrorCode {
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  AGENT_EXECUTION_FAILED = "AGENT_EXECUTION_FAILED",
  AGENT_TIMEOUT = "AGENT_TIMEOUT",
  INITIALIZATION_FAILED = "INITIALIZATION_FAILED",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  RESOURCE_EXHAUSTED = "RESOURCE_EXHAUSTED",
  INVALID_INPUT = "INVALID_INPUT",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  OUTPUT_GENERATION_FAILED = "OUTPUT_GENERATION_FAILED",
  API_ERROR = "API_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}
export declare class AgentSystemError extends Error {
  readonly code: ErrorCode;
  readonly agentId: string | undefined;
  readonly context: Record<string, unknown> | undefined;
  readonly timestamp: Date;
  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      agentId?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    },
  );
  toJSON(): Record<string, unknown>;
}
export declare class AgentExecutionError extends AgentSystemError {
  constructor(
    agentId: string,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    },
  );
}
export declare class ValidationError extends AgentSystemError {
  constructor(
    field: string,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    },
  );
}
/**
 * Utility functions for error handling
 */
export declare function isAgentSystemError(
  error: unknown,
): error is AgentSystemError;
export declare function createErrorContext(
  data: Record<string, unknown>,
): Record<string, unknown>;
/**
 * Safe error message extraction
 */
export declare function getErrorMessage(error: unknown): string;
/**
 * Retry with exponential backoff
 */
export declare function withRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  },
): Promise<T>;
//# sourceMappingURL=errors.d.ts.map
