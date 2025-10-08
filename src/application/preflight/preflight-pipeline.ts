/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Application: Preflight Pipeline
 * Orchestrates the execution of all preflight stages
 */

import { Logger } from "../../shared/logger.js";
import {
  PreflightStage,
  StageResult,
  StageContext,
  StageName,
  getStagesByOrder,
  validateStageOrder,
} from "../../domain/preflight/stage-definitions.js";
import {
  GatingRules,
  StageGateRules,
} from "../../domain/preflight/gating-rules.js";

const logger = new Logger({ level: "info" });

// ============================================================================
// Pipeline Result
// ============================================================================

export interface PipelineResult {
  success: boolean;
  stagesCompleted: StageResult[];
  totalDuration: number;
  canProceedToFullRun: boolean;
  gatingReason?: string;
}

// ============================================================================
// Pipeline Configuration
// ============================================================================

export interface PipelineConfig {
  stopOnBlockingFailure: boolean;
  enableGating: boolean;
  skipStages?: StageName[];
}

// ============================================================================
// Preflight Pipeline
// ============================================================================

export class PreflightPipeline {
  private stages: Map<StageName, PreflightStage>;
  private context: StageContext;
  private config: PipelineConfig;
  private logger: Logger;

  constructor(
    stages: PreflightStage[],
    context: StageContext,
    config: Partial<PipelineConfig> = {},
  ) {
    this.logger = new Logger({ level: "info" });
    this.context = context;
    this.config = {
      stopOnBlockingFailure: true,
      enableGating: true,
      ...config,
    };

    // Build stage map
    this.stages = new Map();
    for (const stage of stages) {
      this.stages.set(stage.stageName, stage);
    }

    // Validate stage order
    const stageNames = stages.map((s) => s.stageName);
    const validation = validateStageOrder(stageNames);
    if (!validation.valid) {
      throw new Error(`Invalid stage order: ${validation.errors.join("; ")}`);
    }

    this.logger.info("Preflight pipeline initialized", {
      stageCount: stages.length,
      stages: stageNames,
      config: this.config,
    });
  }

