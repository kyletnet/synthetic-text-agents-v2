/**
 * Gate System Integration
 *
 * Phase 3 Week 4 to Phase 4: Connect Adaptive RAG + RAGAS to Gate system
 *
 * Gate Mappings:
 * - Gate B (Evidence Hit) <- RAGAS Context Recall
 * - Gate D (Faithfulness) <- RAGAS Context Precision
 * - Gate E (Utility) <- RAGAS Answer Relevance
 * - Gate F (Throughput) <- Adaptive RAG Cost Tracking
 * - Gate G (Groundedness) <- RAGAS Answer Faithfulness
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 6)
 */

import type { RAGASResult } from '../../evaluation/ragas/types';
import type { AdaptiveRAGResult } from '../adaptive-rag/types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Gate Status
 */
export interface GateStatus {
  gate: 'B' | 'D' | 'E' | 'F' | 'G';
  name: string;
  score: number;
  threshold: number;
  passed: boolean;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Gate Report
 */
export interface GateReport {
  timestamp: string;
  queryId: string;
  gates: {
    B: GateStatus; // Evidence Hit (Context Recall)
    D: GateStatus; // Faithfulness (Context Precision)
    E: GateStatus; // Utility (Answer Relevance)
    F: GateStatus; // Throughput (Cost)
    G: GateStatus; // Groundedness (Answer Faithfulness)
  };
  summary: {
    totalPassed: number;
    totalFailed: number;
    overallStatus: 'PASS' | 'PARTIAL' | 'FAIL';
  };
}

/**
 * Gate Thresholds
 */
export const DEFAULT_GATE_THRESHOLDS = {
  B: 0.70, // Context Recall
  D: 0.75, // Context Precision
  E: 0.85, // Answer Relevance
  F: 8000, // Max tokens
  G: 0.80, // Answer Faithfulness
};

/**
 * Gate Integration Helper
 */
export class GateIntegration {
  private thresholds: typeof DEFAULT_GATE_THRESHOLDS;
  private reportPath: string;

  constructor(
    thresholds?: Partial<typeof DEFAULT_GATE_THRESHOLDS>,
    reportPath = 'reports/gates'
  ) {
    this.thresholds = {
      ...DEFAULT_GATE_THRESHOLDS,
      ...thresholds,
    };
    this.reportPath = reportPath;
  }

