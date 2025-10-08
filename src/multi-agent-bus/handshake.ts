/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Multi-Agent Bus Handshake
 *
 * Purpose:
 * - UUID v7 + publicKey based Agent identity verification
 * - Prevent Agent ID namespace collision
 * - Prevent Feedback loop interference
 *
 * Phase 1: Multi-Agent Bus Expansion Preparation
 */

import { createHash, randomBytes } from "crypto";

/**
 * Agent Identity (UUID v7 + Public Key)
 */
export interface AgentIdentity {
  agentId: string; // UUID v7 format
  publicKey: string; // SHA-256 hash of agent's public key
  namespace: string; // Agent namespace (e.g., "internal", "external", "plugin")
  timestamp: number; // Registration timestamp
  signature: string; // Self-signature for verification
}

/**
 * Handshake Request
 */
export interface HandshakeRequest {
  agentId: string;
  publicKey: string;
  namespace: string;
  nonce: string; // Random nonce for challenge-response
}

/**
 * Handshake Response
 */
export interface HandshakeResponse {
  success: boolean;
  identity?: AgentIdentity;
  error?: string;
  challenge?: string; // Challenge for next round
}

/**
 * Agent Registry (in-memory)
 */
const agentRegistry = new Map<string, AgentIdentity>();

/**
 * Generate UUID v7 (time-ordered UUID)
 *
 * Format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
 * - First 48 bits: Unix timestamp in milliseconds
 * - Version: 7
 * - Variant: RFC 4122
 */
export function generateUUIDv7(): string {
  const timestamp = Date.now();

  // Convert timestamp to 48-bit hex
  const timestampHex = timestamp.toString(16).padStart(12, "0");

  // Generate random bits
  const randomBits = randomBytes(10).toString("hex");

  // Construct UUID v7
  const uuid = [
    timestampHex.substring(0, 8), // time_high
    timestampHex.substring(8, 12), // time_mid
    "7" + randomBits.substring(0, 3), // version (7) + time_low
    "8" + randomBits.substring(3, 6), // variant (10) + clock_seq
    randomBits.substring(6, 18), // node
  ].join("-");

  return uuid;
}

/**
 * Generate public key (simplified - SHA-256 hash)
 */
