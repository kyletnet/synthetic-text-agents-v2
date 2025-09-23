#!/usr/bin/env node
interface PreflightConfig {
  profile: "dev" | "stage" | "prod";
  budgetSmoke: number;
  budgetFull: number;
  runTags: string;
  timestamp: string;
  reportDir: string;
  runLogsDir: string;
  obsDir: string;
  dlqDir: string;
}
interface HandoffBundle {
  timestamp: string;
  git_commit_hash: string;
  profile: string;
  session_report_path: string;
  baseline_report_path: string;
  observability_path: string;
  data_manifest_path: string;
  config_snapshot: {
    env_files: string[];
    baseline_config: string;
    tsconfig_files: string[];
  };
  run_logs_dir: string;
  dlq_reports: string[];
  product_plan_version: string;
  bundle_hash: string;
}
export declare class PreflightPack {
  private config;
  private manifestManager;
  private seedManager;
  private thresholdManager;
  private budgetGuardian;
  private dlqManager;
  private obsExporter;
  private gatingIntegrator;
  private sessionValidator;
  constructor(config?: Partial<PreflightConfig>);
  run(): Promise<{
    success: boolean;
    handoffBundle: HandoffBundle;
  }>;
  private runStage;
  private validateTypeScript;
  private validateLint;
  private runSanityChecks;
  private resolveSmokeCmd;
  private runPaidSmoke;
  private evaluateGating;
  private exportObservability;
  private runFullRun;
  private generateHandoffBundle;
  private collectConfigSnapshot;
  private collectDLQReports;
  private generateMockSessionReport;
  private ensureDirectories;
}
declare function main(): Promise<void>;
export { main };
//# sourceMappingURL=preflight_pack.d.ts.map
