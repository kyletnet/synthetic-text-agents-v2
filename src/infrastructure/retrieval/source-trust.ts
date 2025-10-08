/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Source Trust Scorer
 *
 * Purpose:
 * - Score chunks based on source trustworthiness
 * - Domain allowlist, signature validation, freshness, author reputation
 * - Composite score (0-1)
 *
 * Phase 1.5: Retrieval Integration
 */

import type { Chunk } from "../../rag/chunk.js";
import {
  type TrustScore,
  calculateCompositeTrustScore,
} from "../../domain/ports/retrieval-port.js";

/**
 * Trust Configuration
 */
export interface TrustConfig {
  trustedDomains: Set<string>; // Whitelisted domains
  knownAuthors: Map<string, number>; // Author -> reputation score (0-1)
  freshnessHalfLife: number; // Days until 50% freshness (default: 180 days)
}

/**
 * Default Trust Configuration
 */
const DEFAULT_TRUST_CONFIG: TrustConfig = {
  trustedDomains: new Set([
    "docs.company.com",
    "internal.company.com",
    "wiki.company.com",
  ]),
  knownAuthors: new Map([
    ["official-team", 1.0],
    ["tech-lead", 0.9],
    ["engineer", 0.7],
  ]),
  freshnessHalfLife: 180, // 6 months
};

/**
 * Source Trust Scorer
 */
export class SourceTrust {
  private config: TrustConfig;

  constructor(config?: Partial<TrustConfig>) {
    this.config = {
      ...DEFAULT_TRUST_CONFIG,
      ...config,
      trustedDomains: config?.trustedDomains || DEFAULT_TRUST_CONFIG.trustedDomains,
      knownAuthors: config?.knownAuthors || DEFAULT_TRUST_CONFIG.knownAuthors,
    };
  }

  /**
   * Score a chunk's trustworthiness
   *
   * @param chunk - Chunk to score
   * @returns Trust score
   */
  scoreChunk(chunk: Chunk): TrustScore {
    const factors = {
      domainTrust: this.scoreDomain(chunk),
      signatureValid: this.validateSignature(chunk),
      timeFreshness: this.scoreFreshness(chunk),
      authorReputation: this.scoreAuthor(chunk),
    };

    const compositeScore = calculateCompositeTrustScore(factors);

    return {
      chunkId: chunk.id,
      score: compositeScore,
      factors,
      metadata: {
        domain: chunk.meta?.domain as string | undefined,
        signature: chunk.meta?.signature as string | undefined,
        timestamp: chunk.meta?.timestamp as Date | undefined,
        author: chunk.meta?.author as string | undefined,
      },
    };
  }

  /**
   * Score domain trustworthiness
   *
   * @param chunk - Chunk
   * @returns Domain trust score (0-1)
   */
  private scoreDomain(chunk: Chunk): number {
    const domain = chunk.meta?.domain as string | undefined;

    if (!domain) {
      return 0.2; // No domain = low trust
    }

    // Check if domain is whitelisted
    if (this.config.trustedDomains.has(domain)) {
      return 1.0; // Full trust for whitelisted domains
    }

    // Check if subdomain of trusted domain
    for (const trustedDomain of this.config.trustedDomains) {
      if (domain.endsWith(`.${trustedDomain}`)) {
        return 0.8; // Partial trust for subdomains
      }
    }

    return 0.3; // Unknown domain = low trust
  }

  /**
   * Validate cryptographic signature
   *
   * @param chunk - Chunk
   * @returns True if signature is valid
   */
  private validateSignature(chunk: Chunk): boolean {
    const signature = chunk.meta?.signature as string | undefined;

    if (!signature) {
      return false; // No signature
    }

    // TODO: Implement actual signature validation
    // For now, just check if signature exists and looks valid
    return signature.length >= 64; // SHA-256 length
  }

  /**
   * Score freshness (time decay)
   *
   * @param chunk - Chunk
   * @returns Freshness score (0-1)
   */
  private scoreFreshness(chunk: Chunk): number {
    const timestamp = chunk.meta?.timestamp as Date | string | undefined;

    if (!timestamp) {
      return 0.5; // No timestamp = assume medium age
    }

    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay with half-life
    // freshness = 2^(-age/halfLife)
    const freshness = Math.pow(2, -ageInDays / this.config.freshnessHalfLife);

    return Math.max(0.3, Math.min(1.0, freshness)); // Clamp to [0.3, 1.0]
  }

  /**
   * Score author reputation
   *
   * @param chunk - Chunk
   * @returns Author reputation score (0-1)
   */
  private scoreAuthor(chunk: Chunk): number {
    const author = chunk.meta?.author as string | undefined;

    if (!author) {
      return 0.5; // No author = medium trust
    }

    // Check if author is known
    const reputation = this.config.knownAuthors.get(author);

    if (reputation !== undefined) {
      return reputation;
    }

    return 0.5; // Unknown author = medium trust
  }

  /**
   * Add trusted domain
   *
   * @param domain - Domain to trust
   */
  addTrustedDomain(domain: string): void {
    this.config.trustedDomains.add(domain);
  }

  /**
   * Remove trusted domain
   *
   * @param domain - Domain to remove
   */
  removeTrustedDomain(domain: string): void {
    this.config.trustedDomains.delete(domain);
  }

  /**
   * Set author reputation
   *
   * @param author - Author identifier
   * @param reputation - Reputation score (0-1)
   */
  setAuthorReputation(author: string, reputation: number): void {
    this.config.knownAuthors.set(author, Math.max(0, Math.min(1, reputation)));
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<TrustConfig> {
    return {
      ...this.config,
      trustedDomains: new Set(this.config.trustedDomains),
      knownAuthors: new Map(this.config.knownAuthors),
    };
  }
}
