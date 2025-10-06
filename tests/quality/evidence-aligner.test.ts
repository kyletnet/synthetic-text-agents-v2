/**
 * Evidence Aligner Tests
 *
 * Purpose: Test alignment algorithm improvements
 * Approach: TDD - Write tests first, then implement
 */

import { describe, it, expect } from "vitest";
import { EvidenceAligner } from "../../scripts/quality/checkers/evidence-aligner.js";

describe("EvidenceAligner - Template Normalization", () => {
  const aligner = new EvidenceAligner();

  it("should match abbreviated vs full form (본인 결혼 case)", async () => {
    // Abbreviated form in evidence
    const evidence = ["본인 결혼: 경조금 50만원, 휴가 5일"];

    // Full sentence form in answer
    const answer = "본인 결혼의 경우 경조금 50만원과 5일의 휴가를 받을 수 있습니다.";

    const qaPairs = [
      {
        id: "test-001",
        question: "테스트",
        answer,
        evidence,
        metadata: { source: "test" },
      },
    ];

    const result = await aligner.check(qaPairs);
    const alignmentMetric = result.metrics.find(
      (m) => m.dimension === "snippet_alignment",
    );

    // Should be >= 60% after normalization
    expect(alignmentMetric?.score).toBeGreaterThanOrEqual(0.6);
  });

  it("should match structured data patterns", async () => {
    const evidence = ["자녀 결혼: 경조금 20만원, 휴가 1일"];
    const answer = "자녀 결혼의 경우 경조금 20만원과 1일의 휴가를 받을 수 있습니다.";

    const qaPairs = [
      {
        id: "test-002",
        question: "테스트",
        answer,
        evidence,
        metadata: { source: "test" },
      },
    ];

    const result = await aligner.check(qaPairs);
    const alignmentMetric = result.metrics.find(
      (m) => m.dimension === "snippet_alignment",
    );

    expect(alignmentMetric?.score).toBeGreaterThanOrEqual(0.6);
  });

  it("should handle multiple evidence snippets with different formats", async () => {
    const evidence = [
      "1년간 80퍼센트 이상 출근한 직원에게는 15일의 유급휴가를 부여한다.",
      "3년 이상 계속 근로한 직원에게는 최초 1년을 초과하는 계속 근로연수 매 2년에 대하여 1일을 가산한 유급휴가를 부여한다.",
      "가산휴가를 포함한 총 휴가일수는 25일을 한도로 한다.",
    ];

    const answer =
      "3년 이상 계속 근로한 직원은 기본 15일의 연차휴가에 최초 1년을 초과하는 계속 근로연수 매 2년마다 1일씩 가산한 유급휴가를 받을 수 있습니다. 이 경우 가산휴가를 포함한 총 휴가일수는 25일을 한도로 합니다.";

    const qaPairs = [
      {
        id: "test-003",
        question: "테스트",
        answer,
        evidence,
        metadata: { source: "test" },
      },
    ];

    const result = await aligner.check(qaPairs);
    const alignmentMetric = result.metrics.find(
      (m) => m.dimension === "snippet_alignment",
    );

    // This is a harder case, accept >= 50%
    expect(alignmentMetric?.score).toBeGreaterThanOrEqual(0.5);
  });
});

describe("EvidenceAligner - N-gram Matching", () => {
  const aligner = new EvidenceAligner();

  it("should match phrases even with slight variations", async () => {
    const evidence = ["월 1일의 유급 보건휴가를 부여한다"];
    const answer = "월 1일의 유급 보건휴가를 부여받을 수 있습니다";

    const qaPairs = [
      {
        id: "test-004",
        question: "테스트",
        answer,
        evidence,
        metadata: { source: "test" },
      },
    ];

    const result = await aligner.check(qaPairs);
    const alignmentMetric = result.metrics.find(
      (m) => m.dimension === "snippet_alignment",
    );

    // Very similar text should have high alignment
    expect(alignmentMetric?.score).toBeGreaterThanOrEqual(0.7);
  });
});

describe("EvidenceAligner - Real Phase 2 Data", () => {
  const aligner = new EvidenceAligner();

  it("should achieve >= 60% average on Phase 2 sample data", async () => {
    // This will be the final acceptance test
    const qaPairs = [
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

    const result = await aligner.check(qaPairs);
    const alignmentMetric = result.metrics.find(
      (m) => m.dimension === "snippet_alignment",
    );

    // TARGET: >= 60% average alignment
    expect(alignmentMetric?.score).toBeGreaterThanOrEqual(0.6);
  });
});
