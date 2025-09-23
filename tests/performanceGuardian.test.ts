import { describe, it, expect } from "vitest";
import { PerformanceGuardian } from "../src/core/performanceGuardian.js";
import { AgentResult } from "../src/shared/types.js";

const guardian = new PerformanceGuardian();

const createMockResult = (
  overrides: Partial<AgentResult> = {},
): AgentResult => ({
  agentId: "test-agent",
  result: "test output",
  confidence: 0.8,
  reasoning: "Test reasoning",
  performance: {
    duration: 1000,
    tokensUsed: 100,
    qualityScore: 8.0,
  },
  ...overrides,
});

describe("PerformanceGuardian", () => {
  it("passes when within thresholds", () => {
    const result = createMockResult({
      performance: { duration: 1000, tokensUsed: 100, qualityScore: 8.0 },
    });

    const evaluated = guardian.evaluate(result);
    expect(evaluated.ok).toBe(true);
    expect(evaluated.vetoed).toBe(false);
    expect(evaluated.issues).toBeUndefined();
    expect(evaluated.reasoning).toContain("Guardian approved");
  });

  it("fails when qualityScore too low", () => {
    const result = createMockResult({
      performance: { duration: 1000, tokensUsed: 100, qualityScore: 3.0 },
    });

    const evaluated = guardian.evaluate(result);
    expect(evaluated.ok).toBe(false);
    expect(evaluated.vetoed).toBe(true);
    expect(evaluated.issues?.[0]).toContain("qualityScore");
    expect(evaluated.reasoning).toContain("Guardian vetoed");
  });

  it("fails when latency too high", () => {
    const result = createMockResult({
      performance: { duration: 35000, tokensUsed: 100, qualityScore: 8.0 },
    });

    const evaluated = guardian.evaluate(result);
    expect(evaluated.ok).toBe(false);
    expect(evaluated.vetoed).toBe(true);
    expect(evaluated.issues?.[0]).toContain("duration");
    expect(evaluated.reasoning).toContain("Guardian vetoed");
  });

  it("fails when both quality and latency are bad", () => {
    const result = createMockResult({
      performance: { duration: 35000, tokensUsed: 100, qualityScore: 3.0 },
    });

    const evaluated = guardian.evaluate(result);
    expect(evaluated.ok).toBe(false);
    expect(evaluated.vetoed).toBe(true);
    expect(evaluated.issues?.length).toBe(2);
    expect(evaluated.issues?.[0]).toContain("qualityScore");
    expect(evaluated.issues?.[1]).toContain("duration");
  });

  it("preserves original result data", () => {
    const originalResult = createMockResult({
      agentId: "specific-agent",
      result: "specific output",
      confidence: 0.9,
    });

    const evaluated = guardian.evaluate(originalResult);
    expect(evaluated.agentId).toBe("specific-agent");
    expect(evaluated.result).toBe("specific output");
    expect(evaluated.confidence).toBe(0.9);
  });
});
