/**
 * Quality Domain Models
 *
 * Purpose:
 * - Define core quality assessment domain models
 * - Type-safe interfaces for quality metrics
 * - Shared types across quality system
 *
 * Phase: All phases (0-4)
 * Version: 1.0.0
 */

// ============================================================================
// QA Pair Types
// ============================================================================

export interface QAPair {
  id: string;
  question: string;
  answer: string;
  evidence?: string[];
  metadata?: {
    source?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Quality Metrics
// ============================================================================

/**
 * Quality metric result from a checker
 */
export interface QualityMetric {
  dimension: string; // 측정 차원 (예: "guideline_compliance", "retrieval_quality")
  score: number; // 0~1 사이 점수
  confidence: number; // 0~1 사이 신뢰도
  details?: QualityMetricDetails;
}

export interface QualityMetricDetails {
  violations?: Violation[];
  recommendations?: Recommendation[];
  breakdown?: Record<string, number>;
  evidence?: unknown;
}

export interface Violation {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  description: string;
  location?: {
    qaId: string;
    field: "question" | "answer";
  };
  suggestion?: string;
}

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  category: string;
  description: string;
  actionable: boolean;
}

// ============================================================================
// Quality Checker Interface
// ============================================================================

/**
 * Base interface for all quality checkers
 */
export interface QualityChecker {
  name: string;
  version: string;
  phase: "Phase 0" | "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4";

  /**
   * Check quality of QA pairs
   */
  check(qaPairs: QAPair[]): Promise<QualityResult>;
}

export interface QualityResult {
  metrics: QualityMetric[];
  summary: QualitySummary;
  timestamp: string;
  checkerVersion: string;
}

export interface QualitySummary {
  totalChecked: number;
  overallScore: number; // 0~1 종합 점수
  passRate: number; // 임계치 통과 비율
  violationCount: number;
  recommendationCount: number;
}

// ============================================================================
// Compliance Types (Phase 1 specific)
// ============================================================================

export interface ComplianceCheckResult {
  questionTypeCompliance: ComplianceDimension;
  answerStructureCompliance: ComplianceDimension;
  numberFormatCompliance: ComplianceDimension;
  prohibitionCompliance: ComplianceDimension;
  overallScore: number;
}

export interface ComplianceDimension {
  score: number; // 0~1
  weight: number; // 가중치
  violations: Violation[];
  passedCount: number;
  failedCount: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface QualityConfig {
  version: string;
  phase: "Phase 0" | "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4";
  thresholds: QualityThresholds;
  weights: QualityWeights;
  features: FeatureFlags;
}

export interface QualityThresholds {
  guideline_compliance: number; // Phase 1
  retrieval_quality_score?: number; // Phase 2
  semantic_quality?: number; // Phase 3-4
}

export interface QualityWeights {
  questionType: number; // 질문 유형 가중치
  answerStructure: number; // 답변 구조 가중치
  numberFormat: number; // 숫자 표현 가중치
  prohibition: number; // 금지 사항 가중치
}

export interface FeatureFlags {
  FEATURE_GUIDELINE_GATE: boolean;
  FEATURE_EVIDENCE_GATE?: boolean;
  FEATURE_QUALITY_HYBRID_SEARCH?: boolean;
  FEATURE_QUALITY_RAGAS_EVAL?: boolean;
  FEATURE_QUALITY_MULTIVIEW_EMBEDDING?: boolean;
  FEATURE_QUALITY_QUERYSIDE_EMBEDDING?: boolean;
  FEATURE_QUALITY_TRANSLATION_EMBEDDING?: boolean;
}

// ============================================================================
// Report Types
// ============================================================================

export interface QualityReport {
  schemaVersion: string;
  timestamp: string;
  phase: string;
  guideline_compliance?: GuidelineComplianceReport;
  evidence_metrics?: EvidenceMetricsReport;
  shadow_metrics?: ShadowMetricsReport;
  violations: Violation[];
  recommendations: Recommendation[];
}

export interface GuidelineComplianceReport {
  score: number;
  version: string;
  breakdown: {
    question_types: number;
    answer_structure: number;
    number_formats: number;
    prohibitions: number;
  };
}

export interface EvidenceMetricsReport {
  snippet_alignment: number;
  citation_presence: number;
  context_precision: number;
  context_recall: number;
  retrieval_quality_score: number;
}

export interface ShadowMetricsReport {
  hybrid_search?: {
    improvement_delta: number;
    bm25_avg: number;
    vector_avg: number;
    hybrid_avg: number;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type GateResult = "PASS" | "WARN" | "PARTIAL" | "FAIL";

export interface GateDecision {
  result: GateResult;
  phase: string;
  score: number;
  threshold: number;
  reason: string;
  canProceed: boolean;
}
