/**
 * Domain: Preflight Stage Definitions
 * Defines the canonical 7-stage preflight pipeline structure
 */

import { Logger } from "../../shared/logger.js";

const logger = new Logger({ level: "info" });

// ============================================================================
// Core Types
// ============================================================================

export interface StageResult {
  stage: string;
  stageName: StageName;
  success: boolean;
  duration_ms: number;
  error?: string;
  details?: Record<string, unknown>;
  outputs?: string[];
}

export interface StageContext {
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

export interface PreflightStage {
  readonly name: string;
  readonly stageName: StageName;
  readonly description: string;
  readonly blocking: boolean; // If true, pipeline stops on failure

  execute(context: StageContext): Promise<StageResult>;
  canProceed(result: StageResult): boolean;
}

// ============================================================================
// Stage Names (Canonical)
// ============================================================================

export enum StageName {
  TYPESCRIPT_VALIDATE = "STEP_1_TYPESCRIPT",
  LINT = "STEP_2_LINT",
  SANITY = "STEP_3_SANITY",
  SMOKE_PAID = "STEP_4_SMOKE_PAID",
  GATING = "STEP_5_GATING",
  OBSERVABILITY = "STEP_6_OBSERVABILITY",
  FULL_RUN = "STEP_7_FULL_RUN",
}

// ============================================================================
// Stage Metadata
// ============================================================================

export interface StageMetadata {
  name: string;
  stageName: StageName;
  description: string;
  blocking: boolean;
  order: number;
  dependencies: StageName[];
}

export const STAGE_METADATA: Record<StageName, StageMetadata> = {
  [StageName.TYPESCRIPT_VALIDATE]: {
    name: "[1] TypeScript validate",
    stageName: StageName.TYPESCRIPT_VALIDATE,
    description: "Validate TypeScript compilation with tsc --noEmit",
    blocking: true,
    order: 1,
    dependencies: [],
  },
  [StageName.LINT]: {
    name: "[2] Lint",
    stageName: StageName.LINT,
    description: "Run ESLint validation with --max-warnings=0",
    blocking: true,
    order: 2,
    dependencies: [StageName.TYPESCRIPT_VALIDATE],
  },
  [StageName.SANITY]: {
    name: "[3] Manifest/Seed/Threshold sanity",
    stageName: StageName.SANITY,
    description: "Validate manifest, seed, and threshold configurations",
    blocking: true,
    order: 3,
    dependencies: [StageName.TYPESCRIPT_VALIDATE, StageName.LINT],
  },
  [StageName.SMOKE_PAID]: {
    name: "[4] Paid smoke",
    stageName: StageName.SMOKE_PAID,
    description: "Execute paid smoke test run with DRY_RUN=false",
    blocking: false,
    order: 4,
    dependencies: [StageName.SANITY],
  },
  [StageName.GATING]: {
    name: "[5] Gating",
    stageName: StageName.GATING,
    description: "Evaluate P0/P1/P2 gating criteria",
    blocking: false,
    order: 5,
    dependencies: [StageName.SMOKE_PAID],
  },
  [StageName.OBSERVABILITY]: {
    name: "[6] Observability export",
    stageName: StageName.OBSERVABILITY,
    description: "Export trace data and generate HTML report",
    blocking: false,
    order: 6,
    dependencies: [StageName.GATING],
  },
  [StageName.FULL_RUN]: {
    name: "[7] Full run",
    stageName: StageName.FULL_RUN,
    description: "Execute full production run (conditional on gate)",
    blocking: false,
    order: 7,
    dependencies: [StageName.GATING, StageName.OBSERVABILITY],
  },
};

// ============================================================================
// Abstract Base Stage
// ============================================================================

export abstract class BasePreflightStage implements PreflightStage {
  public readonly name: string;
  public readonly stageName: StageName;
  public readonly description: string;
  public readonly blocking: boolean;
  protected logger: Logger;

  constructor(stageName: StageName) {
    const metadata = STAGE_METADATA[stageName];
    this.name = metadata.name;
    this.stageName = metadata.stageName;
    this.description = metadata.description;
    this.blocking = metadata.blocking;
    this.logger = new Logger({ level: "info" });
  }

  abstract execute(context: StageContext): Promise<StageResult>;

  canProceed(result: StageResult): boolean {
    // Blocking stages must succeed
    if (this.blocking && !result.success) {
      this.logger.error(`Blocking stage ${this.name} failed`, {
        error: result.error,
      });
      return false;
    }

    return true;
  }

  protected async runWithTiming<T>(
    operation: () => Promise<T>,
  ): Promise<{ result: T; duration_ms: number }> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration_ms = Date.now() - startTime;
      return { result, duration_ms };
    } catch (error) {
      const duration_ms = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Operation failed after ${duration_ms}ms: ${errorMessage}`,
      );
    }
  }

  protected createSuccessResult(
    duration_ms: number,
    details?: Record<string, unknown>,
    outputs?: string[],
  ): StageResult {
    return {
      stage: this.name,
      stageName: this.stageName,
      success: true,
      duration_ms,
      details,
      outputs: outputs || [],
    };
  }

  protected createFailureResult(
    duration_ms: number,
    error: string,
    details?: Record<string, unknown>,
  ): StageResult {
    return {
      stage: this.name,
      stageName: this.stageName,
      success: false,
      duration_ms,
      error,
      details,
      outputs: [],
    };
  }
}

// ============================================================================
// Stage Validation
// ============================================================================

export function validateStageOrder(stages: StageName[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seen = new Set<StageName>();

  for (const stage of stages) {
    const metadata = STAGE_METADATA[stage];

    // Check dependencies
    for (const dependency of metadata.dependencies) {
      if (!seen.has(dependency)) {
        errors.push(
          `Stage ${stage} requires ${dependency} to be executed first`,
        );
      }
    }

    seen.add(stage);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getStagesByOrder(): StageName[] {
  return Object.values(StageName).sort((a, b) => {
    return STAGE_METADATA[a].order - STAGE_METADATA[b].order;
  });
}

// ============================================================================
// Exports
// ============================================================================

logger.info("Stage definitions loaded", {
  totalStages: Object.keys(STAGE_METADATA).length,
  stages: Object.keys(STAGE_METADATA),
});
