/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Regression Guard Types
 * Central type definitions for RG system
 */

export type RGDecision = "PASS" | "WARN" | "FAIL";
export type RGProfile = "dev" | "stage" | "prod";

export interface RGGateResults {
  A_static_dna: boolean;
  B_autonomy: boolean;
  C_stability: boolean;
  D_budget: boolean;
}

export interface RGMetaKernelResult {
  driftDetected: boolean;
  details: string[];
}

export interface RGObjectiveResult {
  evolutions: number;
  reason?: string;
}

export interface RGFeedbackResult {
  changed: boolean;
  hashBefore: string;
  hashAfter: string;
  file: string;
  reason?: string;
}

export interface RGOperationalProof {
  metaKernel: RGMetaKernelResult;
  objective: RGObjectiveResult;
  feedback: RGFeedbackResult;
}

export interface RGRunRecord {
  ts: string;
  pass: boolean;
  warn: boolean;
  cost: number;
  latencyMs: number;
}

export interface RGSummary {
  pass: boolean;
  warn: boolean;
  failReasons: string[];
  profile: RGProfile;
  latencyMs: number;
  cost: number;
  hashes: {
    before: string;
    after: string;
  };
}

export interface RGDecisionOutput {
  decision: RGDecision;
  gates: RGGateResults;
  ts: string;
  failReasons?: string[];
}

export interface RGArchitectureResult {
  depcruise: {
    passed: boolean;
    errors: Array<{ from: string; to: string; rule: string }>;
  };
  metaKernel: {
    passed: boolean;
    issues: string[];
  };
}
