/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Trust Token Types
 *
 * Purpose:
 * - Define TrustToken structure (JWT + C2PA)
 * - Provide cryptographic proof of trust claims
 * - Enable independent verification by auditors
 *
 * Phase: v3.2.1 - Trust Infrastructure
 */

/**
 * Trust Token Header (JWT)
 */
export interface TrustTokenHeader {
  alg: "RS256"; // RSA signature algorithm
  typ: "JWT";
  kid: string; // Key ID for rotation
}

/**
 * Trust Metrics
 */
export interface TrustMetrics {
  groundedness: number; // 0-1 scale
  alignment: number; // 0-1 scale
  faithfulness: number; // 0-1 scale
}

/**
 * Evidence Traceability
 */
export interface EvidenceTrace {
  sourceIds: string[]; // Chunk IDs
  trustScores: number[]; // Per-source trust
  retrievalStrategy: "bm25" | "vector" | "hybrid";
}

/**
 * Compliance Context
 */
export interface ComplianceContext {
  gdpr: boolean;
  ccpa: boolean;
  hipaa: boolean;
}

/**
 * Trust Token Payload (JWT)
 */
export interface TrustTokenPayload {
  // Unique identifier
  id: string; // UUID v7
  timestamp: string; // ISO 8601
  contentHash: string; // SHA-256 hash of output

  // Trust Metrics
  trustScore: TrustMetrics;

  // Evidence Traceability
  evidence: EvidenceTrace;

  // Compliance Context
  compliance: ComplianceContext;

  // Issuer Identity (JWT standard claims)
  iss: string; // "synthetic-agents.ai"
  sub: string; // Customer tenant ID
  aud: string; // Intended verifier (customer/auditor/regulator)

  // Validity (JWT standard claims)
  iat: number; // Issued at (Unix timestamp)
  exp: number; // Expires at (7 days default)
  nbf: number; // Not before
}

/**
 * C2PA Signature (Content Provenance)
 */
export interface C2PASignature {
  manifest: string; // C2PA manifest URL
  signature: string; // Digital signature
  certificate: string; // X.509 certificate chain
}

/**
 * Trust Token (Complete)
 */
export interface TrustToken {
  // JWT Header
  header: TrustTokenHeader;

  // JWT Payload
  payload: TrustTokenPayload;

  // C2PA Signature
  c2pa: C2PASignature;

  // JWT Encoded (for transmission)
  encoded: string;
}

/**
 * Trust Token Generation Options
 */
export interface TrustTokenOptions {
  tenantId: string;
  audience?: string; // Default: "customer"
  expiresIn?: number; // Default: 7 days (in seconds)
}

/**
 * Trust Token Verification Result
 */
export interface TrustTokenVerificationResult {
  valid: boolean;
  payload?: TrustTokenPayload;
  error?: string;
  timestamp: Date;
}
