/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Poisoning Guard
 *
 * Purpose:
 * - Detect and block retrieval poisoning attacks
 * - Domain allowlist, forbidden keyword patterns, hash verification
 * - Anomaly detection for sudden topic shifts
 *
 * Phase 1.5: Retrieval Integration
 */

import type { Chunk } from "../../rag/chunk.js";
import type { PoisonCheck } from "../../domain/ports/retrieval-port.js";
import { createHash } from "crypto";

/**
 * Poisoning Guard Configuration
 */
export interface PoisonGuardConfig {
  allowlist: Set<string>; // Allowed domains
  forbiddenPatterns: RegExp[]; // Forbidden keyword patterns
  requireSignature: boolean; // Require cryptographic signature
  hashVerification: boolean; // Verify document hashes
  anomalyThreshold: number; // Anomaly score threshold (0-1)
}

/**
 * Default Poisoning Guard Configuration
 */
const DEFAULT_POISON_GUARD_CONFIG: PoisonGuardConfig = {
  allowlist: new Set([
    "docs.company.com",
    "internal.company.com",
    "wiki.company.com",
  ]),
  forbiddenPatterns: [
    /malware|virus|trojan/gi,
    /hack|crack|exploit/gi,
    /(password|secret|key)\s*[:=]\s*['"][^'"]{8,}['"]/gi, // Credential patterns
    /\b(DROP|DELETE|TRUNCATE)\s+(TABLE|DATABASE)/gi, // SQL injection
  ],
  requireSignature: false, // Optional by default
  hashVerification: false, // Optional by default
  anomalyThreshold: 0.8, // High threshold (conservative)
};

/**
 * Poisoning Guard
 */
export class PoisoningGuard {
  private config: PoisonGuardConfig;
  private knownHashes: Map<string, string> = new Map(); // chunkId -> expected hash

  constructor(config?: Partial<PoisonGuardConfig>) {
    this.config = {
      ...DEFAULT_POISON_GUARD_CONFIG,
      ...config,
      allowlist: config?.allowlist || DEFAULT_POISON_GUARD_CONFIG.allowlist,
      forbiddenPatterns:
        config?.forbiddenPatterns || DEFAULT_POISON_GUARD_CONFIG.forbiddenPatterns,
    };
  }

