/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Core Agent Interface (Circular Dependency Prevention)
 *
 * This file contains only the BaseAgent interface to break circular dependencies.
 * - baseAgent.ts implements this interface
 * - registry.ts references this interface
 * - No imports between baseAgent ↔ registry
 */

export interface BaseAgent {
  readonly id: string;
  readonly specialization: string;
  readonly tags: readonly string[];

  /**
   * Receive and process a message from another agent or external source
   */
  receive(content: unknown, context?: unknown): Promise<unknown>;
}
