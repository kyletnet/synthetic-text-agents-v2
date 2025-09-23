interface SessionReportFields {
  SESSION_ID: string;
  RUN_ID: string;
  TARGET: string;
  PROFILE: string;
  MODE: string;
  DRY_RUN: boolean;
  OFFLINE_MODE: boolean;
  BUDGET_USD: string;
  COST_USD: string;
  DURATION_MS: number;
  MODEL_ID: string;
  PANEL_SIZE: number;
  TOKENS_EST: number;
  COST_EST_USD: string;
  CASES_TOTAL: number;
  CASES_PASSED: number;
  PASS_RATE: string;
  MEAN_SCORE: string;
  P50_MS: string;
  P95_MS: string;
  TOP_FAIL_REASONS: string;
  ERROR_CLASS: string;
  TRACE_ID: string;
  CI_BUILD_ID: string;
  GIT_COMMIT: string;
  GIT_COMMIT_FULL: string;
  RUN_STATE: string;
  RETRY_COUNT: number;
  RETRY_FROM_DLQ: boolean;
  RESULT: string;
  WARNINGS: number;
  CHANGED_FILES: string;
  NOTES: string;
  TIMESTAMP: string;
  DLQ_COUNT?: number;
  LAST_DLQ_RUN_ID?: string;
}
interface DLQInfo {
  count: number;
  lastRunId?: string;
}
export declare class SessionReportManager {
  private finalWriteCompleted;
  /**
   * Enforce cases total consistency - if CASES_TOTAL is 0, RESULT cannot be PASS
   */
  static enforceCasesTotal(
    fields: Partial<SessionReportFields>,
  ): Partial<SessionReportFields>;
  /**
   * Map RUN_STATE to RESULT for consistency
   */
  static mapRunStateToResult(runState: string): string;
  /**
   * Validate and sanitize field values
   */
  static validateFields(
    fields: Partial<SessionReportFields>,
  ): Partial<SessionReportFields>;
  /**
   * Get DLQ information
   */
  static getDLQInfo(): DLQInfo;
  /**
   * Atomic write with tmp/rename pattern
   */
  writeSessionReportFinal(fields: Partial<SessionReportFields>): void;
  /**
   * Generate the complete session report content
   */
  private generateReportContent;
  /**
   * Get number of entrypoints
   */
  private getEntrypointCount;
  /**
   * Get git status
   */
  private getGitStatus;
  /**
   * Get DLQ status description
   */
  private getDLQStatus;
}
export {};
//# sourceMappingURL=session_report.d.ts.map
