/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 [Your Company]
 *
 * Agent Contracts - External Agent Interface
 *
 * Purpose:
 * - Define standard interface for external agents
 * - Ensure type safety and validation
 * - Enable multi-framework compatibility
 *
 * Phase 0: Multi-Agent Boundary Definition
 */

import { z } from "zod";

/**
 * Agent Capability
 */
export type AgentCapability =
  | "retrieval" // Evidence retrieval
  | "evaluation" // Quality assessment
  | "planning" // Diversity planning
  | "generation" // QA generation
  | "analysis" // Data analysis
  | "transformation"; // Data transformation

/**
 * Constraint Type
 */
export type ConstraintType = "timeout" | "memory" | "cost" | "tokens";

/**
 * Constraint Schema
 */
export const ConstraintSchema = z.object({
  type: z.enum(["timeout", "memory", "cost", "tokens"]),
  value: z.number().positive(),
  unit: z.string().optional(), // e.g., "ms", "MB", "USD", "tokens"
});

export type Constraint = z.infer<typeof ConstraintSchema>;

/**
 * Agent Input Schema
 */
export const AgentInputSchema = z.object({
  query: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  constraints: z.array(ConstraintSchema).optional(),
  metadata: z
    .object({
      source: z.string().optional(),
      priority: z.number().min(1).max(5).optional(), // 1 = highest
      timestamp: z.string().datetime().optional(),
    })
    .optional(),
});

export type AgentInput = z.infer<typeof AgentInputSchema>;

/**
 * Agent Output Schema
 */
export const AgentOutputSchema = z.object({
  result: z.unknown(),
  confidence: z.number().min(0).max(1),
  metadata: z
    .object({
      duration: z.number().optional(), // Execution time (ms)
      tokensUsed: z.number().optional(),
      costUSD: z.number().optional(),
    })
    .optional(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

/**
 * Validation Result Schema
 */
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Agent Contract Interface
 *
 * All external agents MUST implement this interface
 */
export interface AgentContract {
  /**
   * Agent metadata
   */
  readonly name: string;
  readonly version: string;
  readonly capabilities: AgentCapability[];

  /**
   * Execute agent logic
   *
   * @param input - Agent input (validated)
   * @returns Agent output with confidence score
   */
  execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Validate input before execution
   *
   * @param input - Agent input to validate
   * @returns Validation result
   */
  validate(input: AgentInput): ValidationResult;

  /**
   * Get agent health status
   *
   * @returns Health check result
   */
  health?(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Agent Registry Entry
 */
export interface AgentRegistryEntry {
  agent: AgentContract;
  registeredAt: Date;
  enabled: boolean;
  priority: number; // 1 = highest
}

/**
 * Validate agent input using Zod schema
 */
export function validateAgentInput(input: unknown): ValidationResult {
  const result = AgentInputSchema.safeParse(input);

  if (result.success) {
    return { valid: true };
  } else {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }
}

/**
 * Validate agent output using Zod schema
 */
export function validateAgentOutput(output: unknown): ValidationResult {
  const result = AgentOutputSchema.safeParse(output);

  if (result.success) {
    return { valid: true };
  } else {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }
}
