interface EntityCoverage {
  total_entities: number;
  covered_entities: number;
  coverage_rate: number;
  missed_entities: string[];
  entity_frequency: Record<string, number>;
}
interface SectionCoverage {
  total_sections: number;
  covered_sections: number;
  coverage_rate: number;
  section_histogram: Record<string, number>;
  uncovered_sections: string[];
}
interface CoverageMetrics {
  entity_coverage: EntityCoverage;
  section_coverage: SectionCoverage;
  alert_triggered: boolean;
  coverage_summary: {
    overall_score: number;
    critical_gaps: string[];
  };
}
interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_idx?: number;
  source_text?: string;
  index?: number;
}
/**
 * Calculate overall coverage metrics
 */
export declare function calculateCoverageMetrics(
  qaItems: QAItem[],
  sourceTexts: string[],
  configPath?: string,
): CoverageMetrics;
/**
 * Generate coverage report
 */
export declare function generateCoverageReport(
  metrics: CoverageMetrics,
): string;
export {};
//# sourceMappingURL=coverageMetrics.d.ts.map
