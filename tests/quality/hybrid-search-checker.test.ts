/**
 * Hybrid Search Checker Tests
 *
 * Purpose: TDD tests for Phase 3 Hybrid Search implementation
 * Approach: Test-Driven Development - Write tests first, then fix implementation
 */

import { describe, it, expect } from "vitest";
import { HybridSearchChecker } from "../../scripts/quality/checkers/hybrid-search-checker.js";
import type { QAPair } from "../../scripts/quality/models/quality-domain.js";

// Test data (Phase 2 sample)
const testQAPairs: QAPair[] = [
  {
    id: "qa-p2-001",
    question: "보건휴가는 한 달에 며칠 사용할 수 있나요?",
    answer:
      "보건휴가는 여성 직원이 청구하는 경우 월 1일의 유급 보건휴가를 부여받을 수 있습니다.",
    evidence: [
      "여성 직원이 보건휴가를 청구하는 경우 월 1일의 유급 보건휴가를 부여한다.",
      "보건휴가는 여성 직원에게만 적용되며, 월 1회 사용 가능하다.",
    ],
    metadata: { source: "phase2-sample" },
  },
  {
    id: "qa-p2-002",
    question: "3년 이상 근무한 직원이 받을 수 있는 연차휴가 일수는 얼마인가요?",
    answer:
      "3년 이상 계속 근로한 직원은 기본 15일의 연차휴가에 최초 1년을 초과하는 계속 근로연수 매 2년마다 1일씩 가산한 유급휴가를 받을 수 있습니다. 이 경우 가산휴가를 포함한 총 휴가일수는 25일을 한도로 합니다.",
    evidence: [
      "1년간 80퍼센트 이상 출근한 직원에게는 15일의 유급휴가를 부여한다.",
      "3년 이상 계속 근로한 직원에게는 최초 1년을 초과하는 계속 근로연수 매 2년에 대하여 1일을 가산한 유급휴가를 부여한다.",
      "가산휴가를 포함한 총 휴가일수는 25일을 한도로 한다.",
    ],
    metadata: { source: "phase2-sample" },
  },
  {
    id: "qa-p2-003",
    question:
      "본인 결혼과 자녀 결혼 시 받을 수 있는 경조금과 휴가는 각각 얼마인가요?",
    answer:
      "본인 결혼의 경우 경조금 50만원과 5일의 휴가를 받을 수 있으며, 자녀 결혼의 경우 경조금 20만원과 1일의 휴가를 받을 수 있습니다.",
    evidence: [
      "본인 결혼: 경조금 50만원, 휴가 5일",
      "자녀 결혼: 경조금 20만원, 휴가 1일",
      "경조사별 경조금 및 휴가 일수는 취업규칙 별표에 명시되어 있다.",
    ],
    metadata: { source: "phase2-sample" },
  },
];

describe("HybridSearchChecker - BM25 Scoring", () => {
  const checker = new HybridSearchChecker();

  it("should return BM25 score > 0 for matching terms", async () => {
    const result = await checker.check(testQAPairs);

    const bm25Metric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_bm25",
    );

    expect(bm25Metric).toBeDefined();
    expect(bm25Metric!.score).toBeGreaterThan(0);

    // Should be at least 10% for good matches
    expect(bm25Metric!.score).toBeGreaterThan(0.1);
  });

  it("should handle small corpus (N=3) without negative IDF", async () => {
    const result = await checker.check(testQAPairs);

    const bm25Metric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_bm25",
    );

    // All individual scores should be non-negative
    const evidence = bm25Metric!.details?.evidence as Array<{
      qaId: string;
      score: number;
    }>;

    for (const item of evidence) {
      expect(item.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("should normalize BM25 scores to reasonable range (0-1)", async () => {
    const result = await checker.check(testQAPairs);

    const bm25Metric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_bm25",
    );

    expect(bm25Metric!.score).toBeLessThanOrEqual(1.0);
    expect(bm25Metric!.score).toBeGreaterThanOrEqual(0);
  });
});

describe("HybridSearchChecker - Vector Similarity", () => {
  const checker = new HybridSearchChecker();

  it("should return vector score > 0 for similar text", async () => {
    const result = await checker.check(testQAPairs);

    const vectorMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_vector",
    );

    expect(vectorMetric).toBeDefined();
    expect(vectorMetric!.score).toBeGreaterThan(0);

    // Should be at least 20% for question-evidence matching
    expect(vectorMetric!.score).toBeGreaterThan(0.2);
  });

  it("should handle keyword overlap effectively", async () => {
    const result = await checker.check(testQAPairs);

    const vectorMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_vector",
    );

    // Test data has good keyword overlap, expect > 30%
    expect(vectorMetric!.score).toBeGreaterThan(0.3);
  });

  it("should normalize vector scores to 0-1 range", async () => {
    const result = await checker.check(testQAPairs);

    const vectorMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_vector",
    );

    expect(vectorMetric!.score).toBeLessThanOrEqual(1.0);
    expect(vectorMetric!.score).toBeGreaterThanOrEqual(0);
  });
});

