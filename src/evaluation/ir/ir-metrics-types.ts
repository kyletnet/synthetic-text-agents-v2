/**
 * IR (Information Retrieval) Metrics Types
 *
 * 비용 0원으로 검색 품질을 측정하는 표준 IR 지표
 * LLM-RAGAS와 교차 검증용으로 사용
 *
 * Phase 6 Day 2
 */

/**
 * 검색 결과 아이템 (순위 포함)
 */
export interface SearchResult {
  /** 문서/청크 ID */
  id: string;
  /** 검색 점수 */
  score: number;
  /** 순위 (1부터 시작) */
  rank: number;
  /** 실제 정답 여부 */
  isRelevant: boolean;
}

/**
 * IR Metrics 입력
 */
export interface IRMetricsInput {
  /** 쿼리 ID */
  queryId: string;
  /** 질의문 */
  query: string;
  /** 검색 결과 리스트 (순위순) */
  results: SearchResult[];
  /** Ground Truth (정답 문서 ID 리스트) */
  groundTruth: string[];
  /** 평가할 K 값 (기본: 5) */
  k?: number;
}

/**
 * IR Metrics 출력
 */
export interface IRMetricsOutput {
  /** Query ID */
  queryId: string;
  /** NDCG@K (Normalized Discounted Cumulative Gain) */
  ndcg: number;
  /** mAP@K (Mean Average Precision) */
  map: number;
  /** F1@K (Precision + Recall 조화 평균) */
  f1: number;
  /** MRR (Mean Reciprocal Rank) */
  mrr: number;
  /** Precision@K */
  precision: number;
  /** Recall@K */
  recall: number;
  /** Hit@K (상위 K개에 정답 포함 여부) */
  hit: boolean;
  /** K 값 */
  k: number;
}

/**
 * IR Metrics 배치 요약
 */
export interface IRMetricsSummary {
  /** 총 쿼리 수 */
  totalQueries: number;
  /** 평균 NDCG@K */
  avgNDCG: number;
  /** 평균 mAP@K */
  avgMAP: number;
  /** 평균 F1@K */
  avgF1: number;
  /** 평균 MRR */
  avgMRR: number;
  /** 평균 Precision@K */
  avgPrecision: number;
  /** 평균 Recall@K */
  avgRecall: number;
  /** Hit Rate@K (Hit한 쿼리 비율) */
  hitRate: number;
  /** K 값 */
  k: number;
  /** 실행 시간 (ms) */
  durationMs: number;
}

/**
 * IR Metrics 벤치마크 결과
 */
export interface IRMetricsBenchmarkResult {
  /** 설정 */
  config: {
    k: number;
    timestamp: string;
    datasetPath: string;
  };
  /** 개별 쿼리 결과 */
  results: IRMetricsOutput[];
  /** 요약 */
  summary: IRMetricsSummary;
  /** Gate 통과 여부 */
  gatePassRates: {
    ndcgPass: boolean;
    mapPass: boolean;
    f1Pass: boolean;
    mrrPass: boolean;
  };
  /** 성공 기준 */
  successCriteria: {
    ndcgThreshold: number;
    mapThreshold: number;
    f1Threshold: number;
    mrrThreshold: number;
  };
}

/**
 * IR Metrics 성공 기준 (Phase 6 목표)
 */
export const IR_METRICS_SUCCESS_CRITERIA = {
  ndcg: 0.7,   // NDCG@5 ≥ 0.7
  map: 0.6,    // mAP@5 ≥ 0.6
  f1: 0.65,    // F1@5 ≥ 0.65
  mrr: 0.75,   // MRR ≥ 0.75
};

/**
 * IR Metrics 설정
 */
export interface IRMetricsConfig {
  /** 평가할 K 값 (기본: 5) */
  k: number;
  /** NDCG 계산 시 로그 베이스 (기본: 2) */
  ndcgLogBase: number;
}

/**
 * DCG 계산 옵션
 */
export interface DCGOptions {
  /** 로그 베이스 (기본: 2) */
  logBase: number;
  /** K 값 */
  k: number;
}
