/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Standardized error handling for the Synthetic Text Agents system
 */

export enum ErrorCode {
  // Agent errors
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  AGENT_EXECUTION_FAILED = "AGENT_EXECUTION_FAILED",
  AGENT_TIMEOUT = "AGENT_TIMEOUT",

  // System errors
  INITIALIZATION_FAILED = "INITIALIZATION_FAILED",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  RESOURCE_EXHAUSTED = "RESOURCE_EXHAUSTED",

  // Input/Output errors
  INVALID_INPUT = "INVALID_INPUT",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  OUTPUT_GENERATION_FAILED = "OUTPUT_GENERATION_FAILED",

  // External service errors
  API_ERROR = "API_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}

export class AgentSystemError extends Error {
  public readonly code: ErrorCode;
  public readonly agentId: string | undefined;
  public readonly context: Record<string, unknown> | undefined;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      agentId?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = "AgentSystemError";
    this.code = code;
    this.agentId = options?.agentId;
    this.context = options?.context;
    this.timestamp = new Date();

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentSystemError);
    }

    // Set the cause if provided
    if (options?.cause) {
      this.cause = options.cause;
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      agentId: this.agentId,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

export class AgentExecutionError extends AgentSystemError {
  constructor(
    agentId: string,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(ErrorCode.AGENT_EXECUTION_FAILED, message, {
      ...options,
      agentId,
    });
    this.name = "AgentExecutionError";
  }
}

export class ValidationError extends AgentSystemError {
  constructor(
    field: string,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(
      ErrorCode.VALIDATION_FAILED,
      `Validation failed for ${field}: ${message}`,
      options,
    );
    this.name = "ValidationError";
  }
}

/**
 * Utility functions for error handling
 */
export function isAgentSystemError(error: unknown): error is AgentSystemError {
  return error instanceof AgentSystemError;
}

export function createErrorContext(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Retry with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
