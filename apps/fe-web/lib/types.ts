// Types based on FE_MVP_SPEC.md and FLAGS_WIRING.md

export interface SessionConfig {
  mode: "explore" | "exploit";
  guardianProfileId: "default" | "strict" | "fast";
  searchLite: boolean;
  styleRulesPath?: string;
  strategyOverrides: {
    factuality?: number;
    format?: number;
    difficulty?: number;
    styleStrictness?: number;
  };
  feedback?: string;
}

export interface RunRequest {
  inputs: {
    text?: string;
    files?: string[];
    guidelines: string;
  };
  flags: {
    "feature.searchLite": boolean;
    "feature.guardianProfiles": boolean;
    "feature.autoTagging": boolean;
    "feature.difficultyDistribution": boolean;
    "feature.styleGuard": boolean;
    "feature.mode": string;
  };
  constraints: {
    minScore: number;
    maxLatency: number;
  };
  session: {
    guardianProfileId: string;
    seed?: number;
  };
}

export interface RunResult {
  metrics: {
    passRate: number;
    avgScore: number;
    avgLatency: number;
    vetoedPct: number;
  };
  issuesTop3: string[];
  samples: Array<{
    id: string;
    status: "passed" | "failed" | "vetoed";
    score: number;
    latencyMs: number;
    issues: string[];
  }>;
  links?: {
    runLogPath?: string;
    decisionPath?: string;
  };
  suggestedTags?: string[];
  difficultyReport?: any;
  styleViolations?: Array<{
    rule: string;
    count: number;
  }>;
  providerNote?: string;
}

export interface UIStrings {
  buttons: {
    run: string;
    rerun: string;
    rollback: string;
    export: string;
  };
  labels: {
    preset: string;
    guardianProfile: string;
    mode: string;
    styleGuard: string;
    searchLite: string;
    feedback: string;
  };
}

export type Preset = "strict" | "default" | "fast";
export type GuardianProfile = "default" | "strict" | "fast";
export type Mode = "explore" | "exploit";
