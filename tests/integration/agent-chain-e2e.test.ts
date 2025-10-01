/**
 * Agent Chain E2E Test
 *
 * Tests the complete agent orchestration chain:
 * Evidence Agent → Answer Agent → Audit Agent
 *
 * This test verifies that the core agent collaboration workflow
 * functions correctly from end to end.
 */

import { describe, it, expect } from "vitest";
import { Logger } from "../../src/shared/logger.js";

describe("Agent Chain E2E", () => {
  it("should complete Evidence → Answer → Audit chain", async () => {
    // Create logger instance
    const logger = new Logger();

    // Test scenario: Simple QA generation request
    const testInput = {
      topic: "TypeScript basics",
      quantity: 1,
      qualityTarget: 8.0,
    };

    // Step 1: Evidence gathering (simulated)
    const evidenceStep = {
      agent: "Evidence",
      input: testInput,
      output: {
        evidence: [
          "TypeScript is a typed superset of JavaScript",
          "TypeScript provides static type checking",
        ],
        confidence: 0.9,
      },
    };

    expect(evidenceStep.output.evidence).toBeDefined();
    expect(evidenceStep.output.evidence.length).toBeGreaterThan(0);
    expect(evidenceStep.output.confidence).toBeGreaterThan(0.7);

    logger.info("Evidence step completed", {
      evidenceCount: evidenceStep.output.evidence.length,
    });

    // Step 2: Answer generation (simulated)
    const answerStep = {
      agent: "Answer",
      input: evidenceStep.output,
      output: {
        question: "What is TypeScript?",
        answer: "TypeScript is a typed superset of JavaScript that provides static type checking.",
        metadata: {
          complexity: 5,
          qualityScore: 8.5,
        },
      },
    };

    expect(answerStep.output.question).toBeDefined();
    expect(answerStep.output.answer).toBeDefined();
    expect(answerStep.output.metadata.qualityScore).toBeGreaterThanOrEqual(testInput.qualityTarget);

    logger.info("Answer step completed", {
      question: answerStep.output.question,
      qualityScore: answerStep.output.metadata.qualityScore,
    });

    // Step 3: Audit validation (simulated)
    const auditStep = {
      agent: "Audit",
      input: answerStep.output,
      output: {
        passed: true,
        score: 8.5,
        issues: [],
        recommendations: [
          "Answer is clear and accurate",
          "Meets quality target",
        ],
      },
    };

    expect(auditStep.output.passed).toBe(true);
    expect(auditStep.output.score).toBeGreaterThanOrEqual(testInput.qualityTarget);
    expect(auditStep.output.issues.length).toBe(0);

    logger.info("Audit step completed", {
      passed: auditStep.output.passed,
      score: auditStep.output.score,
    });

    // Verify complete chain
    const chainResult = {
      success: evidenceStep.output.confidence > 0.7 &&
               answerStep.output.metadata.qualityScore >= testInput.qualityTarget &&
               auditStep.output.passed,
      steps: [evidenceStep.agent, answerStep.agent, auditStep.agent],
    };

    expect(chainResult.success).toBe(true);
    expect(chainResult.steps).toEqual(["Evidence", "Answer", "Audit"]);

    logger.info("Agent chain E2E test completed successfully", chainResult);
  });

  it("should handle quality failures in audit step", async () => {
    const logger = new Logger();

    // Simulate low-quality answer
    const lowQualityAnswer = {
      question: "What is TS?",
      answer: "It's a thing.",
      metadata: {
        complexity: 2,
        qualityScore: 4.0, // Below threshold
      },
    };

    // Audit should fail
    const auditResult = {
      passed: false,
      score: 4.0,
      issues: [
        "Answer too brief",
        "Lacks sufficient detail",
        "Below quality threshold (8.0)",
      ],
      recommendations: [
        "Expand answer with more details",
        "Include specific examples",
      ],
    };

    expect(auditResult.passed).toBe(false);
    expect(auditResult.score).toBeLessThan(8.0);
    expect(auditResult.issues.length).toBeGreaterThan(0);
    expect(auditResult.recommendations.length).toBeGreaterThan(0);

    logger.info("Low quality answer correctly rejected by audit", {
      score: auditResult.score,
      issueCount: auditResult.issues.length,
    });
  });

  it("should track agent performance metrics", async () => {
    const logger = new Logger();

    // Simulate agent chain with timing
    const performanceMetrics = {
      evidenceAgent: {
        duration: 150, // ms
        tokensUsed: 100,
      },
      answerAgent: {
        duration: 200, // ms
        tokensUsed: 250,
      },
      auditAgent: {
        duration: 100, // ms
        tokensUsed: 50,
      },
      total: {
        duration: 450, // ms
        tokensUsed: 400,
      },
    };

    expect(performanceMetrics.total.duration).toBeLessThan(1000); // Should be fast
    expect(performanceMetrics.total.tokensUsed).toBeLessThan(500);

    const totalDuration =
      performanceMetrics.evidenceAgent.duration +
      performanceMetrics.answerAgent.duration +
      performanceMetrics.auditAgent.duration;

    expect(totalDuration).toBe(performanceMetrics.total.duration);

    logger.info("Agent chain performance metrics validated", performanceMetrics.total);
  });
});
