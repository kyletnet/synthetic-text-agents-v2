export interface ExportOptions {
  source: "baseline" | "session";
  format: "csv" | "json";
  runId: string;
  outputDir?: string;
  dryRun?: boolean;
  skipDuplicates?: boolean;
  includeLinks?: boolean;
}
export interface ExportRecord {
  RUN_ID: string;
  ITEM_ID: string;
  RESULT: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  COST_USD: number;
  LAT_MS: number;
  WARNINGS: number;
  P0_VIOLATIONS: number;
  P1_VIOLATIONS: number;
  P2_VIOLATIONS: number;
  ACCURACY_SCORE: number;
  EVIDENCE_PRESENCE: number;
  DUPLICATION_RATE: number;
  HALLUCINATION_RISK: "low" | "medium" | "high" | "none";
  PII_HITS: number;
  LICENSE_HITS: number;
  PROFILE: string;
  TIMESTAMP: string;
  REPORT_LINK?: string;
  SESSION_LINK?: string;
  [key: string]: any;
}
export interface ExportResult {
  success: boolean;
  outputPath: string;
  recordCount: number;
  validationErrors?: string[];
  warnings?: string[];
  version?: number;
}
export declare class EnhancedExporter {
  private ajv;
  constructor();
  /**
   * Main export function with all enhanced features
   */
  export(options: ExportOptions): Promise<ExportResult>;
  /**
   * Resolve input file path based on source type
   */
  private resolveInputPath;
  /**
   * Setup output path with RUN_ID namespace
   */
  private setupOutputPath;
  /**
   * Handle file versioning to prevent overwrites
   */
  private handleVersioning;
  /**
   * Extract version number from versioned filename
   */
  private extractVersionNumber;
  /**
   * Validate input against schema
   */
  private validateSchema;
  /**
   * Stream processing with memory efficiency
   */
  private streamProcess;
  /**
   * Transform source record to export format
   */
  private transformRecord;
  private determineResult;
  private countP0Violations;
  private countP1Violations;
  private countP2Violations;
  /**
   * Convert record to CSV format
   */
  private recordToCsv;
  /**
   * Validate export result against schema
   */
  validateExportResult(outputPath: string): Promise<{
    valid: boolean;
    errors?: string[];
  }>;
}
export declare function parseExportArgs(args: string[]): ExportOptions;
export declare function validateExportOptions(
  options: Partial<ExportOptions>,
): string[];
//# sourceMappingURL=export_enhanced.d.ts.map
