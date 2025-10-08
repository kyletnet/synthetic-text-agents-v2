/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Trust Token Verifier
 *
 * Purpose:
 * - Verify JWT + C2PA signatures
 * - Validate token expiration and integrity
 * - Enable auditor-side verification
 *
 * Phase: v3.2.1 - Trust Infrastructure
 */

import { createHash } from "node:crypto";
import type {
  TrustToken,
  TrustTokenPayload,
  TrustTokenVerificationResult,
} from "./trust-token-types.js";

/**
 * Trust Token Verifier
 *
 * Verifies trust tokens for authenticity and validity
 */
export class TrustTokenVerifier {
  /**
   * Verify Trust Token
   */
  async verify(token: TrustToken): Promise<TrustTokenVerificationResult> {
    try {
      // 1. Verify JWT structure
      if (!this.isValidJWTStructure(token.encoded)) {
        return {
          valid: false,
          error: "Invalid JWT structure",
          timestamp: new Date(),
        };
      }

      // 2. Verify JWT signature (simplified)
      if (!this.verifyJWTSignature(token.encoded)) {
        return {
          valid: false,
          error: "Invalid JWT signature",
          timestamp: new Date(),
        };
      }

      // 3. Verify expiration
      const now = Math.floor(Date.now() / 1000);
      if (token.payload.exp < now) {
        return {
          valid: false,
          error: `Token expired at ${new Date(token.payload.exp * 1000).toISOString()}`,
          timestamp: new Date(),
        };
      }

      // 4. Verify not-before
      if (token.payload.nbf > now) {
        return {
          valid: false,
          error: `Token not valid until ${new Date(token.payload.nbf * 1000).toISOString()}`,
          timestamp: new Date(),
        };
      }

      // 5. Verify C2PA signature (placeholder)
      if (!this.verifyC2PASignature(token)) {
        return {
          valid: false,
          error: "Invalid C2PA signature",
          timestamp: new Date(),
        };
      }

      return {
        valid: true,
        payload: token.payload,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Verify JWT structure (3 parts: header.payload.signature)
   */
  private isValidJWTStructure(jwt: string): boolean {
    const parts = jwt.split(".");
    return parts.length === 3;
  }

  /**
   * Verify JWT signature (simplified)
   *
   * Note: In production, use 'jsonwebtoken' library with public key
   */
  private verifyJWTSignature(jwt: string): boolean {
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Recompute signature
    const expectedSignature = createHash("sha256")
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    return signatureB64 === expectedSignature;
  }

  /**
   * Verify C2PA signature (placeholder)
   *
   * Note: In production, use C2PA library
   */
  private verifyC2PASignature(token: TrustToken): boolean {
    // Placeholder: Always return true
    // In production, verify C2PA manifest + certificate chain
    return token.c2pa.signature.length > 0;
  }

  /**
   * Decode JWT payload (without verification)
   */
  decodePayload(jwt: string): TrustTokenPayload | null {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) return null;

      const payloadB64 = parts[1];
      const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
      return JSON.parse(payloadJson) as TrustTokenPayload;
    } catch {
      return null;
    }
  }
}

/**
 * Create default Trust Token Verifier
 */
export function createTrustTokenVerifier(): TrustTokenVerifier {
  return new TrustTokenVerifier();
}
