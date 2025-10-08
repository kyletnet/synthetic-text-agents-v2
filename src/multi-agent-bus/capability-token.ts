/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Capability Token - Scoped Tool Permissions
 *
 * Purpose:
 * - Fine-grained permission control for agent tools
 * - Prevent privilege escalation
 * - Audit tool usage
 *
 * Phase 1: Multi-Agent Bus Expansion
 */

import { createHash } from "crypto";
import type { AgentCapability } from "../domain/interfaces/agent-contracts.js";

/**
 * Tool Permission Level
 */
export type PermissionLevel = "read" | "write" | "execute" | "admin";

/**
 * Tool Permission
 */
export interface ToolPermission {
  tool: string; // Tool identifier (e.g., "rag:search", "llm:generate")
  level: PermissionLevel;
  constraints?: ToolConstraints;
}

/**
 * Tool Constraints
 */
export interface ToolConstraints {
  maxCalls?: number; // Max calls per session
  maxCost?: number; // Max cost in USD
  maxTokens?: number; // Max tokens
  timeout?: number; // Timeout in ms
  rateLimit?: {
    calls: number;
    window: number; // Window in ms
  };
}

/**
 * Capability Token
 */
export interface CapabilityToken {
  tokenId: string; // Unique token ID (SHA-256 hash)
  agentId: string; // Agent UUID v7
  capabilities: AgentCapability[]; // Agent capabilities
  permissions: ToolPermission[]; // Tool permissions
  issuedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
  signature: string; // Token signature
  metadata?: {
    issuedBy?: string;
    reason?: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Token Validation Result
 */
export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Usage Record
 */
export interface UsageRecord {
  tokenId: string;
  tool: string;
  timestamp: number;
  cost?: number;
  tokens?: number;
  duration?: number;
  success: boolean;
  error?: string;
}

/**
 * Token Registry (in-memory)
 */
const tokenRegistry = new Map<string, CapabilityToken>();
const usageRegistry = new Map<string, UsageRecord[]>(); // tokenId -> usage records
const rateLimitMap = new Map<string, { count: number; windowStart: number }>(); // tokenId:tool -> rate limit state

/**
 * Generate Capability Token
 *
 * @param agentId - Agent UUID v7
 * @param capabilities - Agent capabilities
 * @param permissions - Tool permissions
 * @param ttl - Time to live in milliseconds (default: 1 hour)
 * @returns Capability token
 */
export function generateCapabilityToken(
  agentId: string,
  capabilities: AgentCapability[],
  permissions: ToolPermission[],
  ttl: number = 3600000, // 1 hour
  metadata?: CapabilityToken["metadata"],
): CapabilityToken {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttl;

  // Generate token ID (SHA-256 hash of agentId + issuedAt)
  const tokenId = createHash("sha256")
    .update(`${agentId}:${issuedAt}`)
    .digest("hex");

  // Generate signature (SHA-256 hash of tokenId + agentId + capabilities + permissions)
  const signature = createHash("sha256")
    .update(
      `${tokenId}:${agentId}:${JSON.stringify(capabilities)}:${JSON.stringify(permissions)}`,
    )
    .digest("hex");

  const token: CapabilityToken = {
    tokenId,
    agentId,
    capabilities,
    permissions,
    issuedAt,
    expiresAt,
    signature,
    metadata,
  };

  // Register token
  tokenRegistry.set(tokenId, token);
  usageRegistry.set(tokenId, []);

  return token;
}

/**
 * Validate Capability Token
 *
 * @param token - Capability token
 * @returns Validation result
 */
export function validateCapabilityToken(
  token: CapabilityToken,
): TokenValidationResult {
  const warnings: string[] = [];

  // 1. Check if token exists in registry
  const registeredToken = tokenRegistry.get(token.tokenId);
  if (!registeredToken) {
    return {
      valid: false,
      error: "Token not found in registry",
    };
  }

  // 2. Check if token matches registered token
  if (registeredToken.signature !== token.signature) {
    return {
      valid: false,
      error: "Token signature mismatch",
    };
  }

  // 3. Check if token is expired
  if (Date.now() > token.expiresAt) {
    return {
      valid: false,
      error: "Token expired",
    };
  }

  // 4. Check if token is expiring soon (< 5 minutes)
  const timeUntilExpiry = token.expiresAt - Date.now();
  if (timeUntilExpiry < 300000) {
    // 5 minutes
    warnings.push(
      `Token expiring soon (${Math.floor(timeUntilExpiry / 1000)}s remaining)`,
    );
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Check Tool Permission
 *
 * @param token - Capability token
 * @param tool - Tool identifier
 * @param requiredLevel - Required permission level
 * @returns True if permission granted
 */
export function checkToolPermission(
  token: CapabilityToken,
  tool: string,
  requiredLevel: PermissionLevel,
): boolean {
  // 1. Validate token
  const validation = validateCapabilityToken(token);
  if (!validation.valid) {
    return false;
  }

  // 2. Find permission for tool
  const permission = token.permissions.find((p) => p.tool === tool);
  if (!permission) {
    return false;
  }

  // 3. Check permission level
  const levels: PermissionLevel[] = ["read", "write", "execute", "admin"];
  const grantedIndex = levels.indexOf(permission.level);
  const requiredIndex = levels.indexOf(requiredLevel);

  if (grantedIndex < requiredIndex) {
    return false;
  }

  // 4. Check constraints
  if (permission.constraints) {
    const usage = usageRegistry.get(token.tokenId) || [];

    // Max calls
    if (permission.constraints.maxCalls !== undefined) {
      const toolUsage = usage.filter((u) => u.tool === tool);
      if (toolUsage.length >= permission.constraints.maxCalls) {
        return false;
      }
    }

    // Max cost
    if (permission.constraints.maxCost !== undefined) {
      const totalCost = usage
        .filter((u) => u.tool === tool)
        .reduce((sum, u) => sum + (u.cost || 0), 0);
      if (totalCost >= permission.constraints.maxCost) {
        return false;
      }
    }

    // Max tokens
    if (permission.constraints.maxTokens !== undefined) {
      const totalTokens = usage
        .filter((u) => u.tool === tool)
        .reduce((sum, u) => sum + (u.tokens || 0), 0);
      if (totalTokens >= permission.constraints.maxTokens) {
        return false;
      }
    }

    // Rate limit
    if (permission.constraints.rateLimit) {
      const key = `${token.tokenId}:${tool}`;
      const rateLimitState = rateLimitMap.get(key);
      const now = Date.now();

      if (rateLimitState) {
        const windowElapsed = now - rateLimitState.windowStart;

        if (windowElapsed < permission.constraints.rateLimit.window) {
          // Within window
          if (rateLimitState.count >= permission.constraints.rateLimit.calls) {
            return false; // Rate limit exceeded
          }
        } else {
          // Window expired, reset
          rateLimitMap.set(key, { count: 0, windowStart: now });
        }
      } else {
        // First call
        rateLimitMap.set(key, { count: 0, windowStart: now });
      }
    }
  }

  return true;
}

/**
 * Record Tool Usage
 *
 * @param token - Capability token
 * @param tool - Tool identifier
 * @param usage - Usage details
 */
export function recordToolUsage(
  token: CapabilityToken,
  tool: string,
  usage: Omit<UsageRecord, "tokenId" | "tool" | "timestamp">,
): void {
  const record: UsageRecord = {
    tokenId: token.tokenId,
    tool,
    timestamp: Date.now(),
    ...usage,
  };

  // Add to usage registry
  const records = usageRegistry.get(token.tokenId) || [];
  records.push(record);
  usageRegistry.set(token.tokenId, records);

  // Update rate limit state
  const permission = token.permissions.find((p) => p.tool === tool);
  if (permission?.constraints?.rateLimit) {
    const key = `${token.tokenId}:${tool}`;
    const rateLimitState = rateLimitMap.get(key);

    if (rateLimitState) {
      rateLimitState.count++;
    }
  }
}

/**
 * Get Token Usage Statistics
 *
 * @param tokenId - Token ID
 * @returns Usage statistics
 */
export function getTokenUsageStats(tokenId: string): {
  totalCalls: number;
  totalCost: number;
  totalTokens: number;
  toolBreakdown: Record<string, { calls: number; cost: number; tokens: number }>;
  successRate: number;
} {
  const usage = usageRegistry.get(tokenId) || [];

  const totalCalls = usage.length;
  const totalCost = usage.reduce((sum, u) => sum + (u.cost || 0), 0);
  const totalTokens = usage.reduce((sum, u) => sum + (u.tokens || 0), 0);
  const successfulCalls = usage.filter((u) => u.success).length;
  const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;

  const toolBreakdown: Record<
    string,
    { calls: number; cost: number; tokens: number }
  > = {};

  for (const record of usage) {
    if (!toolBreakdown[record.tool]) {
      toolBreakdown[record.tool] = { calls: 0, cost: 0, tokens: 0 };
    }

    toolBreakdown[record.tool].calls++;
    toolBreakdown[record.tool].cost += record.cost || 0;
    toolBreakdown[record.tool].tokens += record.tokens || 0;
  }

  return {
    totalCalls,
    totalCost,
    totalTokens,
    toolBreakdown,
    successRate,
  };
}

/**
 * Revoke Capability Token
 *
 * @param tokenId - Token ID
 * @returns True if revoked successfully
 */
export function revokeCapabilityToken(tokenId: string): boolean {
  const token = tokenRegistry.get(tokenId);
  if (!token) {
    return false;
  }

  tokenRegistry.delete(tokenId);
  usageRegistry.delete(tokenId);

  // Clean up rate limit states
  for (const key of rateLimitMap.keys()) {
    if (key.startsWith(`${tokenId}:`)) {
      rateLimitMap.delete(key);
    }
  }

  return true;
}

/**
 * Renew Capability Token
 *
 * @param tokenId - Token ID
 * @param ttl - New time to live in milliseconds
 * @returns Renewed token or null if not found
 */
export function renewCapabilityToken(
  tokenId: string,
  ttl: number,
): CapabilityToken | null {
  const token = tokenRegistry.get(tokenId);
  if (!token) {
    return null;
  }

  // Create new token with extended expiry
  const renewedToken: CapabilityToken = {
    ...token,
    issuedAt: Date.now(),
    expiresAt: Date.now() + ttl,
    // Regenerate signature
    signature: createHash("sha256")
      .update(
        `${token.tokenId}:${token.agentId}:${JSON.stringify(token.capabilities)}:${JSON.stringify(token.permissions)}`,
      )
      .digest("hex"),
  };

  // Update registry
  tokenRegistry.set(tokenId, renewedToken);

  return renewedToken;
}

/**
 * Clear expired tokens (cleanup)
 */
export function clearExpiredTokens(): number {
  let cleared = 0;
  const now = Date.now();

  for (const [tokenId, token] of tokenRegistry.entries()) {
    if (token.expiresAt < now) {
      revokeCapabilityToken(tokenId);
      cleared++;
    }
  }

  return cleared;
}
