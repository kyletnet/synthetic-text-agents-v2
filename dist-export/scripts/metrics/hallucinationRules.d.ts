interface HallucinationFlag {
  index: number;
  question: string;
  answer: string;
  evidence: string;
  reason: string;
  risk_level: "low" | "medium" | "high";
  similarity_score: number;
  missing_support: string[];
}
interface HallucinationMetrics {
  total_items: number;
  flagged_items: number;
  hallucination_rate: number;
  high_risk_count: number;
  flags: HallucinationFlag[];
  risk_distribution: Record<string, number>;
  alert_triggered: boolean;
}
interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_text?: string;
  source_text?: string;
  index?: number;
}
/**
 * Detect potential hallucinations using rule-based approach
 */
export declare function detectHallucinations(
  qaItems: QAItem[],
  configPath?: string,
): HallucinationMetrics;
/**
 * Generate hallucination detection report
 */
export declare function generateHallucinationReport(
  metrics: HallucinationMetrics,
): string;
export {};
//# sourceMappingURL=hallucinationRules.d.ts.map
