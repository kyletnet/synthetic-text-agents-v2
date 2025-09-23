#!/usr/bin/env node
/**
 * check_observability_consistency.ts — Permanent observability consistency checker
 *
 * CLI usage:
 * node dist/scripts/ci/check_observability_consistency.js \
 *   --session reports/session_report.md \
 *   --obs reports/observability/2025-09-19T01-50-27/index.html \
 *   --logs RUN_LOGS
 *
 * Performs strict, deterministic consistency checks between:
 * - Session report (canonical source)
 * - Observability HTML export
 * - Raw run logs
 */
interface ConsistencyResult {
  run_id_match: "PASS" | "FAIL";
  cost_check: "PASS" | "WARN" | "FAIL";
  duration_check: "PASS" | "FAIL";
  operations_check: "PASS" | "FAIL" | "SKIP";
  components_seen: string[];
  notes: string[];
  exit: 0 | 1;
  details?: {
    session_data: any;
    html_data: any;
    logs_aggregated: any;
  };
}
export declare class ObservabilityConsistencyChecker {
  checkConsistency(
    sessionPath: string,
    htmlPath: string,
    logsDir: string,
  ): Promise<ConsistencyResult>;
  private parseSessionReport;
  private parseObservabilityHtml;
  private aggregateRunLogs;
  private checkRunIdMatch;
  private checkCostConsistency;
  private checkDurationConsistency;
  private checkOperationsConsistency;
  private checkComponents;
}
declare function main(): Promise<void>;
export { main };
//# sourceMappingURL=check_observability_consistency.d.ts.map
