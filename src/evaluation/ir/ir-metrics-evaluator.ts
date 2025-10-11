/**
 * IR (Information Retrieval) Metrics Evaluator
 *
 * 비용 0원으로 검색 품질을 측정하는 표준 IR 지표 계산기
 *
 * Phase 6 Day 2
 */

import {
  type IRMetricsInput,
  type IRMetricsOutput,
  type IRMetricsSummary,
  type IRMetricsConfig,
  type SearchResult,
  type DCGOptions,
  IR_METRICS_SUCCESS_CRITERIA,
} from './ir-metrics-types.js';

/**
 * IR Metrics Evaluator 클래스
 */
export class IRMetricsEvaluator {
  private config: IRMetricsConfig;

  constructor(config: Partial<IRMetricsConfig> = {}) {
    this.config = {
      k: config.k ?? 5,
      ndcgLogBase: config.ndcgLogBase ?? 2,
    };
  }

  /**
   * 단일 쿼리의 IR Metrics 평가
   */
  evaluate(input: IRMetricsInput): IRMetricsOutput {
    const k = input.k ?? this.config.k;
    const topK = input.results.slice(0, k);
    const groundTruthSet = new Set(input.groundTruth);

    // Relevance 계산 (각 결과가 정답인지)
    const relevances = topK.map(result =>
      groundTruthSet.has(result.id) ? 1 : 0
    );

    // NDCG@K
    const ndcg = this.calculateNDCG(relevances, k);

    // mAP@K
    const map = this.calculateMAP(relevances);

    // Precision@K & Recall@K
    const precision = this.calculatePrecision(relevances);
    const recall = this.calculateRecall(relevances, input.groundTruth.length);

    // F1@K
    const f1 = this.calculateF1(precision, recall);

    // MRR
    const mrr = this.calculateMRR(relevances);

    // Hit@K
    const hit = relevances.includes(1);

    return {
      queryId: input.queryId,
      ndcg,
      map,
      f1,
      mrr,
      precision,
      recall,
      hit,
      k,
    };
  }

  /**
   * 배치 평가 (여러 쿼리)
   */
  evaluateBatch(
    inputs: IRMetricsInput[]
  ): { results: IRMetricsOutput[]; summary: IRMetricsSummary } {
    const startTime = Date.now();

    // 개별 평가
    const results = inputs.map(input => this.evaluate(input));

    // 요약 계산
    const summary = this.calculateSummary(results, Date.now() - startTime);

    return { results, summary };
  }