describe("HybridSearchChecker - Hybrid Scoring", () => {
  const checker = new HybridSearchChecker();

  it("should combine BM25 and Vector scores", async () => {
    const result = await checker.check(testQAPairs);

    const bm25Metric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_bm25",
    );
    const vectorMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_vector",
    );
    const hybridMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_combined",
    );

    expect(hybridMetric).toBeDefined();

    // Hybrid should be weighted average (α=0.7 for vector, 0.3 for bm25)
    const expectedHybrid =
      0.7 * vectorMetric!.score + 0.3 * bm25Metric!.score;

    expect(hybridMetric!.score).toBeCloseTo(expectedHybrid, 2);
  });

  it("should show improvement over baseline", async () => {
    const result = await checker.check(testQAPairs);

    const hybridMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_combined",
    );

    const improvementDelta =
      hybridMetric!.details?.breakdown?.improvement_delta;
    const baseline = hybridMetric!.details?.breakdown?.baseline;

    expect(baseline).toBeDefined();
    expect(improvementDelta).toBeDefined();

    // Hybrid should be better than simple baseline
    expect(improvementDelta).toBeGreaterThan(0);
  });

  it("should achieve improvement_delta >= 5% (Gate C requirement)", async () => {
    const result = await checker.check(testQAPairs);

    const hybridMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_combined",
    );

    const improvementDelta =
      hybridMetric!.details?.breakdown?.improvement_delta;

    // Gate C requirement: >= +5% improvement
    expect(improvementDelta).toBeGreaterThanOrEqual(0.05);
  });
});

describe("HybridSearchChecker - Edge Cases", () => {
  const checker = new HybridSearchChecker();

  it("should handle QA pairs without evidence gracefully", async () => {
    const qaPairsNoEvidence: QAPair[] = [
      {
        id: "test-no-evidence",
        question: "테스트 질문",
        answer: "테스트 답변",
        evidence: [],
        metadata: { source: "test" },
      },
    ];

    const result = await checker.check(qaPairsNoEvidence);

    expect(result.summary.totalChecked).toBe(0);
    expect(result.metrics.length).toBeGreaterThan(0);
  });

  it("should handle empty corpus", async () => {
    const result = await checker.check([]);

    expect(result.summary.totalChecked).toBe(0);
    expect(result.summary.overallScore).toBe(0);
  });

  it("should be deterministic (same input → same output)", async () => {
    const result1 = await checker.check(testQAPairs);
    const result2 = await checker.check(testQAPairs);

    const hybrid1 = result1.metrics.find(
      (m) => m.dimension === "hybrid_search_combined",
    );
    const hybrid2 = result2.metrics.find(
      (m) => m.dimension === "hybrid_search_combined",
    );

    expect(hybrid1!.score).toBe(hybrid2!.score);
  });
});

describe("HybridSearchChecker - Real Phase 2 Data", () => {
  const checker = new HybridSearchChecker();

  it("should pass Gate C requirements on Phase 2 sample data", async () => {
    const result = await checker.check(testQAPairs);

    // Gate C Requirements:
    // 1. improvement_delta >= +5%
    // 2. BM25 > 0
    // 3. Vector > 0
    // 4. Hybrid > baseline

    const bm25Metric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_bm25",
    );
    const vectorMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_vector",
    );
    const hybridMetric = result.metrics.find(
      (m) => m.dimension === "hybrid_search_combined",
    );

    const improvementDelta =
      hybridMetric!.details?.breakdown?.improvement_delta;
    const baseline = hybridMetric!.details?.breakdown?.baseline;

    expect(bm25Metric!.score).toBeGreaterThan(0);
    expect(vectorMetric!.score).toBeGreaterThan(0);
    expect(hybridMetric!.score).toBeGreaterThan(baseline);
    expect(improvementDelta).toBeGreaterThanOrEqual(0.05);
  });
});
