/**
 * Canonical Taxonomy Definitions
 *
 * This file defines the canonical severity levels and stage identifiers
 * that must be used consistently across all generators, validators, and reports.
 *
 * Enforcement: All code generating severity or stage values must import
 * and use these exact tokens. The taxonomy checker validates compliance.
 */

// Canonical Severity Levels
export const CANONICAL_SEVERITIES = ["P0", "P1", "P2"] as const;
export type CanonicalSeverity = (typeof CANONICAL_SEVERITIES)[number];

// Canonical Stage Identifiers
export const CANONICAL_STAGES = [
  "STEP_1_TYPESCRIPT",
  "STEP_2_LINT",
  "STEP_3_SANITY",
  "STEP_4_SMOKE_PAID",
  "STEP_5_GATING",
  "STEP_6_OBSERVABILITY",
  "STEP_7_FULL_RUN",
] as const;
export type CanonicalStage = (typeof CANONICAL_STAGES)[number];

// Severity Definitions
export const SEVERITY_DEFINITIONS = {
  P0: {
    level: "P0",
    description: "Critical - System broken, blocking all progress",
    action_required: "Immediate fix required before any proceeding",
    examples: [
      "Build completely fails",
      "Core API unavailable",
      "Data corruption",
    ],
  },
  P1: {
    level: "P1",
    description: "High - Significant impact, major feature broken",
    action_required: "Fix required within current milestone",
    examples: [
      "Key feature non-functional",
      "Performance severely degraded",
      "Security vulnerability",
    ],
  },
  P2: {
    level: "P2",
    description: "Medium - Moderate impact, minor feature issues",
    action_required: "Fix recommended but not blocking",
    examples: [
      "Edge case failures",
      "Minor performance issues",
      "Non-critical feature gaps",
    ],
  },
} as const;

// Stage Definitions
export const STAGE_DEFINITIONS = {
  STEP_1_TYPESCRIPT: {
    stage: "STEP_1_TYPESCRIPT",
    description: "TypeScript validation and type checking",
    command: "npm run typecheck",
    gate_criteria: "Zero TypeScript compilation errors",
  },
  STEP_2_LINT: {
    stage: "STEP_2_LINT",
    description: "Code linting and style validation",
    command: "npm run lint",
    gate_criteria: "Zero linting errors, warnings acceptable",
  },
  STEP_3_SANITY: {
    stage: "STEP_3_SANITY",
    description: "Basic sanity checks and configuration validation",
    command: "npm run sanity",
    gate_criteria: "All sanity checks pass",
  },
  STEP_4_SMOKE_PAID: {
    stage: "STEP_4_SMOKE_PAID",
    description: "Paid smoke tests against live APIs",
    command: "npm run smoke",
    gate_criteria: "Smoke tests pass within budget",
  },
  STEP_5_GATING: {
    stage: "STEP_5_GATING",
    description: "P0/P1/P2 policy evaluation and gating decisions",
    command: "npm run gating",
    gate_criteria: "No P0 violations, P1 warnings acceptable",
  },
  STEP_6_OBSERVABILITY: {
    stage: "STEP_6_OBSERVABILITY",
    description: "Observability export and consistency validation",
    command: "npm run verify:obs",
    gate_criteria: "Observability consistency verified",
  },
  STEP_7_FULL_RUN: {
    stage: "STEP_7_FULL_RUN",
    description: "Full production run with complete dataset",
    command: "npm run full",
    gate_criteria: "Full run completes successfully",
  },
} as const;

// Utility functions for validation
export function isCanonicalSeverity(value: string): value is CanonicalSeverity {
  return CANONICAL_SEVERITIES.includes(value as CanonicalSeverity);
}

export function isCanonicalStage(value: string): value is CanonicalStage {
  return CANONICAL_STAGES.includes(value as CanonicalStage);
}

export function validateSeverity(value: string): CanonicalSeverity {
  if (!isCanonicalSeverity(value)) {
    throw new Error(
      `Invalid severity '${value}'. Must be one of: ${CANONICAL_SEVERITIES.join(
        ", ",
      )}`,
    );
  }
  return value;
}

export function validateStage(value: string): CanonicalStage {
  if (!isCanonicalStage(value)) {
    throw new Error(
      `Invalid stage '${value}'. Must be one of: ${CANONICAL_STAGES.join(
        ", ",
      )}`,
    );
  }
  return value;
}

// Stage alias mappings for backward compatibility
const STAGE_ALIASES = new Map([
  ["typescript-validation", "STEP_1_TYPESCRIPT"],
  ["typescript validate", "STEP_1_TYPESCRIPT"],
  ["lint", "STEP_2_LINT"],
  ["sanity", "STEP_3_SANITY"],
  ["smoke-run", "STEP_4_SMOKE_PAID"],
  ["paid smoke", "STEP_4_SMOKE_PAID"],
  ["gating-validation", "STEP_5_GATING"],
  ["gating", "STEP_5_GATING"],
  ["observability export", "STEP_6_OBSERVABILITY"],
  ["observability", "STEP_6_OBSERVABILITY"],
  ["full run", "STEP_7_FULL_RUN"],
  ["full", "STEP_7_FULL_RUN"],
]);

/**
 * Converts stage alias to canonical stage identifier
 * 로드맵(P2~P5)은 여기서 다루지 않음(문서 전용)
 */
export function toCanonicalStage(s: string): string | null {
  const canonical = STAGE_ALIASES.get(s.toLowerCase());
  if (canonical) return canonical;

  if (isCanonicalStage(s)) return s;

  return null;
}