  /**
   * Execute the complete preflight pipeline
   */
  async execute(): Promise<PipelineResult> {
    const startTime = Date.now();
    const stagesCompleted: StageResult[] = [];
    let canProceedToFullRun = false;
    let gatingReason: string | undefined;

    this.logger.info("Starting preflight pipeline execution", {
      profile: this.context.profile,
      timestamp: this.context.timestamp,
    });

    try {
      const orderedStages = getStagesByOrder();

      for (const stageName of orderedStages) {
        // Skip if stage is in skip list
        if (this.config.skipStages?.includes(stageName)) {
          this.logger.info(`Skipping stage ${stageName}`, {
            reason: "Stage in skip list",
          });
          continue;
        }

        const stage = this.stages.get(stageName);
        if (!stage) {
          this.logger.warn(`Stage ${stageName} not found in pipeline`, {
            availableStages: Array.from(this.stages.keys()),
          });
          continue;
        }

        // Execute stage
        const result = await this.executeStage(stage);
        stagesCompleted.push(result);

        // Check if we should continue
        const continuationCheck =
          GatingRules.evaluateStageForContinuation(result);

        if (!continuationCheck.shouldContinue) {
          this.logger.error("Pipeline stopped due to blocking failure", {
            stage: stage.name,
            reason: continuationCheck.reason,
          });
          break;
        }

        // Special handling for gating stage
        if (stageName === StageName.GATING && this.config.enableGating) {
          const gatingResult = this.evaluateGatingStage(result);
          canProceedToFullRun = gatingResult.canProceed;
          gatingReason = gatingResult.reason;

          if (!canProceedToFullRun) {
            this.logger.warn("Gate check failed", {
              reason: gatingReason,
            });
            // Don't execute full run stage
            break;
          } else {
            this.logger.info("Gate check passed", {
              reason: gatingReason,
            });
          }
        }
      }

      const totalDuration = Date.now() - startTime;
      const success = stagesCompleted.every((s) => s.success);

      this.logger.info("Preflight pipeline execution completed", {
        success,
        stagesCompleted: stagesCompleted.length,
        totalDuration,
        canProceedToFullRun,
      });

      return {
        success,
        stagesCompleted,
        totalDuration,
        canProceedToFullRun,
        gatingReason,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error("Preflight pipeline execution failed", {
        error: error instanceof Error ? error.message : String(error),
        stagesCompleted: stagesCompleted.length,
        totalDuration,
      });

      return {
        success: false,
        stagesCompleted,
        totalDuration,
        canProceedToFullRun: false,
        gatingReason: `Pipeline failed: ${error}`,
      };
    }
  }

  /**
   * Execute a single stage
   */
  private async executeStage(stage: PreflightStage): Promise<StageResult> {
    const startTime = Date.now();

    this.logger.info(`Starting stage: ${stage.name}`, {
      stageName: stage.stageName,
      description: stage.description,
      blocking: stage.blocking,
    });

    try {
      const result = await stage.execute(this.context);
      const duration = Date.now() - startTime;

      this.logger.info(`Stage completed: ${stage.name}`, {
        stageName: stage.stageName,
        success: result.success,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Stage failed: ${stage.name}`, {
        stageName: stage.stageName,
        error: errorMessage,
        duration,
      });

      return {
        stage: stage.name,
        stageName: stage.stageName,
        success: false,
        duration_ms: duration,
        error: errorMessage,
        outputs: [],
      };
    }
  }

  /**
   * Evaluate gating stage result
   */
  private evaluateGatingStage(result: StageResult): {
    canProceed: boolean;
    reason: string;
  } {
    if (!result.success) {
      return {
        canProceed: false,
        reason: "Gating stage failed",
      };
    }

    const details = result.details as any;
    const canProceed = details?.canProceed === true;
    const reason = details?.reason || "Unknown";

    return { canProceed, reason };
  }

  /**
   * Get stage by name
   */
  getStage(stageName: StageName): PreflightStage | undefined {
    return this.stages.get(stageName);
  }

  /**
   * Get all stage results (for completed pipeline)
   */
  getStageResults(pipelineResult: PipelineResult): StageResult[] {
    return pipelineResult.stagesCompleted;
  }

  /**
   * Check if specific stage passed
   */
  didStagePass(pipelineResult: PipelineResult, stageName: StageName): boolean {
    const stageResult = pipelineResult.stagesCompleted.find(
      (s) => s.stageName === stageName,
    );
    return stageResult?.success === true;
  }

  /**
   * Get stage result
   */
  getStageResult(
    pipelineResult: PipelineResult,
    stageName: StageName,
  ): StageResult | undefined {
    return pipelineResult.stagesCompleted.find(
      (s) => s.stageName === stageName,
    );
  }
}

// ============================================================================
// Pipeline Builder
// ============================================================================

export class PipelineBuild {
  private stages: PreflightStage[] = [];
  private context?: StageContext;
  private config: Partial<PipelineConfig> = {};

  withStage(stage: PreflightStage): this {
    this.stages.push(stage);
    return this;
  }

  withStages(stages: PreflightStage[]): this {
    this.stages.push(...stages);
    return this;
  }

  withContext(context: StageContext): this {
    this.context = context;
    return this;
  }

  withConfig(config: Partial<PipelineConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  build(): PreflightPipeline {
    if (!this.context) {
      throw new Error("Pipeline context is required");
    }

    if (this.stages.length === 0) {
      throw new Error("At least one stage is required");
    }

    return new PreflightPipeline(this.stages, this.context, this.config);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createPipelineBuilder(): PipelineBuild {
  return new PipelineBuild();
}

export function createPipeline(
  stages: PreflightStage[],
  context: StageContext,
  config?: Partial<PipelineConfig>,
): PreflightPipeline {
  return new PreflightPipeline(stages, context, config);
}

// ============================================================================
// Exports
// ============================================================================

logger.info("Preflight pipeline module loaded");
