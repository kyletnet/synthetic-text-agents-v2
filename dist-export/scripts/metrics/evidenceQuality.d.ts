interface EvidenceQualityMetrics {
  evidence_presence_rate: number;
  total_items: number;
  items_with_evidence: number;
  items_missing_evidence: number;
  snippet_alignment: {
    mean: number;
    median: number;
    p95: number;
    scores: number[];
  };
  failed_alignments: Array<{
    index: number;
    question: string;
    answer: string;
    evidence: string;
    alignment_score: number;
  }>;
  alert_triggered: boolean;
}
interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_idx?: number;
  evidence_text?: string;
  index?: number;
}
/**
 * Calculate evidence quality metrics
 */
export declare function calculateEvidenceQuality(
  qaItems: QAItem[],
  configPath?: string,
): EvidenceQualityMetrics;
/**
 * Generate evidence quality report
 */
export declare function generateEvidenceReport(
  metrics: EvidenceQualityMetrics,
): string;
export {};
//# sourceMappingURL=evidenceQuality.d.ts.map