  /**
   * Check if chunk is poisoned
   *
   * @param chunk - Chunk to check
   * @returns Poison check result
   */
  check(chunk: Chunk): PoisonCheck {
    const blocked: string[] = [];
    const warnings: string[] = [];
    const metadata: PoisonCheck["metadata"] = {};

    // 1. Domain allowlist check
    const domainCheck = this.checkDomain(chunk);
    if (!domainCheck.passed) {
      blocked.push(domainCheck.reason!);
    }

    // 2. Forbidden pattern check
    const patternCheck = this.checkForbiddenPatterns(chunk);
    if (!patternCheck.passed) {
      blocked.push(...patternCheck.matches);
      metadata.forbiddenMatches = patternCheck.matches;
    }

    // 3. Signature check (if required)
    if (this.config.requireSignature) {
      const signatureCheck = this.checkSignature(chunk);
      if (!signatureCheck.passed) {
        blocked.push(signatureCheck.reason!);
      }
    }

    // 4. Hash verification (if enabled)
    if (this.config.hashVerification) {
      const hashCheck = this.checkHash(chunk);
      if (!hashCheck.passed) {
        blocked.push(hashCheck.reason!);
      }
    }

    // 5. Anomaly detection
    const anomalyCheck = this.checkAnomaly(chunk);
    if (anomalyCheck.score > this.config.anomalyThreshold) {
      warnings.push(`High anomaly score: ${anomalyCheck.score.toFixed(2)}`);
      metadata.anomalyScore = anomalyCheck.score;
    }

    return {
      passed: blocked.length === 0,
      blocked,
      warnings,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  /**
   * Check domain allowlist
   */
  private checkDomain(chunk: Chunk): { passed: boolean; reason?: string } {
    const domain = chunk.meta?.domain as string | undefined;

    if (!domain) {
      // No domain specified - allow but warn
      return { passed: true };
    }

    // Check if domain is allowed
    if (this.config.allowlist.has(domain)) {
      return { passed: true };
    }

    // Check if subdomain of allowed domain
    for (const allowedDomain of this.config.allowlist) {
      if (domain.endsWith(`.${allowedDomain}`)) {
        return { passed: true };
      }
    }

    return {
      passed: false,
      reason: `Domain not in allowlist: ${domain}`,
    };
  }

  /**
   * Check forbidden keyword patterns
   */
  private checkForbiddenPatterns(chunk: Chunk): { passed: boolean; matches: string[] } {
    const text = chunk.text;
    const matches: string[] = [];

    for (const pattern of this.config.forbiddenPatterns) {
      const found = text.match(pattern);
      if (found) {
        matches.push(`Forbidden pattern: ${pattern.source}`);
      }
    }

    return {
      passed: matches.length === 0,
      matches,
    };
  }

  /**
   * Check cryptographic signature
   */
  private checkSignature(chunk: Chunk): { passed: boolean; reason?: string } {
    const signature = chunk.meta?.signature as string | undefined;

    if (!signature) {
      return {
        passed: false,
        reason: "Missing cryptographic signature",
      };
    }

    // TODO: Implement actual signature verification
    // For now, just check if signature exists and looks valid
    if (signature.length < 64) {
      return {
        passed: false,
        reason: "Invalid signature format",
      };
    }

    return { passed: true };
  }

  /**
   * Check document hash
   */
  private checkHash(chunk: Chunk): { passed: boolean; reason?: string } {
    const expectedHash = this.knownHashes.get(chunk.id);

    if (!expectedHash) {
      // No expected hash - skip check
      return { passed: true };
    }

    // Calculate actual hash
    const actualHash = createHash("sha256").update(chunk.text).digest("hex");

    if (actualHash !== expectedHash) {
      return {
        passed: false,
        reason: "Hash mismatch - document may be modified",
      };
    }

    return { passed: true };
  }

  /**
   * Detect anomalies (sudden topic shifts, unusual patterns)
   */
  private checkAnomaly(chunk: Chunk): { score: number } {
    // Simple anomaly detection based on:
    // 1. Unusual capitalization (ALL CAPS)
    // 2. Excessive punctuation
    // 3. Unusual character distribution

    let anomalyScore = 0;

    const text = chunk.text;

    // 1. ALL CAPS check
    const upperCaseRatio =
      (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
    if (upperCaseRatio > 0.5) {
      anomalyScore += 0.3;
    }

    // 2. Excessive punctuation
    const punctuationRatio =
      (text.match(/[!?]{2,}/g) || []).length / Math.max(1, text.split(" ").length);
    if (punctuationRatio > 0.1) {
      anomalyScore += 0.2;
    }

    // 3. Unusual character distribution
    const specialCharRatio =
      (text.match(/[^a-zA-Z0-9\s]/g) || []).length / Math.max(1, text.length);
    if (specialCharRatio > 0.3) {
      anomalyScore += 0.3;
    }

    // 4. Very short or very long chunks
    if (text.length < 50 || text.length > 10000) {
      anomalyScore += 0.2;
    }

    return {
      score: Math.min(1.0, anomalyScore),
    };
  }

  /**
   * Add allowed domain
   *
   * @param domain - Domain to allow
   */
  addAllowedDomain(domain: string): void {
    this.config.allowlist.add(domain);
  }

  /**
   * Remove allowed domain
   *
   * @param domain - Domain to remove
   */
  removeAllowedDomain(domain: string): void {
    this.config.allowlist.delete(domain);
  }

  /**
   * Add forbidden pattern
   *
   * @param pattern - RegExp pattern to forbid
   */
  addForbiddenPattern(pattern: RegExp): void {
    this.config.forbiddenPatterns.push(pattern);
  }

  /**
   * Register known hash for verification
   *
   * @param chunkId - Chunk ID
   * @param hash - Expected hash (SHA-256)
   */
  registerHash(chunkId: string, hash: string): void {
    this.knownHashes.set(chunkId, hash);
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<PoisonGuardConfig> {
    return {
      ...this.config,
      allowlist: new Set(this.config.allowlist),
      forbiddenPatterns: [...this.config.forbiddenPatterns],
    };
  }
}
