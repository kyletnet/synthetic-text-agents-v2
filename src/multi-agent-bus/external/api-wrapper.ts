/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * External Agent API Wrapper
 *
 * Purpose:
 * - Public API for external agents to communicate with system
 * - Message routing: External → Internal bus
 * - Authentication and authorization
 *
 * Phase 0: Multi-Agent Communication Boundary
 */

import type { Logger } from "../../shared/logger.js";
import {
  validateAgentInput,
  validateAgentOutput,
  type AgentInput,
  type AgentOutput,
} from "../../domain/interfaces/agent-contracts.js";

/**
 * External Agent API Configuration
 */
export interface ExternalAgentAPIConfig {
  authEnabled?: boolean; // Default: true
  rateLimitEnabled?: boolean; // Default: true
  maxRequestsPerMinute?: number; // Default: 10
}

/**
 * External Agent Message
 */
export interface ExternalAgentMessage {
  id: string;
  agentName: string;
  agentVersion: string;
  input: AgentInput;
  timestamp: Date;
  auth?: {
    apiKey?: string;
    jwt?: string;
  };
}

/**
 * External Agent Response
 */
export interface ExternalAgentResponse {
  messageId: string;
  success: boolean;
  output?: AgentOutput;
  error?: {
    code: string;
    message: string;
  };
  timestamp: Date;
}

/**
 * External Agent API Wrapper
 *
 * Provides public API for external agents while protecting internal bus
 */
export class ExternalAgentAPIWrapper {
  private readonly logger: Logger;
  private readonly config: Required<ExternalAgentAPIConfig>;
  private readonly rateLimits: Map<string, number[]> = new Map(); // agentName → timestamps

  constructor(logger: Logger, config: ExternalAgentAPIConfig = {}) {
    this.logger = logger;

    this.config = {
      authEnabled: config.authEnabled ?? true,
      rateLimitEnabled: config.rateLimitEnabled ?? true,
      maxRequestsPerMinute: config.maxRequestsPerMinute ?? 10,
    };
  }

  /**
   * Process external agent message
   *
   * Workflow:
   * 1. Authenticate (if enabled)
   * 2. Validate input
   * 3. Rate limit check
   * 4. Route to internal bus
   * 5. Return response
   */
  async processMessage(
    message: ExternalAgentMessage
  ): Promise<ExternalAgentResponse> {
    this.logger.info("Processing external agent message", {
      messageId: message.id,
      agentName: message.agentName,
    });

    try {
      // Step 1: Authenticate
      if (this.config.authEnabled) {
        const authResult = this.authenticate(message);
        if (!authResult.valid) {
          return this.errorResponse(message.id, "AUTH_FAILED", authResult.error || "Authentication failed");
        }
      }

      // Step 2: Validate input
      const validationResult = validateAgentInput(message.input);
      if (!validationResult.valid) {
        return this.errorResponse(
          message.id,
          "INVALID_INPUT",
          validationResult.errors?.join(", ") || "Invalid input"
        );
      }

      // Step 3: Rate limit check
      if (this.config.rateLimitEnabled) {
        const rateLimitOk = this.checkRateLimit(message.agentName);
        if (!rateLimitOk) {
          return this.errorResponse(
            message.id,
            "RATE_LIMIT_EXCEEDED",
            `Max ${this.config.maxRequestsPerMinute} requests per minute`
          );
        }
      }

      // Step 4: Route to internal bus (placeholder)
      // TODO: Implement actual routing to internal multi-agent bus
      const output = await this.routeToInternalBus(message);

      // Step 5: Return response
      return {
        messageId: message.id,
        success: true,
        output,
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.logger.error("External agent message processing failed", {
        messageId: message.id,
        error,
      });

      return this.errorResponse(
        message.id,
        "INTERNAL_ERROR",
        error.message || "Internal error"
      );
    }
  }

  /**
   * Authenticate external agent
   */
  private authenticate(message: ExternalAgentMessage): {
    valid: boolean;
    error?: string;
  } {
    // TODO: Implement actual authentication
    // For now, just check if auth is provided

    if (!message.auth) {
      return { valid: false, error: "No authentication provided" };
    }

    if (!message.auth.apiKey && !message.auth.jwt) {
      return { valid: false, error: "No API key or JWT provided" };
    }

    // Placeholder: accept any non-empty key
    return { valid: true };
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(agentName: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Get timestamps for this agent
    const timestamps = this.rateLimits.get(agentName) || [];

    // Remove old timestamps (> 1 minute)
    const recentTimestamps = timestamps.filter((ts) => ts > oneMinuteAgo);

    // Check if rate limit exceeded
    if (recentTimestamps.length >= this.config.maxRequestsPerMinute) {
      return false;
    }

    // Add current timestamp
    recentTimestamps.push(now);
    this.rateLimits.set(agentName, recentTimestamps);

    return true;
  }

  /**
   * Route message to internal bus (placeholder)
   */
  private async routeToInternalBus(
    message: ExternalAgentMessage
  ): Promise<AgentOutput> {
    // TODO: Implement actual routing to internal multi-agent bus
    // For now, return a placeholder response

    this.logger.info("Routing to internal bus", {
      agentName: message.agentName,
    });

    // Placeholder: return mock output
    return {
      result: { status: "placeholder" },
      confidence: 0.5,
      metadata: {
        duration: 100,
        tokensUsed: 0,
        costUSD: 0,
      },
    };
  }

  /**
   * Create error response
   */
  private errorResponse(
    messageId: string,
    code: string,
    message: string
  ): ExternalAgentResponse {
    return {
      messageId,
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(agentName: string): {
    requestsInLastMinute: number;
    limit: number;
    remaining: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    const timestamps = this.rateLimits.get(agentName) || [];
    const recentCount = timestamps.filter((ts) => ts > oneMinuteAgo).length;

    return {
      requestsInLastMinute: recentCount,
      limit: this.config.maxRequestsPerMinute,
      remaining: Math.max(0, this.config.maxRequestsPerMinute - recentCount),
    };
  }
}