  /**
   * Create gate report from RAGAS and Adaptive RAG results
   */
  async createGateReport(
    queryId: string,
    ragasResult: RAGASResult,
    adaptiveRAGResult: AdaptiveRAGResult
  ): Promise<GateReport> {
    const timestamp = new Date().toISOString();

    // Gate B: Evidence Hit (Context Recall)
    const gateB: GateStatus = {
      gate: 'B',
      name: 'Evidence Hit',
      score: ragasResult.metrics.contextRecall,
      threshold: this.thresholds.B,
      passed: ragasResult.metrics.contextRecall >= this.thresholds.B,
      timestamp: Date.now(),
      metadata: {
        retrievedContexts: ragasResult.input.contexts.length,
        coverage: ragasResult.details.contextRecall.coverage,
      },
    };

    // Gate D: Faithfulness (Context Precision)
    const gateD: GateStatus = {
      gate: 'D',
      name: 'Faithfulness',
      score: ragasResult.metrics.contextPrecision,
      threshold: this.thresholds.D,
      passed: ragasResult.metrics.contextPrecision >= this.thresholds.D,
      timestamp: Date.now(),
      metadata: {
        relevantContexts: ragasResult.details.contextPrecision.relevantContexts,
        irrelevantContexts: ragasResult.details.contextPrecision.irrelevantContexts,
      },
    };

    // Gate E: Utility (Answer Relevance)
    const gateE: GateStatus = {
      gate: 'E',
      name: 'Utility',
      score: ragasResult.metrics.answerRelevance,
      threshold: this.thresholds.E,
      passed: ragasResult.metrics.answerRelevance >= this.thresholds.E,
      timestamp: Date.now(),
      metadata: {
        alignment: ragasResult.details.answerRelevance.alignment,
      },
    };

    // Gate F: Throughput (Cost)
    const gateF: GateStatus = {
      gate: 'F',
      name: 'Throughput',
      score: adaptiveRAGResult.cost.totalTokens,
      threshold: this.thresholds.F,
      passed: adaptiveRAGResult.cost.totalTokens <= this.thresholds.F,
      timestamp: Date.now(),
      metadata: {
        totalTokens: adaptiveRAGResult.cost.totalTokens,
        costUSD: adaptiveRAGResult.cost.costUSD,
        finalK: adaptiveRAGResult.finalK,
        iterations: adaptiveRAGResult.iterations,
      },
    };

    // Gate G: Groundedness (Answer Faithfulness)
    const gateG: GateStatus = {
      gate: 'G',
      name: 'Groundedness',
      score: ragasResult.metrics.answerFaithfulness,
      threshold: this.thresholds.G,
      passed: ragasResult.metrics.answerFaithfulness >= this.thresholds.G,
      timestamp: Date.now(),
      metadata: {
        groundedStatements: ragasResult.details.answerFaithfulness.groundedStatements,
        ungroundedStatements: ragasResult.details.answerFaithfulness.ungroundedStatements,
        hallucinationRisk: ragasResult.details.answerFaithfulness.hallucinationRisk,
      },
    };

    // Calculate summary
    const gates = { B: gateB, D: gateD, E: gateE, F: gateF, G: gateG };
    const passed = Object.values(gates).filter(g => g.passed).length;
    const failed = Object.values(gates).filter(g => !g.passed).length;

    const report: GateReport = {
      timestamp,
      queryId,
      gates,
      summary: {
        totalPassed: passed,
        totalFailed: failed,
        overallStatus: passed === 5 ? 'PASS' : passed >= 3 ? 'PARTIAL' : 'FAIL',
      },
    };

    return report;
  }

  /**
   * Save gate report to file
   */
  async saveReport(report: GateReport): Promise<void> {
    await fs.mkdir(this.reportPath, { recursive: true });

    const filename = `gate-report-${report.queryId}-${Date.now()}.json`;
    const filepath = path.join(this.reportPath, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`[OK] Gate report saved to ${filepath}`);
  }

  /**
   * Get gate statistics from multiple reports
   */
  async getStatistics(reports: GateReport[]): Promise<{
    gatePassRates: Record<string, number>;
    averageScores: Record<string, number>;
    overallPassRate: number;
  }> {
    if (reports.length === 0) {
      return {
        gatePassRates: { B: 0, D: 0, E: 0, F: 0, G: 0 },
        averageScores: { B: 0, D: 0, E: 0, F: 0, G: 0 },
        overallPassRate: 0,
      };
    }

    const gatePassRates = {
      B: reports.filter(r => r.gates.B.passed).length / reports.length,
      D: reports.filter(r => r.gates.D.passed).length / reports.length,
      E: reports.filter(r => r.gates.E.passed).length / reports.length,
      F: reports.filter(r => r.gates.F.passed).length / reports.length,
      G: reports.filter(r => r.gates.G.passed).length / reports.length,
    };

    const averageScores = {
      B: reports.reduce((sum, r) => sum + r.gates.B.score, 0) / reports.length,
      D: reports.reduce((sum, r) => sum + r.gates.D.score, 0) / reports.length,
      E: reports.reduce((sum, r) => sum + r.gates.E.score, 0) / reports.length,
      F: reports.reduce((sum, r) => sum + r.gates.F.score, 0) / reports.length,
      G: reports.reduce((sum, r) => sum + r.gates.G.score, 0) / reports.length,
    };

    const overallPassRate =
      reports.filter(r => r.summary.overallStatus === 'PASS').length / reports.length;

    return {
      gatePassRates,
      averageScores,
      overallPassRate,
    };
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<typeof DEFAULT_GATE_THRESHOLDS>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }
}

/**
 * Create gate integration helper
 */
export function createGateIntegration(
  thresholds?: Partial<typeof DEFAULT_GATE_THRESHOLDS>,
  reportPath?: string
): GateIntegration {
  return new GateIntegration(thresholds, reportPath);
}
