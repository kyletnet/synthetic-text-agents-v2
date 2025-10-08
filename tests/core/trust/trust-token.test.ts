/**
 * Trust Token Tests
 *
 * Validates TrustToken generation and verification
 */

import { describe, it, expect } from "vitest";
import {
  TrustTokenGenerator,
  TrustTokenVerifier,
} from "../../../src/core/trust/index.js";
import type {
  TrustMetrics,
  EvidenceTrace,
  ComplianceContext,
} from "../../../src/core/trust/index.js";

describe("Trust Token System", () => {
  const generator = new TrustTokenGenerator();
  const verifier = new TrustTokenVerifier();

  const mockTrustMetrics: TrustMetrics = {
    groundedness: 0.92,
    alignment: 0.88,
    faithfulness: 0.95,
  };

  const mockEvidence: EvidenceTrace = {
    sourceIds: ["chunk-1", "chunk-2", "chunk-3"],
    trustScores: [0.9, 0.85, 0.95],
    retrievalStrategy: "bm25",
  };

  const mockCompliance: ComplianceContext = {
    gdpr: true,
    ccpa: true,
    hipaa: false,
  };

  describe("TrustTokenGenerator", () => {
    it("should generate valid trust token", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      expect(token).toBeDefined();
      expect(token.header.alg).toBe("RS256");
      expect(token.header.typ).toBe("JWT");
      expect(token.payload.sub).toBe("tenant-123");
      expect(token.payload.iss).toBe("synthetic-agents.ai");
      expect(token.encoded).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it("should include trust metrics in payload", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      expect(token.payload.trustScore.groundedness).toBe(0.92);
      expect(token.payload.trustScore.alignment).toBe(0.88);
      expect(token.payload.trustScore.faithfulness).toBe(0.95);
    });

    it("should include evidence trace", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      expect(token.payload.evidence.sourceIds).toHaveLength(3);
      expect(token.payload.evidence.retrievalStrategy).toBe("bm25");
    });

    it("should include compliance context", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      expect(token.payload.compliance.gdpr).toBe(true);
      expect(token.payload.compliance.ccpa).toBe(true);
      expect(token.payload.compliance.hipaa).toBe(false);
    });

    it("should set expiration (7 days default)", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      const expectedExpiration = token.payload.iat + 7 * 24 * 60 * 60;
      expect(token.payload.exp).toBe(expectedExpiration);
    });

    it("should generate content hash", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      expect(token.payload.contentHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it("should generate C2PA signature", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      expect(token.c2pa.manifest).toMatch(/^c2pa:\/\/manifests\//);
      expect(token.c2pa.signature).toBeDefined();
      expect(token.c2pa.certificate).toBeDefined();
    });
  });

  describe("TrustTokenVerifier", () => {
    it("should verify valid token", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123" },
      );

      const result = await verifier.verify(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should reject token with invalid structure", async () => {
      const invalidToken = {
        header: { alg: "RS256" as const, typ: "JWT" as const, kid: "test" },
        payload: {} as any,
        c2pa: {
          manifest: "",
          signature: "",
          certificate: "",
        },
        encoded: "invalid.structure",
      };

      const result = await verifier.verify(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid JWT structure");
    });

    it("should reject expired token", async () => {
      const token = await generator.generate(
        "test content",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        { tenantId: "tenant-123", expiresIn: -1 }, // Expired 1 second ago
      );

      const result = await verifier.verify(token);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Token expired");
    });

    it("should decode payload without verification", () => {
      const jwt =
        "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRlc3QifQ.eyJzdWIiOiJ0ZW5hbnQtMTIzIn0.signature";
      const payload = verifier.decodePayload(jwt);

      expect(payload).toBeDefined();
      expect(payload?.sub).toBe("tenant-123");
    });

    it("should return null for invalid JWT in decode", () => {
      const payload = verifier.decodePayload("invalid");
      expect(payload).toBeNull();
    });
  });

  describe("End-to-End Trust Flow", () => {
    it("should generate, verify, and decode token", async () => {
      // Generate token
      const token = await generator.generate(
        "sensitive data requiring proof",
        mockTrustMetrics,
        mockEvidence,
        mockCompliance,
        {
          tenantId: "healthcare-tenant",
          audience: "auditor",
        },
      );

      // Verify token
      const verificationResult = await verifier.verify(token);
      expect(verificationResult.valid).toBe(true);

      // Decode payload
      const decodedPayload = verifier.decodePayload(token.encoded);
      expect(decodedPayload?.sub).toBe("healthcare-tenant");
      expect(decodedPayload?.aud).toBe("auditor");

      // Validate trust metrics
      expect(decodedPayload?.trustScore.groundedness).toBe(0.92);
    });
  });
});