export function generatePublicKey(agentName: string, secret: string): string {
  const input = `${agentName}:${secret}:${Date.now()}`;
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Create signature (self-signature for verification)
 */
function createSignature(
  agentId: string,
  publicKey: string,
  namespace: string,
  timestamp: number
): string {
  const data = `${agentId}:${publicKey}:${namespace}:${timestamp}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Verify signature
 */
function verifySignature(identity: AgentIdentity): boolean {
  const expectedSignature = createSignature(
    identity.agentId,
    identity.publicKey,
    identity.namespace,
    identity.timestamp
  );

  return identity.signature === expectedSignature;
}

/**
 * Check namespace collision
 */
function checkCollision(agentId: string, namespace: string): boolean {
  // Check if agentId already exists in a different namespace
  const existing = agentRegistry.get(agentId);

  if (existing && existing.namespace !== namespace) {
    return true; // Collision detected
  }

  return false;
}

/**
 * Register agent identity (simplified wrapper)
 *
 * @param agentId - Agent UUID v7
 * @param publicKey - Public key
 * @param namespace - Namespace
 * @returns Agent identity
 */
export function registerAgent(
  agentId: string,
  publicKey: string,
  namespace: string,
): AgentIdentity {
  const request: HandshakeRequest = {
    agentId,
    publicKey,
    namespace,
    nonce: createHash("sha256").update(`${agentId}:${Date.now()}`).digest("hex"),
  };

  const response = registerAgentWithHandshake(request);

  if (!response.success || !response.identity) {
    throw new Error(response.error || "Agent registration failed");
  }

  return response.identity;
}

/**
 * Register agent identity (full handshake)
 */
export function registerAgentWithHandshake(
  request: HandshakeRequest
): HandshakeResponse {
  const { agentId, publicKey, namespace, nonce } = request;

  // Validate UUID format
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(agentId)) {
    return {
      success: false,
      error: "Invalid UUID v7 format",
    };
  }

  // Check collision
  if (checkCollision(agentId, namespace)) {
    return {
      success: false,
      error: `Agent ID collision detected: ${agentId} already exists in different namespace`,
    };
  }

  // Create identity
  const timestamp = Date.now();
  const signature = createSignature(agentId, publicKey, namespace, timestamp);

  const identity: AgentIdentity = {
    agentId,
    publicKey,
    namespace,
    timestamp,
    signature,
  };

  // Verify signature
  if (!verifySignature(identity)) {
    return {
      success: false,
      error: "Signature verification failed",
    };
  }

  // Register
  agentRegistry.set(agentId, identity);

  // Generate challenge for next round (optional)
  const challenge = createHash("sha256")
    .update(`${agentId}:${nonce}:${timestamp}`)
    .digest("hex");

  return {
    success: true,
    identity,
    challenge,
  };
}

/**
 * Verify agent identity (simplified)
 *
 * @param identity - Agent identity
 * @returns Verification result
 */
export function verifyAgentIdentity(identity: AgentIdentity): {
  valid: boolean;
  error?: string;
} {
  // Check signature
  if (!verifySignature(identity)) {
    return {
      valid: false,
      error: "Signature verification failed",
    };
  }

  // Check if registered
  const registered = agentRegistry.get(identity.agentId);
  if (!registered) {
    return {
      valid: false,
      error: "Agent not registered",
    };
  }

  // Check if matches registered identity
  if (
    registered.publicKey !== identity.publicKey ||
    registered.namespace !== identity.namespace ||
    registered.signature !== identity.signature
  ) {
    return {
      valid: false,
      error: "Identity mismatch",
    };
  }

  return {
    valid: true,
  };
}

/**
 * Verify agent identity by ID
 */
export function verifyAgent(agentId: string): AgentIdentity | null {
  const identity = agentRegistry.get(agentId);

  if (!identity) {
    return null;
  }

  // Verify signature
  if (!verifySignature(identity)) {
    return null;
  }

  return identity;
}

/**
 * Unregister agent
 */
export function unregisterAgent(agentId: string): boolean {
  return agentRegistry.delete(agentId);
}

/**
 * Get all registered agents
 */
export function getAllAgents(): AgentIdentity[] {
  return Array.from(agentRegistry.values());
}

/**
 * Get agents by namespace
 */
export function getAgentsByNamespace(namespace: string): AgentIdentity[] {
  return Array.from(agentRegistry.values()).filter(
    (identity) => identity.namespace === namespace
  );
}

/**
 * Check feedback loop interference
 *
 * Prevents circular feedback between agents in same namespace
 */
export function checkFeedbackLoopInterference(
  fromAgentId: string,
  toAgentId: string
): boolean {
  const fromAgent = verifyAgent(fromAgentId);
  const toAgent = verifyAgent(toAgentId);

  if (!fromAgent || !toAgent) {
    return true; // Block if either agent not verified
  }

  // Block if same agent (self-loop)
  if (fromAgentId === toAgentId) {
    return true;
  }

  // Block if both in same namespace and circular pattern detected
  // (This is a simplified check - real implementation would track message history)
  if (fromAgent.namespace === toAgent.namespace) {
    // Allow for now, but log warning
    console.warn(
      `[Handshake] Potential feedback loop: ${fromAgentId} → ${toAgentId} (same namespace: ${fromAgent.namespace})`
    );
  }

  return false; // Allow
}

/**
 * Handshake Statistics
 */
export function getHandshakeStats(): {
  totalAgents: number;
  byNamespace: Record<string, number>;
  oldestAgent: AgentIdentity | null;
  newestAgent: AgentIdentity | null;
} {
  const agents = getAllAgents();

  const byNamespace: Record<string, number> = {};
  for (const agent of agents) {
    byNamespace[agent.namespace] = (byNamespace[agent.namespace] || 0) + 1;
  }

  const sorted = agents.sort((a, b) => a.timestamp - b.timestamp);

  return {
    totalAgents: agents.length,
    byNamespace,
    oldestAgent: sorted[0] || null,
    newestAgent: sorted[sorted.length - 1] || null,
  };
}
