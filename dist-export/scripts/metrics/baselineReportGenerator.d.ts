export declare function prewriteSessionMeta(meta: {
  profile: string;
  mode: string;
  dryRun: string;
  casesTotal: number;
}): Promise<void>;
import { GatingResult, CalibrationResult } from "./thresholdManager.js";
interface BaselineMetricsSummary {
  timestamp: string;
  session_id: string;
  total_items: number;
  config_version: string;
  duplication: any;
  qtype_distribution: any;
  coverage: any;
  evidence_quality: any;
  hallucination: any;
  pii_license: any;
  cost_total_usd: number;
  cost_per_item: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  budget_utilization: number;
  overall_quality_score: number;
  reproducibility_check: any;
  total_alerts: number;
  recommendation_level: string;
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
  cost_usd?: number;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
}
interface ReportOptions {
  outputDir?: string;
  sessionId?: string;
  budgetLimit?: number;
  sourceTexts?: string[];
  includeFullData?: boolean;
  profile?: string;
  enableAutocalibration?: boolean;
  applyCalibration?: boolean;
  enableSchemaValidation?: boolean;
  enableExport?: boolean;
  trendHistoryLimit?: number;
}
/**
 * Main function to generate all baseline reports
 */
export declare function generateBaselineReports(
  qaItems: QAItem[],
  options?: ReportOptions,
): Promise<{
  jsonlPath: string;
  markdownPath: string;
  summary: BaselineMetricsSummary;
  hash: string;
  gating?: GatingResult;
  calibrationResults?: CalibrationResult[];
  schemaValidationResults?: {
    valid: boolean;
    errors?: string[];
  }[];
  exportPaths?: {
    csvPath: string;
    jsonPath: string;
  };
  exportValidation?: {
    valid: boolean;
    errors?: string[];
  };
}>;
export {};
//# sourceMappingURL=baselineReportGenerator.d.ts.map