  /**
   * NDCG@K (Normalized Discounted Cumulative Gain) 계산
   *
   * NDCG = DCG / IDCG
   * DCG = Σ (rel_i / log2(i + 1))
   * IDCG = 이상적인 순위일 때의 DCG (relevance 내림차순)
   */
  private calculateNDCG(relevances: number[], k: number): number {
    if (relevances.length === 0) return 0;

    const dcg = this.calculateDCG(relevances, { logBase: this.config.ndcgLogBase, k });

    // IDCG: 이상적인 순위 (relevance 내림차순)
    const idealRelevances = [...relevances].sort((a, b) => b - a);
    const idcg = this.calculateDCG(idealRelevances, { logBase: this.config.ndcgLogBase, k });

    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * DCG (Discounted Cumulative Gain) 계산
   */
  private calculateDCG(relevances: number[], options: DCGOptions): number {
    const { logBase, k } = options;
    let dcg = 0;

    for (let i = 0; i < Math.min(relevances.length, k); i++) {
      const rel = relevances[i];
      const rank = i + 1;
      // DCG formula: rel / log_base(rank + 1)
      dcg += rel / Math.log(rank + 1) / Math.log(logBase);
    }

    return dcg;
  }

  /**
   * mAP@K (Mean Average Precision) 계산
   *
   * AP = (1/R) * Σ (Precision@i × rel_i)
   * R = 총 정답 문서 수
   */
  private calculateMAP(relevances: number[]): number {
    if (relevances.length === 0) return 0;

    const totalRelevant = relevances.reduce((sum, rel) => sum + rel, 0);
    if (totalRelevant === 0) return 0;

    let sumPrecision = 0;
    let relevantCount = 0;

    for (let i = 0; i < relevances.length; i++) {
      if (relevances[i] === 1) {
        relevantCount++;
        const precisionAtI = relevantCount / (i + 1);
        sumPrecision += precisionAtI;
      }
    }

    return sumPrecision / totalRelevant;
  }

  /**
   * Precision@K 계산
   *
   * Precision = (상위 K개 중 정답 수) / K
   */
  private calculatePrecision(relevances: number[]): number {
    if (relevances.length === 0) return 0;
    const relevant = relevances.reduce((sum, rel) => sum + rel, 0);
    return relevant / relevances.length;
  }

  /**
   * Recall@K 계산
   *
   * Recall = (상위 K개 중 정답 수) / (전체 정답 수)
   */
  private calculateRecall(relevances: number[], totalGroundTruth: number): number {
    if (totalGroundTruth === 0) return 0;
    const relevant = relevances.reduce((sum, rel) => sum + rel, 0);
    return relevant / totalGroundTruth;
  }

  /**
   * F1@K 계산 (Precision과 Recall의 조화 평균)
   *
   * F1 = 2 × (Precision × Recall) / (Precision + Recall)
   */
  private calculateF1(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
  }

  /**
   * MRR (Mean Reciprocal Rank) 계산
   *
   * MRR = 1 / (첫 정답의 rank)
   * 정답이 없으면 0
   */
  private calculateMRR(relevances: number[]): number {
    for (let i = 0; i < relevances.length; i++) {
      if (relevances[i] === 1) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  /**
   * 배치 결과 요약 계산
   */
  private calculateSummary(
    results: IRMetricsOutput[],
    durationMs: number
  ): IRMetricsSummary {
    const totalQueries = results.length;

    if (totalQueries === 0) {
      return {
        totalQueries: 0,
        avgNDCG: 0,
        avgMAP: 0,
        avgF1: 0,
        avgMRR: 0,
        avgPrecision: 0,
        avgRecall: 0,
        hitRate: 0,
        k: this.config.k,
        durationMs,
      };
    }

    const sum = results.reduce(
      (acc, r) => ({
        ndcg: acc.ndcg + r.ndcg,
        map: acc.map + r.map,
        f1: acc.f1 + r.f1,
        mrr: acc.mrr + r.mrr,
        precision: acc.precision + r.precision,
        recall: acc.recall + r.recall,
        hit: acc.hit + (r.hit ? 1 : 0),
      }),
      { ndcg: 0, map: 0, f1: 0, mrr: 0, precision: 0, recall: 0, hit: 0 }
    );

    return {
      totalQueries,
      avgNDCG: sum.ndcg / totalQueries,
      avgMAP: sum.map / totalQueries,
      avgF1: sum.f1 / totalQueries,
      avgMRR: sum.mrr / totalQueries,
      avgPrecision: sum.precision / totalQueries,
      avgRecall: sum.recall / totalQueries,
      hitRate: sum.hit / totalQueries,
      k: this.config.k,
      durationMs,
    };
  }

  /**
   * Gate 통과 여부 체크
   */
  checkGates(summary: IRMetricsSummary): {
    ndcgPass: boolean;
    mapPass: boolean;
    f1Pass: boolean;
    mrrPass: boolean;
    allPass: boolean;
  } {
    const ndcgPass = summary.avgNDCG >= IR_METRICS_SUCCESS_CRITERIA.ndcg;
    const mapPass = summary.avgMAP >= IR_METRICS_SUCCESS_CRITERIA.map;
    const f1Pass = summary.avgF1 >= IR_METRICS_SUCCESS_CRITERIA.f1;
    const mrrPass = summary.avgMRR >= IR_METRICS_SUCCESS_CRITERIA.mrr;

    return {
      ndcgPass,
      mapPass,
      f1Pass,
      mrrPass,
      allPass: ndcgPass && mapPass && f1Pass && mrrPass,
    };
  }
}

/**
 * IR Metrics 평가 헬퍼 함수 (간편 사용)
 */
export function evaluateIRMetrics(
  inputs: IRMetricsInput[],
  config?: Partial<IRMetricsConfig>
): { results: IRMetricsOutput[]; summary: IRMetricsSummary } {
  const evaluator = new IRMetricsEvaluator(config);
  return evaluator.evaluateBatch(inputs);
}
